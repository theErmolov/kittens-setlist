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
