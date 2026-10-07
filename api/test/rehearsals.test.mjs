import assert from 'node:assert/strict';
import { beforeEach, after, test } from 'node:test';
import dynamo from '../dist/lib/dynamo.js';
import entrypoint from '../dist/index.js';
const { db } = dynamo;
const originalSend = db.send;
const tables = new Map();
const keyOf = item => JSON.stringify(item.token !== undefined ? [item.token] : item.pk !== undefined ? [item.pk, item.sk] : [item.id]);
const items = table => [...(tables.get(table)?.values() ?? [])];
function put(table, item) { if (!tables.has(table)) tables.set(table, new Map()); tables.get(table).set(keyOf(item), structuredClone(item)); }
function conditionalFailure() { const error = new Error('Changed'); error.name = 'ConditionalCheckFailedException'; throw error; }
let race = false;
db.send = async command => {
  const input = command.input;
  const current = tables.get(input.TableName)?.get(keyOf(input.Key ?? input.Item ?? {}));
  // DynamoDB rejects unused expression attributes; check this too.
  const expression = [input.UpdateExpression, input.ConditionExpression, input.KeyConditionExpression].filter(Boolean).join(' ');
  for (const name of Object.keys(input.ExpressionAttributeNames ?? {})) assert.ok(expression.includes(name), `Unused ${name}`);
  for (const value of Object.keys(input.ExpressionAttributeValues ?? {})) assert.ok(expression.includes(value), `Unused ${value}`);
  switch (command.constructor.name) {
    case 'GetCommand': return { Item: structuredClone(current) };
    case 'ScanCommand': return { Items: structuredClone(items(input.TableName)) };
    case 'QueryCommand': {
      const field = Object.values(input.ExpressionAttributeNames)[0], value = Object.values(input.ExpressionAttributeValues)[0];
      return { Items: structuredClone(items(input.TableName).filter(item => item[field] === value)) };
    }
    case 'PutCommand':
    case 'DeleteCommand': {
      if (race && input.ConditionExpression === '#version = :version') { current.version++; race = false; }
      if (input.ConditionExpression === '#version = :version' && current?.version !== input.ExpressionAttributeValues[':version']) conditionalFailure();
      if (input.ConditionExpression === 'attribute_not_exists(id)' && current) conditionalFailure();
      if (command.constructor.name === 'PutCommand') put(input.TableName, input.Item);
      else tables.get(input.TableName)?.delete(keyOf(input.Key));
      return {};
    }
    case 'UpdateCommand': {
      if (!current) conditionalFailure();
      const resolve = path => path.replace(/#[a-zA-Z]+/g, name => input.ExpressionAttributeNames[name]).replace(/\[(\d+)\]/g, '.$1').split('.');
      if (input.ConditionExpression !== 'attribute_exists(id)') {
        const conditionPath = resolve(input.ConditionExpression.split(' = ')[0]);
        const actual = conditionPath.reduce((item, part) => item?.[part], current);
        if (actual !== input.ExpressionAttributeValues[':songId']) conditionalFailure();
      }
      const [path, value] = input.UpdateExpression.slice(4).split(' = ');
      const segments = resolve(path);
      const last = segments.pop();
      const parent = segments.reduce((item, part) => item[part], current);
      if (value.startsWith('if_not_exists')) parent[last] ??= {};
      else parent[last] = input.ExpressionAttributeValues[':stage'];
      put(input.TableName, current);
      return {};
    }
    default: throw new Error(`Unexpected ${command.constructor.name}`);
  }
};
after(() => { db.send = originalSend; });
const song = { id: 's1', title: 'Catalog title', artist: 'Artist', category: 'mid', musicians: { Bass: { instruments: ['bass'] }, Guest: { instruments: ['violin'] } }, progress: { Bass: 'mastering', Guest: 'queue' }, personalComment: 'private' };
const arrangement = { ...song, title: 'Show arrangement', musicians: { ...song.musicians, Keys: { instruments: ['keys'] } }, progress: { Bass: 'structure', Guest: 'structure' } };
const only = { id: 'only', title: 'Only in this show', artist: 'Artist', category: 'mid', musicians: { Guest: { instruments: ['vocals'] } } };
const draft = { date: '2026-10-15', startTime: '19:00', endTime: '21:00', timeZone: 'Europe/Berlin', location: 'Studio', setlistId: 'show', attendees: ['Bass', 'Guest'], songs: [{ songId: 's1', sourceSetlistId: 'show', song: { title: 'Injected', personalComment: 'injected' } }, { songId: 'only', sourceSetlistId: 'show' }], cancelled: false };
beforeEach(() => {
  tables.clear(); race = false;
  put('kittens-people', { id: '__people_control__', activeStore: 'people' });
  for (const [id, role, status, isAdmin] of [['writer', 'writer', 'approved', false], ['reader', 'reader', 'approved', false], ['admin', 'reader', 'approved', true], ['pending', 'writer', 'pending', true]]) {
    put('kittens-people', { id, telegramId: id, role, status, isAdmin });
    put('kittens-sessions', { token: id, telegramId: id, expiresAt: Math.floor(Date.now() / 1000) + 3600 });
  }
  put('kittens-songs', song);
  put('kittens-setlists', { id: 'show', name: 'Show', entries: [{ songId: 's1', song: arrangement, order: 0, played: false }, { songId: 'only', song: only, setlistOnly: true, order: 1, played: false }] });
});
async function request(method, path, body, user = 'admin') {
  const response = await entrypoint.handler({ rawPath: path, requestContext: { stage: '$default', http: { method } }, headers: user ? { authorization: `Bearer ${user}` } : {}, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.statusCode, body: JSON.parse(response.body) };
}
const create = async data => (await request('POST', '/rehearsals', data ?? draft)).body;

test('every rehearsal operation is admin-only, including list/detail reads', async () => {
  const created = await create();
  for (const user of ['writer', 'reader', 'pending', null]) {
    for (const [method, path, body] of [['GET', '/rehearsals'], ['GET', `/rehearsals/${created.id}`], ['POST', '/rehearsals', draft], ['PUT', `/rehearsals/${created.id}`, created], ['DELETE', `/rehearsals/${created.id}`, { version: 1 }], ['PATCH', `/rehearsals/${created.id}/progress`, { songId: 's1', stage: 'ready', musicianName: 'Bass' }]]) {
      assert.equal((await request(method, path, body, user)).status, user === null ? 401 : 403);
    }
  }
  assert.equal((await request('GET', `/rehearsals/${created.id}`)).status, 200);
  assert.equal((await request('GET', '/rehearsals')).body.length, 1);
});

test('setlist arrangements remain distinct while canonical progress stays live; private notes never leak', async () => {
  const created = await create();
  assert.deepEqual(created.attendees, ['Bass', 'Guest']);
  assert.equal(created.songs[0].song.title, 'Show arrangement');
  assert.equal(created.songs[0].song.progress.Bass, 'mastering');
  assert.ok(!JSON.stringify(created).includes('private'));
  assert.ok(!JSON.stringify(items('kittens-rehearsals')).includes('personalComment'));
  put('kittens-songs', { ...song, progress: { Bass: 'ready', Guest: 'mastering' } });
  const refreshed = (await request('GET', `/rehearsals/${created.id}`)).body;
  assert.equal(refreshed.songs[0].song.progress.Guest, 'mastering');
  assert.equal(refreshed.songs[0].song.title, 'Show arrangement');
});

test('progress updates include unregistered guests, propagate across sessions, and preserve other progress', async () => {
  const first = await create(), second = await create();
  const result = await request('PATCH', `/rehearsals/${first.id}/progress`, { songId: 's1', sourceSetlistId: 'show', musicianName: 'Guest', stage: 'ready' });
  assert.equal(result.status, 200);
  assert.equal(result.body.songs[0].song.progress.Guest, 'ready');
  assert.equal(result.body.songs[0].song.progress.Bass, 'mastering');
  assert.equal((await request('GET', `/rehearsals/${second.id}`)).body.songs[0].song.progress.Guest, 'ready');
  assert.equal((await request('PATCH', `/rehearsals/${first.id}/progress`, { songId: 's1', sourceSetlistId: 'show', musicianName: 'Keys', stage: 'ready' })).status, 400);
});

test('setlist-only songs keep progress in their source and work across rehearsals', async () => {
  const first = await create(), second = await create();
  assert.equal((await request('PATCH', `/rehearsals/${first.id}/progress`, { songId: 'only', sourceSetlistId: 'show', musicianName: 'Guest', stage: 'mastering' })).status, 200);
  assert.equal((await request('GET', `/rehearsals/${second.id}`)).body.songs[1].song.progress.Guest, 'mastering');
  assert.equal(items('kittens-songs').length, 1);
});

test('independent selections, order and notes survive source edits, deletion, cancellation and restore', async () => {
  let created = await create();
  created.songs.reverse(); created.songs[0].note = 'Repeat the ending';
  created = (await request('PUT', `/rehearsals/${created.id}`, created)).body;
  assert.equal(created.songs[0].songId, 'only');
  assert.equal(created.songs[0].note, 'Repeat the ending');
  tables.get('kittens-setlists').clear();
  created = (await request('GET', `/rehearsals/${created.id}`)).body;
  assert.equal(created.songs[0].sourceMissing, true);
  assert.equal(created.songs[0].song.title, only.title);
  created = (await request('PUT', `/rehearsals/${created.id}`, { ...created, cancelled: true })).body;
  assert.equal(created.cancelled, true);
  assert.equal(created.songs.length, 2);
  assert.equal((await request('PUT', `/rehearsals/${created.id}`, { ...created, cancelled: false })).body.cancelled, false);
});

test('stale updates/deletes and conditional races return conflicts rather than overwriting', async () => {
  const created = await create();
  assert.equal((await request('PUT', `/rehearsals/${created.id}`, { ...created, location: 'New studio' })).status, 200);
  assert.equal((await request('PUT', `/rehearsals/${created.id}`, created)).status, 409);
  assert.equal((await request('DELETE', `/rehearsals/${created.id}`, { version: created.version })).status, 409);
  const latest = (await request('GET', `/rehearsals/${created.id}`)).body;
  race = true;
  assert.equal((await request('PUT', `/rehearsals/${created.id}`, { ...latest, location: 'Race' })).status, 409);
  assert.equal(items('kittens-rehearsals')[0].location, 'New studio');
  assert.equal((await request('DELETE', `/rehearsals/${created.id}`, { version: latest.version + 1 })).status, 200);
});

test('invalid dates, times, zones, references and malformed bodies are rejected', async () => {
  for (const patch of [{ date: '2026-02-30' }, { date: '2026-99-99' }, { startTime: '25:00' }, { endTime: '18:00' }, { timeZone: 'Invalid/Zone' }, { attendees: [null] }, { songs: [null] }, { cancelled: 'yes' }]) {
    assert.equal((await request('POST', '/rehearsals', { ...draft, ...patch })).status, 400);
  }
  for (const patch of [{ setlistId: 'missing' }, { songs: [{ songId: 'missing' }] }]) assert.equal((await request('POST', '/rehearsals', { ...draft, ...patch })).status, 404);
  assert.equal((await request('POST', '/rehearsals', null)).status, 400);
});

test('catalog-only rehearsal and duplicate references work without a linked setlist', async () => {
  const created = await create({ ...draft, setlistId: undefined, songs: [{ songId: 's1' }, { songId: 's1', sourceSetlistId: 'show' }], attendees: [] });
  assert.equal(created.songs.length, 1);
  assert.equal(created.setlistId, undefined);
  assert.equal(created.songs[0].song.title, 'Catalog title');
});


test('cancelled sessions and removed source songs cannot silently mutate progress', async () => {
  const created = await create();
  const cancelled = (await request('PUT', `/rehearsals/${created.id}`, { ...created, cancelled: true })).body;
  const change = { songId: 'only', sourceSetlistId: 'show', musicianName: 'Guest', stage: 'ready' };
  assert.equal((await request('PATCH', `/rehearsals/${created.id}/progress`, change)).status, 409);
  await request('PUT', `/rehearsals/${created.id}`, { ...cancelled, cancelled: false });
  tables.get('kittens-setlists').clear();
  assert.equal((await request('PATCH', `/rehearsals/${created.id}/progress`, change)).status, 409);
});

test('rehearsal audit events exclude preparation and private notes', async () => {
  const created = await create({ ...draft, note: 'Shared preparation text' });
  await request('PUT', `/rehearsals/${created.id}`, { ...created, cancelled: true });
  const audit = items('kittens-audit-log');
  assert.deepEqual(audit.map(item => item.action), ['rehearsal.create', 'rehearsal.update']);
  assert.ok(audit.every(item => item.entityType === 'rehearsal'));
  assert.ok(!JSON.stringify(audit).includes('Shared preparation text'));
  assert.ok(!JSON.stringify(audit).includes('private'));
});


test('repeat retains saved arrangements even after the linked setlist was deleted', async () => {
  const created = await create();
  tables.get('kittens-setlists').clear();
  const repeated = await request('POST', '/rehearsals', { ...created, copyFromId: created.id, date: '2026-10-22' });
  assert.equal(repeated.status, 201);
  assert.notEqual(repeated.body.id, created.id);
  assert.equal(repeated.body.songs[1].song.title, only.title);
  assert.equal(repeated.body.songs[1].sourceMissing, true);
  assert.equal(repeated.body.version, 1);
});
