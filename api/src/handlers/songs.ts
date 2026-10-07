import { personalResponse, stripPersonalComments, clearPersonalComments } from '../lib/personal-comments.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { dbGet, dbPut, dbDelete, dbScan } from '../lib/dynamo.js';
import { err } from '../lib/response.js';
import type { Song, User } from '../lib/types.js';
import { logAudit, diffSummary, stageLabel, musiciansDiff } from '../lib/audit.js';

const TABLE = process.env.SONGS_TABLE ?? 'kittens-songs';

function songName(s: Song) { return `${s.artist} — ${s.title}`; }

export async function songsHandler(event: APIGatewayProxyEventV2, path: string, user: User) {
  if (event.body) event = { ...event, body: JSON.stringify(stripPersonalComments(JSON.parse(event.body))) };
  const method = event.requestContext.http.method;
  const parts = path.split('/').filter(Boolean); // ['songs'] or ['songs', 'id']
  const id = parts[1] ?? null;

  if (!id || id === '') {
    if (method === 'GET') {
      const items = await dbScan<Song>(TABLE);
      return personalResponse(items, user);
    }
    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}') as Omit<Song, 'id'>;
      const song: Song = { ...body, id: crypto.randomUUID() };
      await dbPut(TABLE, song as unknown as Record<string, unknown>);
      await logAudit({ action: 'song.create', actor: user, entityType: 'song', entityId: song.id, entityName: songName(song), summary: `создана песня "${songName(song)}"` });
      return personalResponse(song, user, 201);
    }
    return err('Method not allowed', 405);
  }

  if (method === 'GET') {
    const item = await dbGet<Song>(TABLE, id);
    if (!item) return err('Not found', 404);
    return personalResponse(item, user);
  }
  if (method === 'PUT') {
    const body = JSON.parse(event.body ?? '{}') as Song;
    const before = await dbGet<Song>(TABLE, id);
    const toSave: Song = { ...body, id };
    if (toSave.lyrics === undefined && before?.lyrics !== undefined) toSave.lyrics = before.lyrics;
    await dbPut(TABLE, toSave as unknown as Record<string, unknown>);
    const parts: string[] = [];
    if (before) {
      const scalar = diffSummary(before as unknown as Record<string, unknown>, body as unknown as Record<string, unknown>, ['title', 'artist', 'category', 'comment', 'lengthMinutes', 'archived']);
      if (scalar !== 'no changes') parts.push(scalar);
      // Diff progress per-musician
      const mDiff = musiciansDiff(before.musicians ?? {}, body.musicians ?? {});
      if (mDiff) parts.push(mDiff);
      const allMusicians = new Set([...Object.keys(before.progress ?? {}), ...Object.keys(body.progress ?? {})]);
      for (const m of allMusicians) {
        const b = before.progress?.[m] ?? null;
        const a = body.progress?.[m] ?? null;
        if (b !== a) parts.push(`прогресс ${m}: ${stageLabel(b)} → ${stageLabel(a)}`);
      }
    }
    const noaudit = event.queryStringParameters?.noaudit === '1';
    if (!noaudit) {
      const summary = parts.length ? parts.join(', ') : 'обновлена';
      await logAudit({ action: 'song.update', actor: user, entityType: 'song', entityId: id, entityName: songName(body), summary });
    }
    return personalResponse(body, user);
  }
  if (method === 'DELETE') {
    const before = await dbGet<Song>(TABLE, id);
    await dbDelete(TABLE, id);
    await clearPersonalComments('backlog', id);
    await logAudit({ action: 'song.delete', actor: user, entityType: 'song', entityId: id, entityName: before ? songName(before) : id, summary: 'удалена' });
    return personalResponse({ deleted: id }, user);
  }

  if (parts[2] === 'progress' && method === 'PATCH') {
    const { musicianName, stage } = JSON.parse(event.body ?? '{}') as { musicianName: string; stage: string };
    const song = await dbGet<Song>(TABLE, id);
    if (!song) return err('Not found', 404);
    const prevStage = song.progress?.[musicianName] ?? null;
    const progress = { ...(song.progress ?? {}), [musicianName]: stage };
    const updated = { ...song, progress };
    await dbPut(TABLE, updated as unknown as Record<string, unknown>);
    await logAudit({ action: 'song.progress_update', actor: user, entityType: 'song', entityId: id, entityName: songName(song), summary: `${musicianName}: ${stageLabel(prevStage)} → ${stageLabel(stage)}` });
    return personalResponse(updated, user);
  }

  return err('Method not allowed', 405);
}
