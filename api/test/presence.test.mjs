import assert from 'node:assert/strict';
import test from 'node:test';
import dynamo from '../dist/lib/dynamo.js';
import presence from '../dist/handlers/presence.js';

const now = 1791892800;
const heartbeat = (user, body = { clientId: 'self' }) => presence.presenceHandler({
  requestContext: { http: { method: 'POST' } }, body: JSON.stringify(body),
}, '/presence/setlist%3Ashow', user);
const live = (clientId, extra = {}) => ({ room: 'setlist:show', clientId, expiresAt: now + 90, ...extra });

// Mock only the AWS client boundary; execute the real handler and query helper.
test('heartbeat filters expired/self entries across all query pages, while retaining another tab of the same user', async t => {
  t.mock.method(Date, 'now', () => now * 1000);
  const writes = [];
  let queries = 0;
  const cursor = { room: 'setlist:show', clientId: 'self' };
  t.mock.method(dynamo.db, 'send', async command => {
    const input = command.input;
    if (command.constructor.name === 'PutCommand') { writes.push(input.Item); return {}; }
    assert.equal(command.constructor.name, 'QueryCommand');
    assert.deepEqual(input.ExpressionAttributeValues, { ':value': 'setlist:show' });
    if (++queries === 1) {
      assert.equal(input.ExclusiveStartKey, undefined);
      return { Items: [live('self'), live('expired', { expiresAt: now }), live('invalid', { expiresAt: 'tomorrow' })], LastEvaluatedKey: cursor };
    }
    assert.deepEqual(input.ExclusiveStartKey, cursor);
    return { Items: [live('second-tab', { userId: 'reader', canMark: false }), live('writer', { canMark: true })] };
  });
  const result = await heartbeat({ id: 'reader', status: 'approved', role: 'reader' });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body).others.map(o => o.clientId), ['second-tab', 'writer']);
  assert.equal(queries, 2);
  assert.equal(writes[0].room, 'setlist:show');
  assert.equal(writes[0].clientId, 'self');
  assert.equal(writes[0].userId, 'reader');
  assert.equal(writes[0].canMark, false);
  assert.equal(writes[0].expiresAt, now + 90);
});

test('heartbeat derives identity and mutation rights on the server rather than trusting the body', async t => {
  const writes = [];
  t.mock.method(dynamo.db, 'send', async command => {
    if (command.constructor.name === 'PutCommand') { writes.push(command.input.Item); return {}; }
    assert.equal(command.constructor.name, 'QueryCommand');
    return { Items: [] };
  });
  for (const [user, canMark, name] of [
    [null, false, 'гость'],
    [{ id: 'r', role: 'reader', firstName: 'Reader' }, false, 'Reader'],
    [{ id: 'w', role: 'writer', firstName: 'Band', lastName: 'Writer' }, true, 'Band Writer'],
    [{ id: 'a', isAdmin: true, role: 'reader', musicianName: 'Admin' }, true, 'Admin'],
  ]) {
    const result = await heartbeat(user, { clientId: 'self', canMark: true, userId: 'forged', name: 'Forged' });
    assert.equal(result.statusCode, 200);
    const saved = writes.at(-1);
    assert.equal(saved.canMark, canMark);
    assert.equal(saved.name, name);
    assert.equal(saved.userId, user?.id);
  }
});

test('leaving removes only the requested tab from the decoded room', async t => {
  const send = t.mock.method(dynamo.db, 'send', async command => {
    assert.equal(command.constructor.name, 'DeleteCommand');
    assert.deepEqual(command.input.Key, { room: 'setlist:show', clientId: 'self' });
    return {};
  });
  const result = await presence.presenceHandler({ requestContext: { http: { method: 'DELETE' } }, queryStringParameters: { clientId: 'self' } }, '/presence/setlist%3Ashow', null);
  assert.equal(result.statusCode, 200);
  assert.equal(send.mock.callCount(), 1);
});

test('missing client ids and malformed JSON never reach DynamoDB', async t => {
  const send = t.mock.method(dynamo.db, 'send', async () => { throw new Error('Unexpected AWS call'); });
  for (const event of [
    { requestContext: { http: { method: 'POST' } }, body: '{}' },
    { requestContext: { http: { method: 'POST' } }, body: '{' },
    { requestContext: { http: { method: 'DELETE' } } },
  ]) {
    assert.equal((await presence.presenceHandler(event, '/presence/backlog', null)).statusCode, 400);
  }
  assert.equal(send.mock.callCount(), 0);
});
