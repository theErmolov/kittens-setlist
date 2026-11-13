import type { Song } from './types';

type MaybeSong = Pick<Song, 'musicians'> | null | undefined;

/** True when `name` has a part (at least one instrument) in the song. */
export function playsInSong(song: MaybeSong, name: string): boolean {
  return (song?.musicians[name]?.instruments.length ?? 0) > 0;
}

/** How many of `songs` each of `names` plays in. Missing songs (breaks) are skipped. */
export function countByMusician(songs: Iterable<MaybeSong>, names: Iterable<string>): Record<string, number> {
  const list = [...songs];
  const counts: Record<string, number> = {};
  for (const name of names) counts[name] = list.filter(song => playsInSong(song, name)).length;
  return counts;
}

/** Sorted names of non-band musicians with a part in at least one of `songs`. */
export function guestMusicianNames(songs: Iterable<MaybeSong>, permanent: ReadonlySet<string>): string[] {
  const guests = new Set<string>();
  for (const song of songs) {
    if (!song) continue;
    for (const [name, role] of Object.entries(song.musicians)) {
      if (!permanent.has(name) && role.instruments.length > 0) guests.add(name);
    }
  }
  return [...guests].sort();
}
