import test from 'node:test';
import assert from 'node:assert/strict';
import { fillMissing, rng } from '../scripts/mock-generators.mjs';

const me = { id: 'real-admin', firstName: 'Admin', status: 'approved', role: 'writer', isAdmin: true };

test('generates every category from nothing, consistently linked', () => {
  const data = { me };
  const generated = fillMissing(data);
  assert.deepEqual(generated.sort(), ['audit', 'budget', 'musicians', 'notificationPreferences', 'rehearsals', 'setlists', 'songs', 'users'].sort());
  const names = new Set(data.musicians.map(m => m.name));
  assert.ok(data.musicians.length >= 4);
  assert.ok(data.songs.every(s => Object.keys(s.musicians).some(n => names.has(n))));
  const songIds = new Set(data.songs.map(s => s.id));
  assert.ok(data.setlists.every(sl => sl.entries.every(e => songIds.has(e.songId))));
  assert.ok(data.rehearsals.every(r => r.songs.every(s => songIds.has(s.songId))));
  assert.ok(data.users.some(u => u.id === me.id) && data.users.some(u => u.status === 'pending'));
  assert.ok(data.budget.some(b => b.kind === 'income') && data.budget.some(b => b.kind === 'debt'));
  assert.ok(data.presence.length > 0);
});

test('keeps fetched categories and only fills the empty ones from them', () => {
  const musicians = [{ id: 'm1', name: 'Реал' }];
  const songs = [{ id: 's1', artist: 'A', title: 'T', category: 'mid', musicians: { 'Реал': { instruments: ['guitar'] } } }];
  const setlists = [{ id: 'sl1', name: 'Мой сет', entries: [], subsets: [] }];
  const data = { me, users: [me, { id: 'u2', status: 'approved' }], musicians, songs, setlists, rehearsals: [], budget: undefined, audit: [] };
  const generated = fillMissing(data);
  assert.deepEqual(generated.sort(), ['audit', 'budget', 'notificationPreferences', 'rehearsals'].sort());
  assert.equal(data.songs, songs);
  assert.equal(data.setlists[0].name, 'Мой сет');
  assert.ok(data.rehearsals.every(r => r.setlistId === 'sl1' && r.songs.every(s => s.songId === 's1')));
  assert.ok(data.budget.every(b => !b.setlistId || b.setlistId === 'sl1'));
});

test('is deterministic', () => {
  const a = rng(5), b = rng(5);
  assert.deepEqual([a.next(), a.next()], [b.next(), b.next()]);
  const x = { me }, y = { me };
  fillMissing(x); fillMissing(y);
  assert.deepEqual(x.songs, y.songs);
});
