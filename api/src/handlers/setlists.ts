import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { dbGet, dbPut, dbDelete, dbScan } from '../lib/dynamo.js';
import { ok, err } from '../lib/response.js';
import type { Setlist, SetlistEntry, Song, LearningStage, KittensUser } from '../lib/types.js';
import { logAudit, diffSummary, stageLabel, musiciansDiff } from '../lib/audit.js';

const SONGS_TABLE = process.env.SONGS_TABLE ?? 'kittens-songs';
const TABLE = process.env.SETLISTS_TABLE ?? 'kittens-setlists';

function setlistName(s: Setlist) { return s.date ? `${s.name} (${s.date})` : s.name; }
function songName(s: Song) { return `${s.artist} — ${s.title}`; }
function entryName(setlist: Setlist, entry: SetlistEntry) {
  if (entry.song) return `${setlistName(setlist)} / ${songName(entry.song)}`;
  return `${setlistName(setlist)} / перерыв`;
}

export async function setlistsHandler(event: APIGatewayProxyEventV2, strippedPath: string, user: KittensUser) {
  const method = event.requestContext.http.method;
  const rawPath = strippedPath;
  const parts = strippedPath.split('/').filter(Boolean); // ['setlists'] or ['setlists', id, ...]
  const id = parts[1] ?? null;

  // /setlists — collection
  if (!id) {
    if (method === 'GET') {
      const items = await dbScan<Setlist>(TABLE);
      return ok(items);
    }
    if (method === 'POST') {
      const { name, date, startTime } = JSON.parse(event.body ?? '{}') as { name: string; date?: string; startTime?: string };
      const setlist: Setlist = { id: crypto.randomUUID(), name, date, startTime, entries: [] };
      await dbPut(TABLE, setlist as unknown as Record<string, unknown>);
      await logAudit({ action: 'setlist.create', actor: user, entityType: 'setlist', entityId: setlist.id, entityName: setlistName(setlist), summary: `создан сетлист "${setlistName(setlist)}"` });
      return ok(setlist, 201);
    }
    return err('Method not allowed', 405);
  }

  // Sub-routes: /setlists/:id/songs, /setlists/:id/breaks, /setlists/:id/played, /setlists/:id/order
  const afterId = rawPath.replace(`/setlists/${id}`, '');

  if (afterId === '/songs') {
    if (method === 'POST') {
      const { songs } = JSON.parse(event.body ?? '{}') as { songs: Song[] };
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const existing = new Set(setlist.entries.map(e => e.songId).filter(Boolean));
      const maxOrder = setlist.entries.reduce((m, e) => Math.max(m, e.order), -1);
      const newEntries: SetlistEntry[] = songs
        .filter(s => !existing.has(s.id))
        .map((s, i) => ({ songId: s.id, song: s, order: maxOrder + 1 + i, played: false, ...(s.progress ? { progress: s.progress } : {}) }));
      const updated: Setlist = { ...setlist, entries: [...setlist.entries, ...newEntries] };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      const names = newEntries.map(e => e.song ? songName(e.song) : '?').join(', ');
      await logAudit({ action: 'setlist.song_add', actor: user, entityType: 'setlist', entityId: id, entityName: setlistName(setlist), summary: `добавлено: ${names}` });
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  if (afterId.startsWith('/songs/')) {
    const songId = afterId.replace('/songs/', '');
    if (method === 'DELETE') {
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const removed = setlist.entries.find(e => e.songId === songId);
      const updated: Setlist = { ...setlist, entries: setlist.entries.filter(e => e.songId !== songId) };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      const removedName = removed?.song ? songName(removed.song) : songId;
      await logAudit({ action: 'setlist.song_remove', actor: user, entityType: 'setlist', entityId: id, entityName: setlistName(setlist), summary: `удалена: ${removedName}` });
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  if (afterId === '/breaks') {
    if (method === 'POST') {
      const { minutes } = JSON.parse(event.body ?? '{}') as { minutes: number };
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const maxOrder = setlist.entries.reduce((m, e) => Math.max(m, e.order), -1);
      const entry: SetlistEntry = { breakMinutes: minutes, order: maxOrder + 1, played: false };
      const updated: Setlist = { ...setlist, entries: [...setlist.entries, entry] };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      await logAudit({ action: 'setlist.break_add', actor: user, entityType: 'setlist', entityId: id, entityName: setlistName(setlist), summary: `добавлен перерыв ${minutes} мин` });
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  if (afterId.startsWith('/breaks/')) {
    const order = parseInt(afterId.replace('/breaks/', ''), 10);
    if (method === 'DELETE') {
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const updated: Setlist = { ...setlist, entries: setlist.entries.filter(e => e.order !== order) };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      await logAudit({ action: 'setlist.break_remove', actor: user, entityType: 'setlist', entityId: id, entityName: setlistName(setlist), summary: `удалён перерыв (порядок ${order})` });
      return ok(updated);
    }
    if (method === 'PATCH') {
      const { minutes } = JSON.parse(event.body ?? '{}') as { minutes: number };
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const before = setlist.entries.find(e => e.order === order);
      const updated: Setlist = {
        ...setlist,
        entries: setlist.entries.map(e => e.order === order ? { ...e, breakMinutes: minutes } : e),
      };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      await logAudit({ action: 'setlist.break_update', actor: user, entityType: 'setlist', entityId: id, entityName: setlistName(setlist), summary: `перерыв: ${before?.breakMinutes ?? '?'} → ${minutes} мин` });
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  if (afterId === '/entry-song') {
    if (method === 'PATCH') {
      const { order, song } = JSON.parse(event.body ?? '{}') as { order: number; song: Song };
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const before = setlist.entries.find(e => e.order === order);
      const updated: Setlist = {
        ...setlist,
        entries: setlist.entries.map(e => e.order === order ? { ...e, song } : e),
      };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      const entryLabel = before ? entryName(setlist, before) : `${setlistName(setlist)} #${order + 1}`;
      const scalarDiff = diffSummary(before?.song as unknown as Record<string, unknown> ?? {}, song as unknown as Record<string, unknown>, ['title', 'artist', 'category', 'comment', 'lengthMinutes']);
      const mDiff = musiciansDiff(before?.song?.musicians ?? {}, song.musicians ?? {});
      if (scalarDiff !== 'no changes' || mDiff) {
        const parts: string[] = [];
        if (scalarDiff !== 'no changes') parts.push(scalarDiff);
        if (mDiff) parts.push(mDiff);
        await logAudit({ action: 'setlist.entry_song_edit', actor: user, entityType: 'setlist_entry', entityId: id, entityName: entryLabel, summary: parts.join(', ') });
      }
      // Log per-musician progress changes in the snapshot
      const allMusicians = new Set([...Object.keys(before?.song?.progress ?? {}), ...Object.keys(song.progress ?? {})]);
      for (const m of allMusicians) {
        const b = before?.song?.progress?.[m] ?? null;
        const a = song.progress?.[m] ?? null;
        if (b !== a) {
          await logAudit({ action: 'setlist.entry_progress_update', actor: user, entityType: 'setlist_entry', entityId: id, entityName: entryLabel, summary: `${m}: ${stageLabel(b)} → ${stageLabel(a)}` });
        }
      }
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  if (afterId === '/entry-progress') {
    if (method === 'PATCH') {
      const { order, musicianName, stage, songId, isPermanent } = JSON.parse(event.body ?? '{}') as {
        order: number; musicianName: string; stage: LearningStage;
        songId?: string; isPermanent?: boolean;
      };
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const entry = setlist.entries.find(e => e.order === order);
      const prevStage = entry?.progress?.[musicianName] ?? null;
      const updated: Setlist = {
        ...setlist,
        entries: setlist.entries.map(e =>
          e.order === order
            ? { ...e, progress: { ...(e.progress ?? {}), [musicianName]: stage } }
            : e
        ),
      };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      if (isPermanent && songId) {
        const song = await dbGet<Song>(SONGS_TABLE, songId);
        if (song) {
          await dbPut(SONGS_TABLE, {
            ...song,
            progress: { ...(song.progress ?? {}), [musicianName]: stage },
          } as unknown as Record<string, unknown>);
        }
      }
      const entryLabel = entry ? entryName(setlist, entry) : `${setlistName(setlist)} #${order}`;
      await logAudit({ action: 'setlist.entry_progress_update', actor: user, entityType: 'setlist_entry', entityId: id, entityName: entryLabel, summary: `${musicianName}: ${stageLabel(prevStage)} → ${stageLabel(stage)}` });
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  if (afterId === '/entry-comment') {
    if (method === 'PATCH') {
      const { order, comment } = JSON.parse(event.body ?? '{}') as { order: number; comment: string };
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const entry = setlist.entries.find(e => e.order === order);
      const before = entry?.comment ?? '';
      const updated: Setlist = {
        ...setlist,
        entries: setlist.entries.map(e => e.order === order ? { ...e, comment } : e),
      };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      if (before !== comment) {
        const entryLabel = entry ? entryName(setlist, entry) : `${setlistName(setlist)} #${order}`;
        await logAudit({ action: 'setlist.entry_comment_update', actor: user, entityType: 'setlist_entry', entityId: id, entityName: entryLabel, summary: `комментарий: "${before}" → "${comment}"` });
      }
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  if (afterId === '/played') {
    if (method === 'POST') {
      const { songId, breakOrder } = JSON.parse(event.body ?? '{}') as { songId?: string, breakOrder?: number };
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const updated: Setlist = {
        ...setlist,
        entries: setlist.entries.map(e =>
          breakOrder !== undefined
            ? (e.order === breakOrder && e.breakMinutes !== undefined ? { ...e, played: !e.played } : e)
            : (e.songId === songId ? { ...e, played: !e.played } : e)
        ),
      };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  if (afterId === '/order') {
    if (method === 'PUT') {
      const { entries } = JSON.parse(event.body ?? '{}') as { entries: SetlistEntry[] };
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const updated: Setlist = { ...setlist, entries };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      await logAudit({ action: 'setlist.reorder', actor: user, entityType: 'setlist', entityId: id, entityName: setlistName(setlist), summary: `порядок изменён (${entries.length} позиций)` });
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  // /setlists/:id
  if (!afterId || afterId === '/') {
    if (method === 'GET') {
      const item = await dbGet<Setlist>(TABLE, id);
      if (!item) return err('Not found', 404);
      return ok(item);
    }
    if (method === 'PUT') {
      const body = JSON.parse(event.body ?? '{}') as Setlist;
      const before = await dbGet<Setlist>(TABLE, id);
      await dbPut(TABLE, { ...body, id } as unknown as Record<string, unknown>);
      const summary = before
        ? diffSummary(before as unknown as Record<string, unknown>, body as unknown as Record<string, unknown>, ['name', 'date', 'startTime'])
        : 'обновлён';
      await logAudit({ action: 'setlist.update', actor: user, entityType: 'setlist', entityId: id, entityName: setlistName(body), summary });
      return ok(body);
    }
    if (method === 'DELETE') {
      const before = await dbGet<Setlist>(TABLE, id);
      await dbDelete(TABLE, id);
      await logAudit({ action: 'setlist.delete', actor: user, entityType: 'setlist', entityId: id, entityName: before ? setlistName(before) : id, summary: 'удалён' });
      return ok({ deleted: id });
    }
  }

  return err('Not found', 404);
}
