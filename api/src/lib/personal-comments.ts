import { dbPut, dbDeleteByKey, dbQueryPartition } from './dynamo.js';
import type { Setlist, User } from './types.js';
import { ok } from './response.js';

const TABLE = process.env.PERSONAL_COMMENTS_TABLE ?? 'kittens-personal-comments';
export interface PersonalComment {
  scope: string;
  key: string;
  authorId: string;
  songId: string;
  comment: string;
}
const keyFor = (authorId: string, songId: string) => JSON.stringify([authorId, songId]);

// Never persist caller-specific projections inside shared songs or setlists.
export function stripPersonalComments<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripPersonalComments) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'personalComment')
      .map(([key, item]) => [key, stripPersonalComments(item)])) as T;
  }
  return value;
}

export function ownComments(notes: PersonalComment[], user: User | null): Map<string, string> {
  return new Map(notes.filter(note => user?.status === 'approved' && note.authorId === user.id)
    .map(note => [note.songId, note.comment]));
}

export async function savePersonalComment(scope: string, songId: string, authorId: string, comment: string) {
  const key = keyFor(authorId, songId);
  if (!comment) await dbDeleteByKey(TABLE, { scope, key });
  else await dbPut(TABLE, { scope, key, songId, authorId, comment });
}

export async function clearPersonalComments(scope: string, songId?: string) {
  const notes = await dbQueryPartition<PersonalComment>(TABLE, 'scope', scope, true);
  await Promise.all(notes.filter(note => songId === undefined || note.songId === songId)
    .map(note => dbDeleteByKey(TABLE, { scope, key: note.key })));
}

export async function copyPersonalComments(setlistId: string, songIds: string[]) {
  if (!songIds.length) return;
  const ids = new Set(songIds);
  const notes = await dbQueryPartition<PersonalComment>(TABLE, 'scope', 'backlog', true);
  await Promise.all(notes.filter(note => ids.has(note.songId)).map(note =>
    dbPut(TABLE, { ...note, scope: `setlist:${setlistId}` })));
}

export async function personalResponse(value: unknown, user: User | null, status = 200) {
  const clean = stripPersonalComments(value);
  const response = (body: unknown) => {
    const result = ok(body, status);
    return { ...result, headers: { ...result.headers, 'Cache-Control': 'private, no-store' } };
  };
  if (!user || user.status !== 'approved') return response(clean);
  const scopes = new Map<string, Promise<Map<string, string>>>();
  function comments(scope: string) {
    if (!scopes.has(scope)) scopes.set(scope, dbQueryPartition<PersonalComment>(TABLE, 'scope', scope, true)
      .then(notes => ownComments(notes, user)));
    return scopes.get(scope)!;
  }
  async function decorate(item: unknown): Promise<unknown> {
    if (!item || typeof item !== 'object') return item;
    if (Array.isArray(item)) return Promise.all(item.map(decorate));
    if ('entries' in item && Array.isArray(item.entries) && 'id' in item && typeof item.id === 'string') {
      const setlist = item as Setlist;
      const notes = await comments(`setlist:${item.id}`);
      return { ...item, entries: setlist.entries.map(entry => ({ ...entry,
        ...(entry.songId && notes.has(entry.songId) ? { personalComment: notes.get(entry.songId) } : {}) })) };
    }
    if ('id' in item && typeof item.id === 'string' && 'musicians' in item) {
      const notes = await comments('backlog');
      return { ...item, ...(notes.has(item.id) ? { personalComment: notes.get(item.id) } : {}) };
    }
    return item;
  }
  return response(await decorate(clean));
}
