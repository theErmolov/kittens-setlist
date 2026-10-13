import assert from 'node:assert/strict';
import test from 'node:test';
import auth from '../dist/handlers/auth.js';
import people from '../dist/lib/people.js';
import dynamo from '../dist/lib/dynamo.js';
import telegram from '../dist/lib/telegram.js';

const signed = {
  username: 'test_user', id: '42', last_name: 'Musician',
  auth_date: '1791892800', first_name: 'Test',
  hash: 'c9f4e2cba986bc9b4841d3134841b682c99012104ee34f97719db9be1828a6a6',
};
const admin = { id: 'admin', telegramId: '100', status: 'approved', isAdmin: true };
const event = body => ({ requestContext: { http: { method: 'POST' } }, body: JSON.stringify(body) });

function setup(t, existing, recipient = admin) {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousRecipient = process.env.AUTH_APPROVAL_TELEGRAM_ID;
  process.env.TELEGRAM_BOT_TOKEN = '123456:test-token';
  process.env.AUTH_APPROVAL_TELEGRAM_ID = '100';
  t.after(() => {
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
    if (previousRecipient === undefined) delete process.env.AUTH_APPROVAL_TELEGRAM_ID;
    else process.env.AUTH_APPROVAL_TELEGRAM_ID = previousRecipient;
  });
  t.mock.method(Date, 'now', () => 1791892800 * 1000);
  t.mock.method(people, 'mutationsAreLocked', async () => false);
  let saved = existing;
  t.mock.method(people, 'getUserByTelegramId', async id => id === '100' ? recipient : saved);
  t.mock.method(people, 'saveUser', async user => { saved = user; });
  const sessions = t.mock.method(dynamo.db, 'send', async command => {
    assert.equal(command.constructor.name, 'PutCommand');
    assert.equal(command.input.Item.telegramId, '42');
    return {};
  });
  t.mock.method(console, 'warn', () => {});
  return { sessions };
}

test('new signed login persists the session and sends one direct notification to the configured admin', async t => {
  const { sessions } = setup(t);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(sessions.mock.callCount(), 1);
    assert.equal(url, 'https://api.telegram.org/bot123456:test-token/sendMessage');
    assert.equal(options.method, 'POST');
    assert.ok(options.signal instanceof AbortSignal);
    requests.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  const result = await auth.authHandler(event(signed), '/auth/telegram');
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).user.status, 'pending');
  assert.ok(JSON.parse(result.body).token);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].chat_id, '100');
  assert.match(requests[0].text, /Test Musician \(@test_user\)/);
  assert.equal(requests[0].parse_mode, undefined);
  assert.deepEqual(requests[0].reply_markup.inline_keyboard, [[{
    text: 'Открыть пользователей', url: 'https://kittens.band/admin',
  }]]);
  assert.equal((await auth.authHandler(event(signed), '/auth/telegram')).statusCode, 200);
  assert.equal(requests.length, 1, 'repeat pending login does not send another alert');
});

test('pending, approved and rejected repeat logins do not generate requests', async t => {
  for (const status of ['pending', 'approved', 'rejected']) {
    await t.test(status, async t => {
      setup(t, { id: '42', telegramId: '42', firstName: 'Test', status });
      const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected delivery'); });
      assert.equal((await auth.authHandler(event(signed), '/auth/telegram')).statusCode, 200);
      assert.equal(fetch.mock.callCount(), 0);
    });
  }
});

test('invalid login never sends a notification or creates a session', async t => {
  const { sessions } = setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected delivery'); });
  assert.equal((await auth.authHandler(event({ ...signed, hash: 'invalid' }), '/auth/telegram')).statusCode, 401);
  assert.equal(sessions.mock.callCount(), 0);
  assert.equal(fetch.mock.callCount(), 0);
});

test('missing, unapproved and non-admin recipients are never notified about access requests', async t => {
  for (const recipient of [null, { ...admin, status: 'pending' }, { ...admin, isAdmin: false }]) {
    await t.test(JSON.stringify(recipient), async t => {
      setup(t, undefined, recipient);
      const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected delivery'); });
      assert.equal((await auth.authHandler(event(signed), '/auth/telegram')).statusCode, 200);
      assert.equal(fetch.mock.callCount(), 0);
    });
  }
});

test('blocked bot, Telegram errors, malformed responses and network timeouts preserve successful login', async t => {
  for (const [label, response] of [
    ['blocked', async () => ({ ok: false, status: 403, json: async () => ({ ok: false }) })],
    ['API failure', async () => ({ ok: true, status: 200, json: async () => ({ ok: false }) })],
    ['invalid response', async () => ({ ok: true, status: 200, json: async () => { throw new Error('Invalid JSON'); } })],
    ['timeout', async () => { throw new Error('Timeout https://api.telegram.org/botSECRET/sendMessage'); }],
  ]) {
    await t.test(label, async t => {
      setup(t);
      const fetch = t.mock.method(globalThis, 'fetch', response);
      const result = await auth.authHandler(event(signed), '/auth/telegram');
      assert.equal(result.statusCode, 200);
      assert.ok(JSON.parse(result.body).token);
      assert.equal(fetch.mock.callCount(), 1);
      assert.doesNotMatch(JSON.stringify(console.warn.mock.calls), /SECRET/);
    });
  }
});

test('shared messaging helper supports approved non-admin users for future notifications', async t => {
  setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), {
      chat_id: '200', text: 'Upcoming rehearsal', link_preview_options: { is_disabled: true },
    });
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  assert.equal(await telegram.sendUserNotification({ id: 'reader', telegramId: '200', status: 'approved' }, { text: 'Upcoming rehearsal' }), true);
  assert.equal(fetch.mock.callCount(), 1);
});
