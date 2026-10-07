import assert from 'node:assert/strict';
import test from 'node:test';
import { packLyricsColumns } from '../src/lib/lyricsLayout.ts';
const chord = text => ({ chordLine: 'Am', lyricLine: text });
const lyric = text => ({ chordLine: null, lyricLine: text });

test('lyric-only verses fill the second column by height, not first-column pair count', () => {
  const pairs = [...Array.from({ length: 4 }, (_, i) => chord(`Chord ${i}`)), ...Array.from({ length: 8 }, (_, i) => lyric(`Verse ${i}`))];
  const columns = packLyricsColumns(pairs, 10, 80);
  assert.equal(columns.length, 2);
  assert.equal(columns[0].length, 4);
  assert.equal(columns[1].length, 8);
  assert.deepEqual(columns.flat(), pairs);
});

test('chord/lyric pairs stay together at column and page boundaries', () => {
  const pairs = [lyric('Heading'), chord('First'), chord('Second'), lyric('Tail')];
  const columns = packLyricsColumns(pairs, 10, 40);
  assert.deepEqual(columns.map(column => column.length), [2, 2]);
  for (const column of columns) {
    assert.ok(column.reduce((height, pair) => height + (pair.chordLine !== null ? 2 : 1) * 10, 0) <= 40);
  }
  assert.deepEqual(columns.flat(), pairs);
});

test('blank lines, trailing verses and empty chord lines are preserved across pages', () => {
  const pairs = [chord('First'), lyric(''), { chordLine: '', lyricLine: 'Second' }, lyric('Last verse')];
  const columns = packLyricsColumns(pairs, 10, 30);
  assert.equal(columns.length, 2);
  assert.deepEqual(columns.flat(), pairs);
  assert.equal(columns.at(-1).at(-1).lyricLine, 'Last verse');
  assert.deepEqual(packLyricsColumns([], 10, 30), [[]]);
});
