import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { dbGet, dbPut, dbDelete, dbScan } from '../lib/dynamo.js';
import { ok, err } from '../lib/response.js';
import type { Song, KittensUser } from '../lib/types.js';
import { logAudit, diffSummary, stageLabel } from '../lib/audit.js';

const TABLE = process.env.SONGS_TABLE ?? 'kittens-songs';

function songName(s: Song) { return `${s.title} — ${s.artist}`; }

export async function songsHandler(event: APIGatewayProxyEventV2, path: string, user: KittensUser) {
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
      await logAudit({ action: 'song.create', actor: user, entityType: 'song', entityId: song.id, entityName: songName(song), summary: `создана песня "${songName(song)}"` });
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
    const before = await dbGet<Song>(TABLE, id);
    await dbPut(TABLE, { ...body, id } as unknown as Record<string, unknown>);
    const parts: string[] = [];
    if (before) {
      const scalar = diffSummary(before as unknown as Record<string, unknown>, body as unknown as Record<string, unknown>, ['title', 'artist', 'category', 'comment', 'lengthMinutes']);
      if (scalar !== 'no changes') parts.push(scalar);
      // Diff progress per-musician
      const allMusicians = new Set([...Object.keys(before.progress ?? {}), ...Object.keys(body.progress ?? {})]);
      for (const m of allMusicians) {
        const b = before.progress?.[m] ?? null;
        const a = body.progress?.[m] ?? null;
        if (b !== a) parts.push(`прогресс ${m}: ${stageLabel(JSON.parse(b))} → ${stageLabel(JSON.parse(a))}`);
      }
    }
    const summary = parts.length ? parts.join(', ') : 'обновлена';
    await logAudit({ action: 'song.update', actor: user, entityType: 'song', entityId: id, entityName: songName(body), summary });
    return ok(body);
  }
  if (method === 'DELETE') {
    const before = await dbGet<Song>(TABLE, id);
    await dbDelete(TABLE, id);
    await logAudit({ action: 'song.delete', actor: user, entityType: 'song', entityId: id, entityName: before ? songName(before) : id, summary: 'удалена' });
    return ok({ deleted: id });
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
    return ok(updated);
  }

  return err('Method not allowed', 405);
}
