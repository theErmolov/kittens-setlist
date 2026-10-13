import assert from 'node:assert/strict';
import test from 'node:test';
import { countChanges, sortSubset } from '../src/lib/subsetSort.ts';

const song = (id, parts = {}) => ({ id, musicians: Object.fromEntries(
  Object.entries(parts).map(([name, instruments]) => [name, { instruments }]),
) });
const bass = song('bass', { Player: ['bass'] });
const guitar = song('guitar', { Player: ['guitar'] });
const idle = song('idle');

// Independent, exhaustive scoring oracle: track each musician's last played index.
function score(songs, anchors = []) {
  const recent = new Map();
  let cost = 0;
  const tail = anchors.slice(-2);
  [...tail, ...songs].forEach((s, index) => {
    for (const [name, role] of Object.entries(s.musicians)) {
      const instruments = role.instruments.filter(i => i !== 'vocals').sort().join(',');
      if (!instruments) continue;
      const previous = recent.get(name);
      if (index >= tail.length && previous) {
        const gap = index - previous.index;
        if (gap === 2 || (gap === 1 && previous.instruments !== instruments)) cost++;
      }
      recent.set(name, { index, instruments });
    }
  });
  return cost;
}
function* permutations(songs) {
  if (!songs.length) { yield []; return; }
  for (let i = 0; i < songs.length; i++) {
    for (const rest of permutations(songs.filter((_, j) => i !== j))) yield [songs[i], ...rest];
  }
}
function freezeSongs(songs) {
  for (const s of songs) {
    for (const role of Object.values(s.musicians)) { Object.freeze(role.instruments); Object.freeze(role); }
    Object.freeze(s.musicians); Object.freeze(s);
  }
  return Object.freeze(songs);
}

test('cost ignores vocals and instrument-array order, but counts literal instrument swaps', () => {
  assert.equal(countChanges([bass, bass]), 0);
  assert.equal(countChanges([bass, guitar]), 1);
  assert.equal(countChanges([song('a', { P: ['bass', 'vocals', 'keys'] }), song('b', { P: ['keys', 'bass'] })]), 0);
  assert.equal(countChanges([song('a', { P: ['vocals'] }), song('b', { P: ['vocals'], Guest: ['violin'] })]), 0);
});

test('returning after one song off costs a change even with the same instrument; a longer break is free', () => {
  assert.equal(countChanges([bass, idle, bass]), 1);
  assert.equal(countChanges([bass, idle, guitar]), 1);
  assert.equal(countChanges([bass, idle, idle, guitar]), 0);
  assert.equal(countChanges([bass], [bass, idle]), 1);
  assert.equal(countChanges([guitar], [bass]), 1);
  assert.equal(countChanges([guitar], [bass, idle, idle]), 0);
});

test('exact sorting attains the exhaustive optimum, including guests and both preceding anchors', () => {
  const songs = freezeSongs([
    song('a', { P: ['bass'], Guest: ['violin'] }),
    song('b', { P: ['guitar'] }),
    song('c', { Guest: ['keys'] }),
    song('d', { P: ['bass'], Guest: ['violin'] }),
    song('e', { P: ['vocals'] }),
    song('f', { P: ['guitar'], Guest: ['keys'] }),
  ]);
  for (const anchors of [[], [bass], [bass, idle], [idle, guitar], [guitar, bass, idle]]) {
    let minimum = Infinity;
    for (const order of permutations(songs)) {
      const expected = score(order, anchors);
      assert.equal(countChanges(order, anchors), expected);
      minimum = Math.min(minimum, expected);
    }
    const sorted = sortSubset(songs, anchors);
    assert.equal(score(sorted, anchors), minimum);
    assert.deepEqual([...sorted].sort((a, b) => a.id.localeCompare(b.id)), songs);
    assert.deepEqual(sortSubset(songs, anchors), sorted);
  }
});

test('ten-song exact branch groups alternating instruments without losing entries', () => {
  const songs = freezeSongs(Array.from({ length: 10 }, (_, i) => song(String(i), { P: [i % 2 ? 'guitar' : 'bass'] })));
  const sorted = sortSubset(songs, [bass]);
  assert.equal(countChanges(sorted, [bass]), 1);
  assert.equal(new Set(sorted).size, songs.length);
});

test('large-set heuristic improves a disruptive alternating order and preserves frozen input', () => {
  const songs = freezeSongs(Array.from({ length: 12 }, (_, i) => song(String(i), { P: [i % 2 ? 'guitar' : 'bass'] })));
  const sorted = sortSubset(songs, [bass]);
  assert.ok(score(sorted, [bass]) < score(songs, [bass]));
  assert.equal(new Set(sorted).size, songs.length);
  assert.ok(sorted.every(s => songs.includes(s)));
  assert.deepEqual(sortSubset(songs, [bass]), sorted);
});

test('empty and single-song subsets have no artificial changes', () => {
  assert.deepEqual(sortSubset([]), []);
  assert.deepEqual(sortSubset([bass]), [bass]);
  assert.equal(countChanges([]), 0);
});
