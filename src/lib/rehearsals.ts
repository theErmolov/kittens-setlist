import type { Rehearsal, RehearsalSong, Setlist, Song, LearningStage } from './types';

export const rehearsalSongKey = (song: Pick<RehearsalSong, 'songId' | 'sourceSetlistId'>): string =>
  JSON.stringify([song.sourceSetlistId ?? '', song.songId]);

export function setlistParticipants(setlist: Setlist): string[] {
  return [...new Set(setlist.entries.flatMap(entry => Object.entries(entry.song?.musicians ?? {})
    .filter(([, role]) => role.instruments.length > 0).map(([name]) => name)))];
}

export function rehearsalReadiness(song: Song, attendees?: string[]): number | null {
  const weights: Record<LearningStage, number> = { queue: 0, structure: 25, mastering: 75, ready: 100 };
  const names = Object.keys(song.musicians).filter(name => song.musicians[name].instruments.length > 0 && (!attendees || attendees.includes(name)));
  if (!names.length) return null;
  return Math.round(names.reduce((sum, name) => sum + (weights[song.progress?.[name] ?? 'queue'] ?? 0), 0) / names.length);
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isUpcoming(rehearsal: Rehearsal, now = new Date()): boolean {
  if (rehearsal.cancelled) return false;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: rehearsal.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)!.value;
  const date = `${value('year')}-${value('month')}-${value('day')}`;
  return rehearsal.date >= date;
}

export function calendarDays(month: Date): Date[] {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

/** Date-only events remain candidates throughout their day. */
function eventTime(setlist: Setlist): string {
  return `${setlist.date}T${setlist.startTime || '23:59'}`;
}

export function closestUpcomingSetlist(setlists: Setlist[], date: string, time: string): Setlist | undefined {
  const from = `${date}T${time}`;
  return setlists.filter(s => s.date && eventTime(s) >= from)
    .sort((a, b) => eventTime(a).localeCompare(eventTime(b)) || a.name.localeCompare(b.name))[0];
}

/** Today's and future events, furthest future first; undated setlists last. */
export function upcomingSetlists(setlists: Setlist[], today = localDate()): Setlist[] {
  return setlists.filter(s => !s.date || s.date >= today).sort((a, b) => {
    if (!a.date && !b.date) return a.name.localeCompare(b.name);
    if (!a.date) return 1;
    if (!b.date) return -1;
    return eventTime(b).localeCompare(eventTime(a)) || a.name.localeCompare(b.name);
  });
}

/** Only actual assigned parts count; empty roster entries do not require attendance. */
export function rehearsalCoverage(song: Song, attendees: string[]) {
  const needed = Object.keys(song.musicians).filter(name => song.musicians[name].instruments.length > 0);
  const missing = needed.filter(name => !attendees.includes(name));
  return { needed, missing, present: needed.length - missing.length, complete: needed.length > 0 && missing.length === 0 };
}

export function compareRehearsalSongs(a: RehearsalSong, b: RehearsalSong): number {
  return a.song.artist.localeCompare(b.song.artist, 'en', { sensitivity: 'base' })
    || a.song.title.localeCompare(b.song.title, 'en', { sensitivity: 'base' });
}

/** Keep the existing custom order and append newly selected songs alphabetically. */
export function mergeRehearsalSongs(previous: RehearsalSong[], selected: RehearsalSong[]): RehearsalSong[] {
  const ids = new Set(selected.map(s => s.songId));
  const existing = new Set(previous.map(s => s.songId));
  return [...previous.filter(s => ids.has(s.songId)), ...selected.filter(s => !existing.has(s.songId)).sort(compareRehearsalSongs)];
}

/** Keep explicit attendance choices only for musicians with a part in this plan. */
export function rehearsalAttendees(songs: RehearsalSong[], attendees: string[]): string[] {
  const needed = new Set(songs.flatMap(item => rehearsalCoverage(item.song, []).needed));
  return attendees.filter(name => needed.has(name));
}
