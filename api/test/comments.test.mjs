import assert from 'node:assert/strict';
import { beforeEach, after, test } from 'node:test';
import dynamo from '../dist/lib/dynamo.js';
import entrypoint from '../dist/index.js';
const { db } = dynamo;
const originalSend = db.send;
const tables = new Map();
const keyOf = item => JSON.stringify(item.scope !== undefined ? [item.scope, item.key] : item.token !== undefined ? [item.token] : item.pk !== undefined ? [item.pk, item.sk] : [item.id]);
const items = table => [...(tables.get(table)?.values() ?? [])];
function put(table, item) {
  if (!tables.has(table)) tables.set(table, new Map());
  tables.get(table).set(keyOf(item), structuredClone(item));
}
db.send = async command => {
  const input = command.input;
  switch (command.constructor.name) {
    case 'GetCommand': return { Item: structuredClone(tables.get(input.TableName)?.get(keyOf(input.Key))) };
    case 'PutCommand': put(input.TableName, input.Item); return {};
    case 'DeleteCommand': tables.get(input.TableName)?.delete(keyOf(input.Key)); return {};
    case 'ScanCommand': return { Items: structuredClone(items(input.TableName)) };
    case 'QueryCommand': {
      const field = Object.values(input.ExpressionAttributeNames)[0];
      const value = Object.values(input.ExpressionAttributeValues)[0];
      return { Items: structuredClone(items(input.TableName).filter(item => item[field] === value)) };
    }
    default: throw new Error(`Unexpected ${command.constructor.name}`);
  }
};
after(() => { db.send = originalSend; });
const song = { id: 's1', artist: 'Artist', title: 'Song', category: 'mid', musicians: {} };
beforeEach(() => {
  tables.clear();
  put('kittens-people', { id: '__people_control__', activeStore: 'people' });
  for (const [id, role, status, isAdmin] of [['a', 'writer', 'approved', false], ['b', 'reader', 'approved', false], ['admin', 'writer', 'approved', true], ['pending', 'reader', 'pending', false]]) {
    put('kittens-people', { id, telegramId: id, role, status, isAdmin });
    put('kittens-sessions', { token: id, telegramId: id, expiresAt: Math.floor(Date.now() / 1000) + 3600 });
  }
  put('kittens-songs', song);
  put('kittens-setlists', { id: 'show', name: 'Show', entries: [] });
});
async function request(method, path, body, user = 'a') {
  const response = await entrypoint.handler({ rawPath: path, requestContext: { stage: '$default', http: { method } }, headers: user ? { authorization: `Bearer ${user}` } : {}, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.statusCode, headers: response.headers, body: JSON.parse(response.body) };
}
const saveBacklog = (comment, user) => request('PATCH', '/songs/s1/personal-comment', { comment, authorId: 'admin' }, user);
const addSong = () => request('POST', '/setlists/show/songs', { songs: [song] });

test('private notes belong to the authenticated author; readers can edit only personal notes', async () => {
  assert.equal((await saveBacklog('A private', 'a')).status, 200);
  assert.equal((await saveBacklog('B private', 'b')).status, 200);
  assert.equal((await request('GET', '/songs/s1', undefined, 'a')).body.personalComment, 'A private');
  assert.equal((await request('GET', '/songs/s1', undefined, 'b')).body.personalComment, 'B private');
  assert.equal((await request('GET', '/songs/s1', undefined, 'admin')).body.personalComment, undefined);
  assert.equal((await request('PUT', '/songs/s1', song, 'b')).status, 403);
  assert.equal((await saveBacklog('Blocked', 'pending')).status, 403);
  assert.equal((await saveBacklog('Blocked', null)).status, 401);
  assert.equal(items('kittens-audit-log').length, 0);
});

test('adding copies every author’s note; backlog and different setlists stay independent', async () => {
  await saveBacklog('A original', 'a');
  await saveBacklog('B original', 'b');
  await addSong();
  await saveBacklog('A backlog changed', 'a');
  assert.equal((await request('GET', '/setlists/show', undefined, 'a')).body.entries[0].personalComment, 'A original');
  assert.equal((await request('GET', '/setlists/show', undefined, 'b')).body.entries[0].personalComment, 'B original');
  await request('PATCH', '/setlists/show/personal-comment', { songId: 's1', comment: 'A show changed' });
  await addSong();
  assert.equal((await request('GET', '/setlists/show')).body.entries[0].personalComment, 'A show changed');
  assert.equal((await request('GET', '/songs/s1')).body.personalComment, 'A backlog changed');
  put('kittens-setlists', { id: 'other', name: 'Other', entries: [] });
  const second = await request('POST', '/setlists/other/songs', { songs: [song] });
  assert.equal(second.body.entries[0].personalComment, 'A backlog changed');
});

test('public stage, pending users and admins cannot see other authors’ notes', async () => {
  await saveBacklog('A private', 'a');
  await saveBacklog('B private', 'b');
  await addSong();
  for (const user of [null, 'pending', 'admin']) {
    const response = await request('GET', '/setlists/show', undefined, user);
    assert.equal(response.status, 200);
    assert.equal(response.headers['Cache-Control'], 'private, no-store');
    assert.equal(response.body.entries[0].personalComment, undefined);
    assert.ok(!JSON.stringify(response.body).includes('private'));
  }
  const played = await request('POST', '/setlists/show/played', { songId: 's1' });
  assert.equal(played.body.entries[0].personalComment, 'A private');
  assert.ok(!JSON.stringify(played.body).includes('B private'));
  assert.equal((await request('GET', '/setlists', undefined, 'b')).body[0].entries[0].personalComment, 'B private');
});

test('reorder and shared song saves cannot persist private projections or wipe notes', async () => {
  await saveBacklog('A private', 'a');
  await addSong();
  const setlist = (await request('GET', '/setlists/show')).body;
  setlist.entries[0].song.personalComment = 'Injected nested note';
  const reordered = await request('PUT', '/setlists/show/order', { entries: setlist.entries });
  assert.equal(reordered.body.entries[0].personalComment, 'A private');
  assert.ok(!JSON.stringify(items('kittens-setlists')).includes('personalComment'));
  await request('PUT', '/songs/s1', { ...song, personalComment: 'Injected note' });
  assert.ok(!JSON.stringify(items('kittens-songs')).includes('personalComment'));
  assert.equal((await request('GET', '/songs/s1')).body.personalComment, 'A private');
  assert.ok(!JSON.stringify(items('kittens-audit-log')).includes('Injected'));
});

test('clear, remove/re-add and setlist-only songs have independent note lifecycles', async () => {
  await saveBacklog('Original', 'a');
  await addSong();
  await request('PATCH', '/setlists/show/personal-comment', { songId: 's1', comment: 'Show only' });
  await request('DELETE', '/setlists/show/songs/s1');
  await addSong();
  assert.equal((await request('GET', '/setlists/show')).body.entries[0].personalComment, 'Original');
  await saveBacklog('', 'a');
  assert.equal((await request('GET', '/songs/s1')).body.personalComment, undefined);
  assert.equal((await request('GET', '/setlists/show')).body.entries[0].personalComment, 'Original');
  const added = await request('POST', '/setlists/show/songs', { songs: [song], setlistOnly: true });
  await request('PATCH', '/setlists/show/personal-comment', { songId: added.body.entries.at(-1).songId, comment: 'Only in show' });
  assert.equal((await request('GET', '/setlists/show')).body.entries.at(-1).personalComment, 'Only in show');
  await request('DELETE', '/setlists/show');
  assert.equal(items('kittens-personal-comments').length, 0);
});

test('shared setlist notes are public and writable only by writers/admins', async () => {
  assert.equal((await request('PATCH', '/setlists/show/comment', { comment: 'Start at 19:30\nAcoustic first' }, 'b')).status, 403);
  assert.equal((await request('PATCH', '/setlists/show/comment', { comment: 'Start at 19:30\nAcoustic first' })).status, 200);
  assert.equal((await request('GET', '/setlists/show', undefined, null)).body.comment, 'Start at 19:30\nAcoustic first');
  assert.equal((await request('GET', '/setlists')).body[0].comment, 'Start at 19:30\nAcoustic first');
});

test('note endpoints reject missing songs and invalid text', async () => {
  assert.equal((await request('PATCH', '/songs/missing/personal-comment', { comment: 'x' })).status, 404);
  assert.equal((await request('PATCH', '/setlists/show/personal-comment', { songId: 'missing', comment: 'x' })).status, 404);
  assert.equal((await saveBacklog('x'.repeat(4001), 'a')).status, 400);
  assert.equal((await request('PATCH', '/songs/s1/personal-comment', { comment: {} })).status, 400);
});
