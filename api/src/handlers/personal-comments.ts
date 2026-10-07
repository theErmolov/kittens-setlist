import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { dbGet } from '../lib/dynamo.js';
import { savePersonalComment } from '../lib/personal-comments.js';
import { ok, err } from '../lib/response.js';
import type { Setlist, Song, User } from '../lib/types.js';

export async function personalCommentsHandler(event: APIGatewayProxyEventV2, path: string, user: User) {
  if (event.requestContext.http.method !== 'PATCH') return err('Method not allowed', 405);
  let body: { comment?: unknown; songId?: unknown };
  try { body = JSON.parse(event.body ?? '{}'); } catch { return err('Invalid JSON', 400); }
  if (!body || typeof body.comment !== 'string' || body.comment.length > 4000) return err('Comment must be text, up to 4000 characters', 400);
  const parts = path.split('/').filter(Boolean);
  const id = parts[1];
  let scope: string;
  let songId: string;
  if (parts[0] === 'songs') {
    if (!await dbGet<Song>(process.env.SONGS_TABLE ?? 'kittens-songs', id)) return err('Not found', 404);
    scope = 'backlog';
    songId = id;
  } else {
    const setlist = await dbGet<Setlist>(process.env.SETLISTS_TABLE ?? 'kittens-setlists', id);
    if (!setlist) return err('Not found', 404);
    if (typeof body.songId !== 'string') return err('Song not found', 404);
    const entry = setlist.entries.find(entry => entry.songId === body.songId);
    if (!entry) return err('Song not found', 404);
    // Match lyrics: edits flow back to the catalog, never into other existing snapshots.
    if (!entry.setlistOnly && await dbGet<Song>(process.env.SONGS_TABLE ?? 'kittens-songs', body.songId)) {
      await savePersonalComment('backlog', body.songId, user.id, body.comment);
    }
    scope = `setlist:${id}`;
    songId = body.songId;
  }
  await savePersonalComment(scope, songId, user.id, body.comment);
  // Private text is deliberately absent from the shared audit log.
  return ok({ comment: body.comment });
}
