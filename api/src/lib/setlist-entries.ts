import type { Setlist, SetlistEntry, SetlistSubset, Song } from './types.js';

export function normalizeSubsetNames(subsets: SetlistSubset[]): SetlistSubset[] | null {
  if (subsets.some(subset => typeof subset.name !== 'string' || !subset.name.trim())) return null;
  return subsets.map(subset => ({ ...subset, name: subset.name.trim() }));
}

export function nextVisualOrder(setlist: Setlist): number {
  const entryOrders = setlist.entries.map(entry => entry.order);
  const subsetOrders = (setlist.subsets ?? [])
    .map(subset => subset.order)
    .filter((order): order is number => order !== undefined);
  return Math.max(-1, ...entryOrders, ...subsetOrders) + 1;
}

export function appendSongsToSetlist(
  setlist: Setlist,
  songs: Song[],
  setlistOnly: boolean,
  createId: () => string = () => crypto.randomUUID(),
): { updated: Setlist; newEntries: SetlistEntry[] } {
  const existing = new Set(setlist.entries.map(entry => entry.songId).filter(Boolean));
  const startOrder = nextVisualOrder(setlist);
  const preparedSongs = setlistOnly
    ? songs.map(song => ({ ...song, id: createId() }))
    : songs.filter(song => !existing.has(song.id));

  const newEntries: SetlistEntry[] = preparedSongs.map((song, index) => ({
    songId: song.id,
    song,
    order: startOrder + index,
    played: false,
    ...(song.progress ? { progress: song.progress } : {}),
    ...(setlistOnly ? { setlistOnly: true } : {}),
    ...(setlistOnly && song.comment ? { comment: song.comment } : {}),
  }));

  return {
    updated: { ...setlist, entries: [...setlist.entries, ...newEntries] },
    newEntries,
  };
}
