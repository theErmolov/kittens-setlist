/**
 * Warm the query cache for pages the user is likely to open next. Cached entries never go
 * stale (see `client.ts`), so prefetching is a no-op for anything already loaded.
 */
import { queryClient } from './client';
import { musiciansQuery, rehearsalQuery, songsQuery } from './queries';
import { stageSetlistQuery } from './stage';

const PREFETCH_COUNT = 5;

/** The first few setlists plus the song/musician catalogs the editor needs. */
export function prefetchSetlists(ids: string[]): void {
  for (const id of ids.slice(0, PREFETCH_COUNT)) queryClient.prefetchQuery(stageSetlistQuery(id));
  queryClient.prefetchQuery(musiciansQuery());
  queryClient.prefetchQuery(songsQuery());
}

/** Rehearsals around today: the next few and the last few. */
export function prefetchRehearsals(upcomingIds: string[], pastIds: string[]): void {
  for (const id of [...upcomingIds.slice(0, PREFETCH_COUNT), ...pastIds.slice(0, PREFETCH_COUNT)]) queryClient.prefetchQuery(rehearsalQuery(id));
}
