import assert from 'node:assert/strict';
import test from 'node:test';
import { countByMusician, guestMusicianNames, playsInSong } from '../src/lib/musicianStats.ts';

const songs = [
  { musicians: { Anna: { instruments: ['guitar'] }, Boris: { instruments: [] }, Zed: { instruments: ['violin'] } } },
  { musicians: { Anna: { instruments: ['bass'] }, Guest: { instruments: ['keys'] } } },
  undefined, // a break entry
  { musicians: { Idle: { instruments: [] } } },
];

test('playsInSong needs at least one instrument', () => {
  assert.equal(playsInSong(songs[0], 'Anna'), true);
  assert.equal(playsInSong(songs[0], 'Boris'), false);
  assert.equal(playsInSong(songs[0], 'Nobody'), false);
  assert.equal(playsInSong(undefined, 'Anna'), false);
});

test('countByMusician counts songs per name and skips missing songs', () => {
  assert.deepEqual(countByMusician(songs, ['Anna', 'Boris', 'Zed', 'Nobody']), { Anna: 2, Boris: 0, Zed: 1, Nobody: 0 });
  assert.deepEqual(countByMusician([], ['Anna']), { Anna: 0 });
});

test('guestMusicianNames lists sorted non-band musicians who play', () => {
  assert.deepEqual(guestMusicianNames(songs, new Set(['Anna', 'Boris'])), ['Guest', 'Zed']);
  assert.deepEqual(guestMusicianNames(songs, new Set(['Anna', 'Zed', 'Guest'])), []);
});
