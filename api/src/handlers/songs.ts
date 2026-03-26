import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { dbGet, dbPut, dbDelete, dbScan } from '../lib/dynamo.js';
import { ok, err } from '../lib/response.js';
import type { Song } from '../lib/types.js';

const TABLE = process.env.SONGS_TABLE ?? 'kittens-songs';

export async function songsHandler(event: APIGatewayProxyEventV2, path: string) {
  const method = event.requestContext.http.method;
  const parts = path.split('/').filter(Boolean); // ['songs'] or ['songs', 'id']
  const id = parts[1] ?? null;

  if (!id || id === '') {
    if (method === 'GET') {
      const items = await dbScan<Song>(TABLE);
      return ok(items);
    }
    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}') as Omit<Song, 'id'>;
      const song: Song = { ...body, id: crypto.randomUUID() };
      await dbPut(TABLE, song as unknown as Record<string, unknown>);
      return ok(song, 201);
    }
    return err('Method not allowed', 405);
  }

  if (method === 'GET') {
    const item = await dbGet<Song>(TABLE, id);
    if (!item) return err('Not found', 404);
    return ok(item);
  }
  if (method === 'PUT') {
    const body = JSON.parse(event.body ?? '{}') as Song;
    await dbPut(TABLE, { ...body, id } as unknown as Record<string, unknown>);
    return ok(body);
  }
  if (method === 'DELETE') {
    await dbDelete(TABLE, id);
    return ok({ deleted: id });
  }

  if (parts[2] === 'progress' && method === 'PATCH') {
    const { musicianName, stage } = JSON.parse(event.body ?? '{}') as { musicianName: string; stage: string };
    const song = await dbGet<Song>(TABLE, id);
    if (!song) return err('Not found', 404);
    const progress = { ...(song.progress ?? {}), [musicianName]: stage };
    const updated = { ...song, progress };
    await dbPut(TABLE, updated as unknown as Record<string, unknown>);
    return ok(updated);
  }

  return err('Method not allowed', 405);
}
