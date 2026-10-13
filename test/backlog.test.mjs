import assert from 'node:assert/strict';
import test from 'node:test';
import { isSetlistOpen, matchesBacklogFilters } from '../src/lib/backlog.ts';

const song = {
  artist: 'Музыкальные Котятки', title: 'Summer Song', category: 'mid',
  musicians: {
    Bass: { instruments: ['bass', 'vocals'] },
    Guitar: { instruments: ['guitar'] },
    Guest: { instruments: ['violin'] },
    Idle: { instruments: [] },
  },
};
const matches = ({ search = '', categories = [], musicians = [], instruments = [] } = {}) =>
  matchesBacklogFilters(song, search, new Set(categories), new Set(musicians), new Set(instruments));

test('backlog musician selection requires every selected person to have a part', () => {
  assert.equal(matches(), true);
  assert.equal(matches({ musicians: ['Bass', 'Guitar'] }), true);
  assert.equal(matches({ musicians: ['Bass', 'Guest'] }), true);
  assert.equal(matches({ musicians: ['Bass', 'Idle'] }), false);
  assert.equal(matches({ musicians: ['Bass', 'Missing'] }), false);
});

test('instrument selection is OR, scoped to selected musicians rather than the whole song', () => {
  assert.equal(matches({ instruments: ['keys', 'violin'] }), true);
  assert.equal(matches({ instruments: ['keys', 'drums'] }), false);
  assert.equal(matches({ musicians: ['Bass'], instruments: ['violin'] }), false);
  assert.equal(matches({ musicians: ['Bass', 'Guitar'], instruments: ['keys', 'guitar'] }), true);
  assert.equal(matches({ musicians: ['Bass'], instruments: ['vocals'] }), true);
});

test('search matches artist or title without case sensitivity and combines with other filters', () => {
  assert.equal(matches({ search: 'КОТЯТКИ' }), true);
  assert.equal(matches({ search: 'summer', categories: ['top', 'mid'], musicians: ['Bass'] }), true);
  assert.equal(matches({ search: 'summer', categories: ['low'] }), false);
  assert.equal(matches({ search: 'winter' }), false);
});

test('add-to-setlist window closes exactly 24 hours after the local start time', () => {
  const setlist = { date: '2026-10-13', startTime: '19:30' };
  const start = new Date('2026-10-13T19:30').getTime();
  const day = 24 * 60 * 60 * 1000;
  assert.equal(isSetlistOpen(setlist, start - day), true);
  assert.equal(isSetlistOpen(setlist, start + day - 1), true);
  assert.equal(isSetlistOpen(setlist, start + day), false);
  assert.equal(isSetlistOpen(setlist, start + day + 1), false);
  assert.equal(isSetlistOpen({ date: '2026-10-13' }, new Date('2026-10-14T00:00').getTime()), false);
  assert.equal(isSetlistOpen({}, start), true);
  assert.equal(isSetlistOpen({ date: 'invalid' }, start), true);
});
