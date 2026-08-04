import assert from 'node:assert/strict';
import test from 'node:test';
import peopleDomain from '../dist/lib/people-domain.js';
import { assertTargetParity, buildPeople, projectedRoster } from '../scripts/people-migration-lib.mjs';

const { mergeUserRecords, refreshTelegramIdentity, removeMusicianFields } = peopleDomain;

const legacyUsers = [
  { telegramId: '100', firstName: 'Ilya', status: 'approved', role: 'writer', musicianId: 'm1', createdAt: '2026-01-01' },
  { telegramId: '200', firstName: 'Reader', status: 'approved', createdAt: '2026-01-02' },
];
const musicians = [
  { id: 'm1', name: 'Илья', defaultInstruments: ['bass'], sortOrder: 0 },
  { id: 'm2', name: 'Андрей', defaultInstruments: ['drums'], sortOrder: 1 },
];

test('conversion combines linked users and keeps access-only and musician-only users', () => {
  const people = buildPeople(legacyUsers, musicians.map(musician => ({ ...musician, defaultInstrument: musician.defaultInstruments[0] })), 3);
  assert.deepEqual(people.find(person => person.id === 'm1'), {
    id: 'm1', telegramId: '100', firstName: 'Ilya', status: 'approved', role: 'writer', createdAt: '2026-01-01',
    musicianName: 'Илья', defaultInstruments: ['bass'], sortOrder: 0,
  });
  assert.equal(people.find(person => person.id === '200')?.musicianName, undefined);
  assert.equal(people.find(person => person.id === 'm2')?.telegramId, undefined);
  assert.deepEqual(projectedRoster(people), musicians);
});

test('conversion rejects duplicate and missing musician links', () => {
  assert.throws(() => buildPeople([...legacyUsers, { ...legacyUsers[1], telegramId: '300', musicianId: 'm1' }], musicians), /multiple/);
  assert.throws(() => buildPeople([{ ...legacyUsers[0], musicianId: 'missing' }], musicians), /missing musician/);
});

test('Telegram refresh preserves independent musician fields', () => {
  const existing = buildPeople(legacyUsers, musicians)[0];
  const refreshed = refreshTelegramIdentity(existing, {
    id: '100', firstName: 'New Telegram Name', username: 'new_name'
  }, '2026-08-04');
  assert.equal(refreshed.id, 'm1');
  assert.equal(refreshed.musicianName, 'Илья');
  assert.deepEqual(refreshed.defaultInstruments, ['bass']);
  assert.equal(refreshed.firstName, 'New Telegram Name');
});

test('merging uses the musician id and preserves its roster fields', () => {
  const merged = mergeUserRecords(
    { id: '200', telegramId: '200', firstName: 'Reader', status: 'pending', createdAt: '2026-01-02' },
    { id: 'm2', musicianName: 'Андрей', defaultInstruments: ['drums'], sortOrder: 1 },
  );
  assert.equal(merged.id, 'm2');
  assert.equal(merged.telegramId, '200');
  assert.equal(merged.musicianName, 'Андрей');
  assert.equal(merged.status, 'pending');
});

test('removing musician fields preserves Telegram access', () => {
  const user = removeMusicianFields({
    id: 'm1', telegramId: '100', firstName: 'Ilya', status: 'approved', createdAt: '2026-01-01',
    musicianName: 'Илья', defaultInstruments: ['bass'], sortOrder: 0,
  });
  assert.equal(user.telegramId, '100');
  assert.equal(user.status, 'approved');
  assert.equal(user.musicianName, undefined);
});

test('target parity detects partial migrations', () => {
  const people = buildPeople(legacyUsers, musicians);
  assert.doesNotThrow(() => assertTargetParity(people, people));
  assert.throws(() => assertTargetParity(people, people.slice(1)), /differ/);
});
