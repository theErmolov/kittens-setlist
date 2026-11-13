import type { Song, Instrument, LearningStage } from '$lib/types';
import { sortInstruments, progressPct } from '$lib/utils';
import { stageCellClass } from '$lib/palette';

/** Fill classes of a catalog cell showing a learning stage (the stage tint over the page background). */
export const stageBg = (stage: LearningStage): string => stageCellClass(stage, 'bg');

/** Overall learning percentage across the permanent roster, or null when nobody plays the song. */
export function overallPct(song: Song, allMusicians: string[]): number | null {
  const perm = Object.fromEntries(allMusicians.filter(n => song.musicians[n]).map(n => [n, song.musicians[n]]));
  if (!Object.values(perm).some(r => r.instruments.length > 0)) return null;
  return progressPct(perm, (song.progress ?? {}) as Record<string, LearningStage>);
}

/** Guests = musicians on this song who are not in the permanent roster and have instruments. */
export function guestTags(song: Song, allMusicians: string[]): Array<{ name: string; instruments: Instrument[] }> {
  const perm = new Set(allMusicians);
  return Object.entries(song.musicians)
    .filter(([name, role]) => !perm.has(name) && role.instruments.length > 0)
    .map(([name, role]) => ({ name, instruments: sortInstruments(role.instruments) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
