import type { Category, Instrument, Setlist, Song } from './types';

/** Setlists stay available for additions until 24 hours after their local start. */
export function isSetlistOpen(sl: Setlist, now = Date.now()): boolean {
  if (!sl.date) return true;
  const start = new Date(`${sl.date}T${sl.startTime || '00:00'}`);
  if (isNaN(start.getTime())) return true;
  return now - start.getTime() < 24 * 60 * 60 * 1000;
}

/** Musicians are ANDed; instruments are ORed within the selected musicians. */
export function matchesBacklogFilters(
  song: Song,
  search: string,
  categories: Set<Category>,
  musicians: Set<string>,
  instruments: Set<Instrument>,
): boolean {
  const q = search.toLowerCase();
  if (q && !song.artist.toLowerCase().includes(q) && !song.title.toLowerCase().includes(q)) return false;
  if (categories.size > 0 && !categories.has(song.category)) return false;
  for (const name of musicians) {
    const role = song.musicians[name];
    if (!role || role.instruments.length === 0) return false;
  }
  if (instruments.size > 0) {
    const roles = musicians.size > 0
      ? [...musicians].map(name => song.musicians[name])
      : Object.values(song.musicians);
    if (!roles.some(role => role.instruments.some(instrument => instruments.has(instrument)))) return false;
  }
  return true;
}
