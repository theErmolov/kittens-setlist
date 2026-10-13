import assert from 'node:assert/strict';
import test from 'node:test';
import entriesDomain from '../dist/lib/setlist-entries.js';

const { appendSongsToSetlist, normalizeSubsetNames } = entriesDomain;

const song = {
  id: 'catalog-song',
  artist: 'Artist',
  title: 'Title',
  category: 'mid',
  comment: 'Entry note',
  musicians: {},
};

test('setlist-only songs get a server id and remain entry snapshots', () => {
  const setlist = {
    id: 'setlist',
    name: 'Show',
    subsets: [{ id: 'set-a', name: 'Set A', order: 4 }],
    entries: [{ breakMinutes: 10, order: 2, played: false }],
  };

  const { updated, newEntries } = appendSongsToSetlist(setlist, [song], true, () => 'setlist-song');
  assert.equal(newEntries.length, 1);
  assert.equal(newEntries[0].songId, 'setlist-song');
  assert.equal(newEntries[0].song.id, 'setlist-song');
  assert.equal(newEntries[0].setlistOnly, true);
  assert.equal(newEntries[0].comment, 'Entry note');
  assert.equal(newEntries[0].order, 5);
  assert.equal(updated.entries.length, 2);
});

test('catalog additions stay idempotent', () => {
  const setlist = {
    id: 'setlist',
    name: 'Show',
    entries: [{ songId: song.id, song, order: 0, played: false }],
  };
  const { newEntries } = appendSongsToSetlist(setlist, [song], false);
  assert.deepEqual(newEntries, []);
});

test('subset names are trimmed and blank names are rejected', () => {
  assert.deepEqual(normalizeSubsetNames([{ id: 'a', name: '  Set A  ' }]), [{ id: 'a', name: 'Set A' }]);
  assert.equal(normalizeSubsetNames([{ id: 'a', name: '   ' }]), null);
});

test('catalog additions deduplicate both existing entries and repeats in one batch', () => {
  const other = { ...song, id: 'other' };
  const setlist = {
    id: 'show', name: 'Show',
    entries: [{ songId: song.id, song, order: 3, played: true }],
    subsets: [{ id: 'empty', name: 'Empty', order: 8 }],
  };
  const before = structuredClone(setlist);
  const { updated, newEntries } = appendSongsToSetlist(setlist, [song, other, other], false);
  assert.deepEqual(newEntries.map(e => [e.songId, e.order, e.played]), [['other', 9, false]]);
  assert.deepEqual(updated.entries[0], before.entries[0]);
  assert.deepEqual(setlist, before);
  assert.deepEqual(appendSongsToSetlist(updated, [other], false).newEntries, []);
});

test('setlist-only copies receive distinct ids even when the same source is selected twice', () => {
  let id = 0;
  const setlist = { id: 'show', name: 'Show', entries: [] };
  const result = appendSongsToSetlist(setlist, [song, song], true, () => `copy-${++id}`);
  assert.deepEqual(result.newEntries.map(e => [e.songId, e.song.id, e.order, e.setlistOnly]), [
    ['copy-1', 'copy-1', 0, true], ['copy-2', 'copy-2', 1, true],
  ]);
  assert.equal(song.id, 'catalog-song');
  assert.deepEqual(setlist.entries, []);
});
