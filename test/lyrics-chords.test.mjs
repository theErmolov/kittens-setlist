import assert from 'node:assert/strict';
import test from 'node:test';
import { isChordLine, firstChord, CHORD_FIND_SRC } from '../src/lib/lyricsChords.ts';

test('section labels and repeat annotations are recognized as chord lines', () => {
  for (const line of ['Кода: F Fm F }x2', 'Coda: F Fm F }x2', 'Припев 2: Am Cmaj7/G Dsus4', 'C Cmaj7 C }x2', 'Intro: (Am) | C | G (x2)', 'Am ×2']) {
    assert.equal(isChordLine(line), true, line);
  }
  assert.equal(firstChord('Кода: F Fm F }x2'), 'F');
  assert.equal(firstChord('Coda: F Fm F }x2'), 'F');
});

test('ordinary lyrics and empty section headings remain lyric lines', () => {
  for (const line of ['Кода:', 'Куплет 2:', 'Come as you are', 'Coda: sing this softly', 'Am I dreaming', 'Куда: F Fm', '']) {
    assert.equal(isChordLine(line), false, line);
  }
});

test('transpose chord matching excludes section label letters and preserves complete chords', () => {
  assert.deepEqual([...('Coda: F Fm Cmaj7/G }x2').matchAll(new RegExp(CHORD_FIND_SRC, 'g'))].map(match => match[0]), ['F', 'Fm', 'Cmaj7/G']);
});
