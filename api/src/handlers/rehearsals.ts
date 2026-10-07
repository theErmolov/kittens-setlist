import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { GetCommand, PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, dbScan } from '../lib/dynamo.js';
import { logAudit, stageLabel } from '../lib/audit.js';
import { ok, err } from '../lib/response.js';
import { stripPersonalComments } from '../lib/personal-comments.js';
import type { Rehearsal, RehearsalDraft, RehearsalSong, Setlist, Song, User, LearningStage } from '../lib/types.js';

const TABLE = process.env.REHEARSALS_TABLE ?? 'kittens-rehearsals';
const SONGS = process.env.SONGS_TABLE ?? 'kittens-songs';
const SETLISTS = process.env.SETLISTS_TABLE ?? 'kittens-setlists';
const key = (song: Pick<RehearsalSong, 'songId' | 'sourceSetlistId'>) => JSON.stringify([song.sourceSetlistId ?? '', song.songId]);
class InputError extends Error { constructor(message: string, public status = 400) { super(message); } }
function text(value: unknown, name: string, max = 4000): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) throw new InputError(`Invalid ${name}`);
  return value.trim();
}
// Read the current version/progress, including immediately after a successful write.
async function getCurrent<T>(table: string, id: string): Promise<T | undefined> {
  const result = await db.send(new GetCommand({ TableName: table, Key: { id }, ConsistentRead: true }));
  return result.Item as T | undefined;
}
function sources() {
  const songs = new Map<string, Promise<Song | undefined>>();
  const setlists = new Map<string, Promise<Setlist | undefined>>();
  return {
    song(id: string) { if (!songs.has(id)) songs.set(id, getCurrent<Song>(SONGS, id)); return songs.get(id)!; },
    setlist(id: string) { if (!setlists.has(id)) setlists.set(id, getCurrent<Setlist>(SETLISTS, id)); return setlists.get(id)!; },
  };
}
async function hydrate(rehearsal: Rehearsal, cache = sources()): Promise<Rehearsal> {
  return stripPersonalComments({ ...rehearsal, songs: await Promise.all(rehearsal.songs.map(async item => {
    const entry = item.sourceSetlistId ? (await cache.setlist(item.sourceSetlistId))?.entries.find(e => e.songId === item.songId) : undefined;
    const canonical = entry?.setlistOnly ? undefined : await cache.song(item.songId);
    const arrangement = entry?.song ?? (item.sourceSetlistId ? item.song : canonical ?? item.song);
    return { ...item, song: { ...arrangement, progress: { ...(item.song.progress ?? {}), ...(entry?.progress ?? {}), ...(arrangement.progress ?? {}), ...(canonical?.progress ?? {}) } }, sourceMissing: item.sourceSetlistId ? !entry?.song : !canonical };
  })) });
}
async function parseDraft(body: Record<string, unknown>, before?: Rehearsal): Promise<RehearsalDraft> {
  const date = text(body.date, 'date', 10);
  const parsedDate = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new InputError('Invalid date');
  const startTime = text(body.startTime, 'startTime', 5), endTime = text(body.endTime, 'endTime', 5);
  const validTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  if (!validTime(startTime) || (endTime && (!validTime(endTime) || endTime <= startTime))) throw new InputError('End time must be after start time on the same day');
  const timeZone = text(body.timeZone, 'timeZone', 100);
  try { if (!timeZone) throw new Error(); new Intl.DateTimeFormat('en', { timeZone }); } catch { throw new InputError('Invalid time zone'); }
  if (!Array.isArray(body.attendees) || body.attendees.length > 100) throw new InputError('Invalid attendees');
  const attendees = [...new Set(body.attendees.map(name => text(name, 'attendee', 100)))];
  if (attendees.some(name => !name)) throw new InputError('Attendee name required');
  if (!Array.isArray(body.songs) || body.songs.length > 200) throw new InputError('Invalid songs');
  const cache = sources();
  const setlistId = text(body.setlistId, 'setlistId', 100) || undefined;
  if (setlistId && setlistId !== before?.setlistId && !(await cache.setlist(setlistId))) throw new InputError('Setlist not found', 404);
  const seen = new Set<string>();
  const songs: RehearsalSong[] = [];
  for (const value of body.songs) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Invalid song');
    const input = value as Record<string, unknown>;
    const ref = { songId: text(input.songId, 'songId', 100), sourceSetlistId: text(input.sourceSetlistId, 'sourceSetlistId', 100) || undefined };
    if (!ref.songId) throw new InputError('Song id required');
    const songKey = key(ref);
    if (seen.has(ref.songId)) continue;
    seen.add(ref.songId);
    const previous = before?.songs.find(s => key(s) === songKey);
    const source = ref.sourceSetlistId
      ? (await cache.setlist(ref.sourceSetlistId))?.entries.find(e => e.songId === ref.songId)?.song
      : await cache.song(ref.songId);
    if (!source && !previous) throw new InputError('Song not found', 404);
    songs.push({ ...ref, song: stripPersonalComments(previous?.song ?? source!), note: text(input.note, 'song note') || undefined });
  }
  if (body.cancelled !== undefined && typeof body.cancelled !== 'boolean') throw new InputError('Invalid cancelled status');
  return { date, startTime, endTime: endTime || undefined, timeZone, location: text(body.location, 'location', 500) || undefined, note: text(body.note, 'note') || undefined, setlistId, attendees, songs, cancelled: body.cancelled === true };
}

