import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { dbGet, dbPut, dbDelete, dbScan } from '../lib/dynamo.js';
import { ok, err } from '../lib/response.js';
import type { Setlist, SetlistEntry } from '../lib/types.js';

const TABLE = process.env.SETLISTS_TABLE ?? 'kittens-setlists';

export async function setlistsHandler(event: APIGatewayProxyEventV2, strippedPath: string) {
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
      const { name, date } = JSON.parse(event.body ?? '{}') as { name: string; date?: string };
      const setlist: Setlist = { id: crypto.randomUUID(), name, date, entries: [] };
      await dbPut(TABLE, setlist as unknown as Record<string, unknown>);
      return ok(setlist, 201);
    }
    return err('Method not allowed', 405);
  }

  // Sub-routes: /setlists/:id/songs, /setlists/:id/breaks, /setlists/:id/played, /setlists/:id/order
  const afterId = rawPath.replace(`/setlists/${id}`, '');

  if (afterId === '/songs') {
    if (method === 'POST') {
      const { songIds } = JSON.parse(event.body ?? '{}') as { songIds: string[] };
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const existing = new Set(setlist.entries.map(e => e.songId).filter(Boolean));
      const maxOrder = setlist.entries.reduce((m, e) => Math.max(m, e.order), -1);
      const newEntries: SetlistEntry[] = songIds
        .filter(sid => !existing.has(sid))
        .map((sid, i) => ({ songId: sid, order: maxOrder + 1 + i, played: false }));
      const updated: Setlist = { ...setlist, entries: [...setlist.entries, ...newEntries] };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  if (afterId.startsWith('/songs/')) {
    const songId = afterId.replace('/songs/', '');
    if (method === 'DELETE') {
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const updated: Setlist = { ...setlist, entries: setlist.entries.filter(e => e.songId !== songId) };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
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
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  if (afterId === '/entry-comment') {
    if (method === 'PATCH') {
      const { order, comment } = JSON.parse(event.body ?? '{}') as { order: number; comment: string };
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const updated: Setlist = {
        ...setlist,
        entries: setlist.entries.map(e => e.order === order ? { ...e, comment } : e),
      };
      await dbPut(TABLE, updated as unknown as Record<string, unknown>);
      return ok(updated);
    }
    return err('Method not allowed', 405);
  }

  if (afterId === '/played') {
    if (method === 'POST') {
      const { songId } = JSON.parse(event.body ?? '{}') as { songId: string };
      const setlist = await dbGet<Setlist>(TABLE, id);
      if (!setlist) return err('Not found', 404);
      const updated: Setlist = {
        ...setlist,
        entries: setlist.entries.map(e =>
          e.songId === songId ? { ...e, played: !e.played } : e
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
      await dbPut(TABLE, { ...body, id } as unknown as Record<string, unknown>);
      return ok(body);
    }
    if (method === 'DELETE') {
      await dbDelete(TABLE, id);
      return ok({ deleted: id });
    }
  }

  return err('Not found', 404);
}
