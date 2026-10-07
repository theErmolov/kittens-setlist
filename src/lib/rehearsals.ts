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
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: rehearsal.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)!.value;
  const date = `${value('year')}-${value('month')}-${value('day')}`;
  return rehearsal.date > date || (rehearsal.date === date && (rehearsal.endTime ?? '23:59') >= `${value('hour')}:${value('minute')}`);
}

export function calendarDays(month: Date): Date[] {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}