// Explicit admin-only policy, independent of deployment/release status.
export function canAccessRehearsals(user: User | null): boolean { return user?.isAdmin === true && user.status === 'approved'; }
export async function rehearsalsHandler(event: APIGatewayProxyEventV2, path: string, user: User) {
  if (!canAccessRehearsals(user)) return err('Forbidden', 403);
  const method = event.requestContext.http.method;
  const parts = path.split('/').filter(Boolean);
  const id = parts[1];
  if (parts.length > 3 || (parts[2] && parts[2] !== 'progress')) return err('Not found', 404);
  try {
    if (method === 'GET' && !parts[2]) {
      if (id) { const item = await getCurrent<Rehearsal>(TABLE, id); return item ? ok(await hydrate(item)) : err('Not found', 404); }
      const cache = sources();
      return ok(await Promise.all((await dbScan<Rehearsal>(TABLE)).map(item => hydrate(item, cache))));
    }
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(event.body ?? '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      body = parsed;
    } catch { throw new InputError('Invalid JSON'); }
    if (!id && method === 'POST') {
      const copyFromId = text(body.copyFromId, 'copyFromId', 100);
      const original = copyFromId ? await getCurrent<Rehearsal>(TABLE, copyFromId) : undefined;
      if (copyFromId && !original) throw new InputError('Original rehearsal not found', 404);
      const draft = await parseDraft(body, original);
      const item: Rehearsal = { ...draft, id: randomUUID(), version: 1, createdAt: new Date().toISOString(), createdBy: user.id };
      await db.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: 'attribute_not_exists(id)' }));
      await logAudit({ action: 'rehearsal.create', actor: user, entityType: 'rehearsal', entityId: item.id, entityName: `${item.date} ${item.startTime}`, summary: 'создана репетиция' });
      return ok(await hydrate(item), 201);
    }
    if (!id) return err('Method not allowed', 405);
    const before = await getCurrent<Rehearsal>(TABLE, id);
    if (!before) return err('Not found', 404);
    if (parts[2] === 'progress' && method === 'PATCH') {
      if (before.cancelled) throw new InputError('Rehearsal is cancelled', 409);
      const ref = { songId: text(body.songId, 'songId', 100), sourceSetlistId: text(body.sourceSetlistId, 'sourceSetlistId', 100) || undefined };
      const selected = before.songs.find(s => key(s) === key(ref));
      if (!selected) throw new InputError('Song not in rehearsal', 404);
      const name = text(body.musicianName, 'musician', 100);
      const stage = body.stage as LearningStage;
      if (!['queue', 'structure', 'mastering', 'ready'].includes(stage)) throw new InputError('Invalid learning stage');
      const cache = sources();
      const sourceSetlist = ref.sourceSetlistId ? await cache.setlist(ref.sourceSetlistId) : undefined;
      const index = sourceSetlist?.entries.findIndex(e => e.songId === ref.songId) ?? -1;
      const entry = index >= 0 ? sourceSetlist!.entries[index] : undefined;
      const canonical = entry?.setlistOnly ? undefined : await cache.song(ref.songId);
      const arrangement = entry?.song ?? selected.song;
      if (!before.attendees.includes(name) || !arrangement.musicians[name]?.instruments.length) throw new InputError('Musician does not take part in this song');
      let table: string, progressPath: string, condition: string, expressionNames: Record<string, string>, expressionValues: Record<string, unknown>, recordId: string;
      if (canonical) {
        table = SONGS; recordId = ref.songId; progressPath = '#progress'; condition = 'attribute_exists(id)';
        expressionNames = { '#progress': 'progress' }; expressionValues = {};
      } else if (entry?.song) {
        table = SETLISTS; recordId = ref.sourceSetlistId!; progressPath = `#entries[${index}].#song.#progress`;
        condition = `#entries[${index}].#songId = :songId`;
        expressionNames = { '#entries': 'entries', '#song': 'song', '#progress': 'progress', '#songId': 'songId' }; expressionValues = { ':songId': ref.songId };
      } else throw new InputError('Original song was removed; progress cannot be updated', 409);
      await db.send(new UpdateCommand({ TableName: table, Key: { id: recordId }, UpdateExpression: `SET ${progressPath} = if_not_exists(${progressPath}, :empty)`, ConditionExpression: condition, ExpressionAttributeNames: expressionNames, ExpressionAttributeValues: { ...expressionValues, ':empty': {} } }));
      await db.send(new UpdateCommand({ TableName: table, Key: { id: recordId }, UpdateExpression: `SET ${progressPath}.#musician = :stage`, ConditionExpression: condition, ExpressionAttributeNames: { ...expressionNames, '#musician': name }, ExpressionAttributeValues: { ...expressionValues, ':stage': stage } }));
      await logAudit({ action: 'rehearsal.progress_update', actor: user, entityType: 'rehearsal', entityId: id, entityName: `${before.date} ${before.startTime}`, summary: `${arrangement.title}: ${name} → ${stageLabel(stage)}` });
      const latest = await getCurrent<Rehearsal>(TABLE, id);
      return latest ? ok(await hydrate(latest)) : err('Not found', 404);
    }
    if (parts[2]) return err('Method not allowed', 405);
    if (method !== 'PUT' && method !== 'DELETE') return err('Method not allowed', 405);
    if (body.version !== before.version) throw new InputError('Rehearsal changed. Reload before saving.', 409);
    if (method === 'DELETE') {
      await db.send(new DeleteCommand({ TableName: TABLE, Key: { id }, ConditionExpression: '#version = :version', ExpressionAttributeNames: { '#version': 'version' }, ExpressionAttributeValues: { ':version': before.version } }));
      await logAudit({ action: 'rehearsal.delete', actor: user, entityType: 'rehearsal', entityId: id, entityName: `${before.date} ${before.startTime}`, summary: 'удалена репетиция' });
      return ok({ deleted: id });
    }
    const draft = await parseDraft(body, before);
    const item: Rehearsal = { ...before, ...draft, version: before.version + 1 };
    await db.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: '#version = :version', ExpressionAttributeNames: { '#version': 'version' }, ExpressionAttributeValues: { ':version': before.version } }));
    await logAudit({ action: 'rehearsal.update', actor: user, entityType: 'rehearsal', entityId: id, entityName: `${item.date} ${item.startTime}`, summary: item.cancelled !== before.cancelled ? (item.cancelled ? 'отменена репетиция' : 'восстановлена репетиция') : 'обновлён план репетиции' });
    return ok(await hydrate(item));
  } catch (error) {
    if (error instanceof InputError) return err(error.message, error.status);
    if ((error as Error).name === 'ConditionalCheckFailedException') return err('Data changed. Reload before saving.', 409);
    throw error;
  }
}
