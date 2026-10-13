import { songListText, appendNotificationText, type NotificationText } from './notification-text.js';
import type { Rehearsal, User } from './types.js';

export const HOUR = 3_600_000;
export interface PreparationGroup { rehearsals: Rehearsal[]; start: number; due: number; deadline: number }

/** Convert a local wall-clock date/time in an IANA zone to UTC, including DST. */
export function zonedTime(date: string, time: string, timeZone: string): number {
  const wall = Date.parse(`${date}T${time}:00Z`);
  let instant = wall;
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(instant);
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    const observed = Date.parse(`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:00Z`);
    const correction = wall - observed;
    instant += correction;
    if (!correction) return instant;
  }
  // Reject nonexistent wall times rather than silently shifting a reminder.
  throw new Error('Invalid local rehearsal time');
}
export const rehearsalStart = (r: Rehearsal) => zonedTime(r.date, r.startTime, r.timeZone);
export function morningAfter(r: Rehearsal): number {
  // End time is optional and always on the rehearsal's local date.
  const nextDate = new Date(Date.parse(`${r.date}T12:00:00Z`) + 24 * HOUR).toISOString().slice(0, 10);
  return zonedTime(nextDate, '09:00', r.timeZone);
}

/** Keep past predecessors so grouping does not change immediately after they finish. */
export function preparationGroups(rehearsals: Rehearsal[], interval = HOUR): PreparationGroup[] {
  const sorted = rehearsals.filter(r => !r.cancelled).sort((a, b) => rehearsalStart(a) - rehearsalStart(b) || a.id.localeCompare(b.id));
  const groups: PreparationGroup[] = [];
  for (const r of sorted) {
    const start = rehearsalStart(r);
    const previous = groups.at(-1);
    const last = previous?.rehearsals.at(-1);
    // Require a scheduler slot after the next morning and strictly before the
    // deadline (also covers zones with half-hour/quarter-hour UTC offsets).
    if (previous && last && (start - rehearsalStart(last) < 24 * HOUR || Math.ceil(morningAfter(last) / interval) * interval >= start - 24 * HOUR)) {
      previous.rehearsals.push(r);
    } else {
      groups.push({ rehearsals: [r], start, due: Math.max(start - 72 * HOUR, last ? morningAfter(last) : -Infinity), deadline: start - 24 * HOUR });
    }
  }
  return groups;
}

/** Personal delivery is allowed only inside its current preparation window. */
export function reminderDue(group: PreparationGroup, now: number): boolean {
  return now >= group.due && now <= group.deadline;
}
export function personalTrialAllowed(user?: User | null): user is User & { telegramId: string } {
  return user?.status === 'approved' && user.isAdmin === true && Boolean(user.telegramId);
}
export function rehearsalLabelText(r: Rehearsal): NotificationText {
  const date = new Intl.DateTimeFormat('ru-RU', { timeZone: r.timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(rehearsalStart(r));
  const dateTime = `${date}, ${r.startTime}${r.endTime ? `–${r.endTime}` : ''}`;
  return { text: `${dateTime}${r.location ? ` · ${r.location}` : ''}`, entities: [{ type: 'bold', offset: 0, length: dateTime.length }] };
}
export function rehearsalLabel(r: Rehearsal): string {
  return rehearsalLabelText(r).text;
}
export function preparationText(group: Rehearsal[], name: string, now: number): NotificationText & { hasWork: boolean } {
  const sections = { learn: [] as { artist: string; title: string; note?: string }[], polish: [] as { artist: string; title: string; note?: string }[], refresh: [] as { artist: string; title: string; note?: string }[] };
  const labels: Record<keyof typeof sections, string> = { learn: 'Разобрать', polish: 'Доработать', refresh: 'Освежить' };
  // A song appears once; keep the least-ready stage across different arrangements.
  const work = new Map<string, { section: keyof typeof sections; artist: string; title: string; notes: Set<string> }>();
  const rank = { learn: 0, polish: 1, refresh: 2 };
  const upcoming = group.filter(r => rehearsalStart(r) > now && r.attendees.includes(name));
  for (const r of upcoming) for (const item of r.songs) {
    if (!item.song.musicians[name]?.instruments.length) continue;
    const stage = item.song.progress?.[name] ?? 'queue';
    const section = stage === 'ready' ? (item.refreshFor?.includes(name) ? 'refresh' : undefined) : stage === 'mastering' ? 'polish' : 'learn';
    if (!section) continue;
    const existing = work.get(item.songId);
    const notes = existing?.notes ?? new Set<string>();
    if (item.note) notes.add(item.note);
    if (!existing || rank[section] < rank[existing.section]) work.set(item.songId, { section, artist: item.song.artist, title: item.song.title, notes });
  }
  for (const item of work.values()) sections[item.section].push({ artist: item.artist, title: item.title, note: [...item.notes].join('; ') || undefined });
  const result: NotificationText = { text: `${name}, подготовка к репетиции:`, entities: [] };
  for (const r of upcoming) {
    result.text += '\n';
    appendNotificationText(result, rehearsalLabelText(r));
  }
  for (const section of Object.keys(sections) as (keyof typeof sections)[]) {
    if (!sections[section].length) continue;
    result.text += `\n\n${labels[section]}:\n`;
    appendNotificationText(result, songListText(sections[section]));
  }
  if (!work.size) result.text += '\n\nВсё готово — учить ничего не нужно.';
  return { ...result, hasWork: work.size > 0 };
}
