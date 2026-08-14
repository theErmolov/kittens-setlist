import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSetlistLayout,
  moveLayoutEntry,
  moveLayoutEntryToSubset,
  moveSubsetBlock,
  moveSubsetBlockBy,
  normalizeSetlistLayout,
} from '../src/lib/setlistLayout.ts';

function songEntry(id, order, subsetId) {
  return {
    songId: id,
    song: { id, artist: 'Artist', title: id, category: 'mid', musicians: {} },
    order,
    played: false,
    ...(subsetId ? { subsetId } : {}),
  };
}

function layoutKinds(layout) {
  return layout.map(item => item.kind === 'subset' ? item.subset.id : item.entry.songId ?? 'pause');
}

test('legacy subsets retain their established order and normalize on mutation', () => {
  const subsets = [{ id: 'a', name: 'Set A' }, { id: 'b', name: 'Set B' }];
  const entries = [
    songEntry('a1', 0, 'a'),
    songEntry('b1', 1, 'b'),
    { breakMinutes: 10, order: 2, played: false },
    songEntry('pool', 3),
  ];

  const layout = buildSetlistLayout(entries, subsets);
  assert.deepEqual(layoutKinds(layout), ['a', 'b', 'pause', 'pool']);

  const normalized = normalizeSetlistLayout(layout);
  assert.deepEqual(normalized.subsets.map(subset => [subset.id, subset.order]), [['a', 0], ['b', 2]]);
  assert.deepEqual(normalized.entries.map(entry => [entry.songId ?? 'pause', entry.order]), [
    ['a1', 1], ['b1', 3], ['pause', 4], ['pool', 5],
  ]);
});

test('moving subset blocks leaves pauses in their visual gap', () => {
  const subsets = [{ id: 'a', name: 'Set A', order: 0 }, { id: 'b', name: 'Set B', order: 3 }];
  const entries = [
    songEntry('a1', 1, 'a'),
    { breakMinutes: 10, order: 2, played: false },
    songEntry('b1', 4, 'b'),
  ];

  const moved = moveSubsetBlock(buildSetlistLayout(entries, subsets), 'a', 'b');
  assert.deepEqual(layoutKinds(moved), ['b', 'pause', 'a']);

  const normalized = normalizeSetlistLayout(moved);
  assert.equal(normalized.entries.find(entry => entry.breakMinutes)?.order, 2);
  assert.deepEqual(normalized.subsets.map(subset => subset.id), ['b', 'a']);
});

test('mobile moves reorder empty and populated blocks together', () => {
  const subsets = [
    { id: 'empty', name: 'Empty', order: 0 },
    { id: 'full', name: 'Full', order: 1, manualSort: true },
  ];
  const entries = [songEntry('full1', 2, 'full')];

  const moved = moveSubsetBlockBy(buildSetlistLayout(entries, subsets), 'full', -1);
  const normalized = normalizeSetlistLayout(moved);
  assert.deepEqual(normalized.subsets.map(subset => subset.id), ['full', 'empty']);
  assert.equal(normalized.subsets[0].manualSort, true);
  assert.equal(normalized.entries[0].subsetId, 'full');
});

test('normalization never lets a pause inherit subset membership', () => {
  const normalized = normalizeSetlistLayout([
    { kind: 'entry', entry: { breakMinutes: 5, order: 8, played: false, subsetId: 'bad' } },
  ]);
  assert.equal(normalized.entries[0].subsetId, undefined);
  assert.equal(normalized.entries[0].order, 0);
});

test('a pause dropped inside a set snaps outside the complete block', () => {
  const subsets = [{ id: 'a', name: 'Set A', order: 0 }];
  const entries = [
    songEntry('a1', 1, 'a'),
    songEntry('a2', 2, 'a'),
    { breakMinutes: 10, order: 3, played: false },
  ];
  const layout = buildSetlistLayout(entries, subsets);

  const before = normalizeSetlistLayout(moveLayoutEntry(layout, 'break-3', 'a1', 'before'));
  assert.deepEqual(before.entries.map(entry => entry.songId ?? 'pause'), ['pause', 'a1', 'a2']);
  assert.equal(before.entries[0].subsetId, undefined);

  const after = normalizeSetlistLayout(moveLayoutEntry(layout, 'break-3', 'a2', 'after'));
  assert.deepEqual(after.entries.map(entry => entry.songId ?? 'pause'), ['a1', 'a2', 'pause']);
  assert.equal(after.entries[2].subsetId, undefined);
});

test('a pause can move across an empty subset header without splitting it', () => {
  const layout = buildSetlistLayout(
    [{ breakMinutes: 5, order: 1, played: false }],
    [{ id: 'empty', name: 'Empty', order: 0 }],
  );
  const moved = normalizeSetlistLayout(moveLayoutEntryToSubset(layout, 'break-1', 'empty', 'before'));
  assert.equal(moved.entries[0].order, 0);
  assert.equal(moved.subsets[0].order, 1);
  assert.equal(moved.entries[0].subsetId, undefined);
});

test('an unassigned song dragged toward an earlier gap remains in the trailing pool', () => {
  const subsets = [
    { id: 'a', name: 'Set A', order: 0 },
    { id: 'b', name: 'Set B', order: 3 },
  ];
  const entries = [
    songEntry('a1', 1, 'a'),
    { breakMinutes: 10, order: 2, played: false },
    songEntry('b1', 4, 'b'),
    songEntry('pool', 5),
  ];
  const layout = buildSetlistLayout(entries, subsets);
  const moved = normalizeSetlistLayout(moveLayoutEntry(layout, 'pool', 'break-2', 'before'));
  assert.deepEqual(moved.entries.map(entry => entry.songId ?? 'pause'), ['a1', 'pause', 'b1', 'pool']);
  assert.equal(moved.entries.at(-1).subsetId, undefined);
});
