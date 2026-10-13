import assert from 'node:assert/strict';
import test from 'node:test';
import { setlistParticipants, rehearsalReadiness, calendarDays, localDate, isUpcoming, closestUpcomingSetlist, upcomingSetlists } from '../src/lib/rehearsals.ts';
const song = { musicians: { Bass: { instruments: ['bass'] }, Guest: { instruments: ['vocals'] }, Free: { instruments: [] } }, progress: { Bass: 'ready', Guest: 'structure', Free: 'ready' } };
test('setlist attendance includes guests, excludes unassigned people, deduplicates and ignores breaks', () => {
  assert.deepEqual(setlistParticipants({ entries: [{ song }, { breakMinutes: 10 }, { song }] }), ['Bass', 'Guest']);
});
test('readiness uses only attendees with parts, with no players distinct from fully ready', () => {
  assert.equal(rehearsalReadiness(song), 63);
  assert.equal(rehearsalReadiness(song, ['Bass']), 100);
  assert.equal(rehearsalReadiness(song, ['Guest']), 25);
  assert.equal(rehearsalReadiness(song, []), null);
  assert.equal(rehearsalReadiness(song, ['Free']), null);
  assert.equal(rehearsalReadiness({ ...song, progress: {} }, ['Bass']), 0);
});
test('calendar starts on Monday, includes month boundaries, and is stable across DST', () => {
  const days = calendarDays(new Date(2026, 9, 1));
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1);
  assert.equal(localDate(days[0]), '2026-09-28');
  assert.equal(localDate(days.at(-1)), '2026-11-08');
  assert.equal(new Set(days.map(localDate)).size, 42);
});
test('upcoming uses the session time zone and stays visible through its day, excluding cancelled sessions', () => {
  const r = { date: '2026-10-15', startTime: '19:00', endTime: '21:00', timeZone: 'Europe/Berlin', cancelled: false };
  assert.equal(isUpcoming(r, new Date('2026-10-15T18:30:00Z')), true);
  assert.equal(isUpcoming(r, new Date('2026-10-15T19:01:00Z')), true);
  assert.equal(isUpcoming(r, new Date('2026-10-15T22:00:00Z')), false);
  assert.equal(isUpcoming({ ...r, cancelled: true }, new Date('2026-10-14T10:00:00Z')), false);
  assert.equal(isUpcoming({ ...r, endTime: undefined }, new Date('2026-10-15T20:00:00Z')), true);
});

test('default linked event is the nearest upcoming event after the rehearsal, including same-day events', () => {
  const setlists = [
    { id: 'undated', name: 'Undated' },
    { id: 'later', name: 'Later', date: '2026-10-20' },
    { id: 'past', name: 'Past', date: '2026-10-12' },
    { id: 'earlier-today', name: 'Earlier', date: '2026-10-15', startTime: '17:00' },
    { id: 'same-day', name: 'Tonight', date: '2026-10-15', startTime: '20:00' },
    { id: 'date-only', name: 'Date only', date: '2026-10-15' },
  ];
  assert.equal(closestUpcomingSetlist(setlists, '2026-10-15', '19:00').id, 'same-day');
  assert.equal(closestUpcomingSetlist(setlists, '2026-10-15', '21:00').id, 'date-only');
  assert.equal(closestUpcomingSetlist(setlists, '2026-10-16', '19:00').id, 'later');
  assert.equal(closestUpcomingSetlist(setlists, '2026-10-21', '19:00'), undefined);
});
test('setlists exclude past dates, include today regardless of start time, and place undated last without mutating source order', () => {
  const setlists = [
    { id: 'undated', name: 'Undated' },
    { id: 'future-later', name: 'Later', date: '2026-10-20' },
    { id: 'past-old', name: 'Old', date: '2026-10-01' },
    { id: 'future-next', name: 'Next', date: '2026-10-14' },
    { id: 'past-recent', name: 'Recent', date: '2026-10-12' },
    { id: 'today', name: 'Today', date: '2026-10-13', startTime: '10:00' },
  ];
  assert.deepEqual(upcomingSetlists(setlists, '2026-10-13').map(s => s.id), ['today', 'future-next', 'future-later', 'undated']);
  assert.equal(setlists[0].id, 'undated');
});
