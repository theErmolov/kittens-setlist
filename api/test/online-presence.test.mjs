import assert from 'node:assert/strict';
import test from 'node:test';
import online from '../dist/handlers/online-presence.js';
import dynamo from '../dist/lib/dynamo.js';
import auth from '../dist/handlers/auth.js';
import api from '../dist/index.js';

const admin = { id: 'admin', status: 'approved', isAdmin: true };
const event = method => ({ rawPath: '/online-presence', requestContext: { http: { method } } });

test('online list is restricted to approved admins at the API boundary', async t => {
  const send = t.mock.method(dynamo.db, 'send', async () => { throw new Error('Unexpected database access'); });
  for (const [user, status] of [[null, 401], [{ id: 'reader', status: 'approved' }, 403], [{ ...admin, status: 'pending' }, 403]]) {
    t.mock.method(auth, 'resolveAuth', async () => user);
    assert.equal((await api.handler(event('GET'))).statusCode, status);
  }
  assert.equal(send.mock.callCount(), 0);
});

test('list reads all existing rooms across scan pages, excluding expired or invalid presence', async t => {
  const now = Math.floor(Date.now() / 1000);
  const live = [
    { room: 'backlog', clientId: 'one', userId: 'reader', name: 'Reader', expiresAt: now + 90 },
    { room: 'setlist:show', clientId: 'two', userId: 'reader', name: 'Reader', expiresAt: now + 90 },
    { room: 'setlist:show', clientId: 'guest', name: 'гость', expiresAt: now + 90 },
  ];
  let scans = 0;
  const cursor = { room: 'backlog', clientId: 'one' };
  t.mock.method(dynamo.db, 'send', async command => {
    assert.equal(command.constructor.name, 'ScanCommand');
    if (++scans === 1) {
      assert.equal(command.input.ExclusiveStartKey, undefined);
      return { Items: [live[0], { ...live[0], expiresAt: now }, { ...live[0], expiresAt: 'tomorrow' }], LastEvaluatedKey: cursor };
    }
    assert.deepEqual(command.input.ExclusiveStartKey, cursor);
    return { Items: [...live.slice(1), { ...live[0], room: '__online__' }] };
  });
  t.mock.method(auth, 'resolveAuth', async () => admin);
  const result = await api.handler(event('GET'));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), live);
  assert.equal(scans, 2);
});

test('online endpoint never writes presence', async t => {
  const send = t.mock.method(dynamo.db, 'send', async () => { throw new Error('Unexpected mutation'); });
  for (const method of ['POST', 'DELETE', 'PATCH']) {
    assert.equal((await online.onlinePresenceHandler(event(method), admin)).statusCode, 405);
  }
  assert.equal(send.mock.callCount(), 0);
});
