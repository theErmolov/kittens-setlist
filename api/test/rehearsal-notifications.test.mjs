import assert from 'node:assert/strict';
import { test, beforeEach, after } from 'node:test';
import dynamo from '../dist/lib/dynamo.js';
import plan from '../dist/lib/rehearsal-reminder-plan.js';
import notifications from '../dist/handlers/rehearsal-notifications.js';
import preferences from '../dist/handlers/notification-preferences.js';
import telegram from '../dist/lib/telegram.js';
const { HOUR, preparationGroups, preparationText, rehearsalStart, zonedTime, morningAfter } = plan;
const { runRehearsalNotifications, handleReminderCallback, rehearsalNotificationsHandler } = notifications;
const originalSend = dynamo.db.send, originalFetch = globalThis.fetch;
const tables = new Map();
const calls = [];
let nextMessage, failure;
const table = name => { if (!tables.has(name)) tables.set(name, new Map()); return tables.get(name); };
const put = (name, item) => table(name).set(item.id, structuredClone(item));
const state = id => table('kittens-notifications').get(id);
const conditionFailure = () => { const error = new Error('Conditional failure'); error.name = 'ConditionalCheckFailedException'; throw error; };
dynamo.db.send = async command => {
  const input = command.input;
  if (command.constructor.name === 'TransactWriteCommand') {
    if (input.TransactItems.some(item => table(item.Put.TableName).has(item.Put.Item.id))) {
      const error = new Error('Conditional failure'); error.name = 'TransactionCanceledException'; error.CancellationReasons = [{ Code: 'ConditionalCheckFailed' }]; throw error;
    }
    input.TransactItems.forEach(item => put(item.Put.TableName, item.Put.Item)); return {};
  }
  const values = input.ExpressionAttributeValues ?? {}, names = input.ExpressionAttributeNames ?? {};
  const current = table(input.TableName).get((input.Key ?? input.Item)?.id);
  const expressions = [input.UpdateExpression, input.ConditionExpression, input.KeyConditionExpression].filter(Boolean).join(' ');
  for (const key of Object.keys(values)) assert.ok(expressions.includes(key), `Unused ${key}`);
  for (const key of Object.keys(names)) assert.ok(expressions.includes(key), `Unused ${key}`);
  switch (command.constructor.name) {
    case 'GetCommand': return { Item: structuredClone(current) };
    case 'ScanCommand': return { Items: structuredClone([...table(input.TableName).values()]) };
    case 'QueryCommand': return { Items: structuredClone([...table(input.TableName).values()].filter(item => item[Object.values(names)[0]] === Object.values(values)[0])) };
    case 'PutCommand': if (input.ConditionExpression && current) conditionFailure(); put(input.TableName, input.Item); return {};
    case 'DeleteCommand': if (input.ConditionExpression && current?.receipt !== values[':receipt']) conditionFailure(); table(input.TableName).delete(input.Key.id); return {};
    case 'UpdateCommand': {
      const item = structuredClone(current ?? { id: input.Key.id });
      for (const assignment of input.UpdateExpression.slice(4).split(', ')) {
        const [field, value] = assignment.split(' = '); item[names[field]] = values[value];
      }
      put(input.TableName, item); return {};
    }
    default: throw new Error(command.constructor.name);
  }
};
const now = Date.parse('2026-10-12T17:00:00Z');
const song = { id: 's', title: 'Song', artist: 'Artist', category: 'mid', musicians: { Bass: { instruments: ['bass'] }, Keys: { instruments: ['keys'] } }, progress: { Bass: 'structure', Keys: 'queue' } };
function rehearsal(id = 'r', date = '2026-10-15', startTime = '19:00', extra = {}) {
  return { id, date, startTime, timeZone: 'Europe/Berlin', attendees: ['Bass', 'Keys'], songs: [{ songId: 's', song }], cancelled: false, version: 1, createdAt: '2026-10-10T12:00:00Z', createdBy: 'admin', ...extra };
}
const admin = { id: 'admin', telegramId: '100', isAdmin: true, status: 'approved', musicianName: 'Bass' };
const messages = chat => calls.filter(c => c.method === 'sendMessage' && (chat === undefined || c.payload.chat_id === chat));
function callback(id, data, user = 100, messageId = 20, privateChat = false) {
  return { id, data, from: { id: user }, message: { message_id: messageId, chat: { id: privateChat ? user : -1003138570084, type: privateChat ? 'private' : 'supergroup' }, reply_markup: { inline_keyboard: [[{ text: 'Open', url: 'https://kittens.band/rehearsals/r' }], [{ text: 'Stop notifications', callback_data: 'notify:stop' }]] } } };
}
beforeEach(() => {
  tables.clear(); calls.length = 0; nextMessage = 1000; failure = undefined;
  process.env.REMINDER_CHECK_MINUTES = '60'; process.env.TELEGRAM_BOT_TOKEN = 'test-only'; process.env.REHEARSAL_GROUP_CHAT_ID = '-1003138570084';
  put('kittens-people', { id: '__people_control__', activeStore: 'people' });
  put('kittens-people', admin);
  put('kittens-people', { ...admin, id: 'writer', telegramId: '200', isAdmin: false, role: 'writer', musicianName: 'Keys' });
  put('kittens-songs', song);
  globalThis.fetch = async (url, options) => {
    const method = url.split('/').at(-1), payload = JSON.parse(options.body);
    calls.push({ method, payload });
    if (failure?.(method, payload) === 'timeout') throw new Error('test secret must not escape');
    if (failure?.(method, payload) === 'reject') return { ok: false, json: async () => ({ ok: false, description: 'Forbidden' }) };
    return { ok: true, json: async () => ({ ok: true, result: method === 'sendMessage' ? { message_id: nextMessage++ } : true }) };
  };
});
after(() => { dynamo.db.send = originalSend; globalThis.fetch = originalFetch; delete process.env.REMINDER_CHECK_MINUTES; delete process.env.REHEARSAL_GROUP_CHAT_ID; delete process.env.TELEGRAM_BOT_TOKEN; });

test('timezone conversion and next-morning timing follow DST, not UTC + 24h', () => {
  assert.equal(zonedTime('2026-10-24', '19:00', 'Europe/Berlin'), Date.parse('2026-10-24T17:00:00Z'));
  assert.equal(zonedTime('2026-10-25', '19:00', 'Europe/Berlin'), Date.parse('2026-10-25T18:00:00Z'));
  assert.equal(morningAfter(rehearsal('previous', '2026-10-24')), Date.parse('2026-10-25T08:00:00Z'));
  assert.throws(() => zonedTime('2026-03-29', '02:30', 'Europe/Berlin'));
});
test('preparation windows delay to 9am, join impossible windows and chain close rehearsals', () => {
  const current = rehearsal();
  let groups = preparationGroups([current, rehearsal('previous', '2026-10-13')]);
  assert.equal(groups.length, 2);
  assert.equal(groups[1].due, Date.parse('2026-10-14T07:00:00Z'));
  assert.ok(groups[1].due >= groups[1].start - 72 * HOUR && groups[1].due <= groups[1].deadline);
  groups = preparationGroups([current, rehearsal('previous', '2026-10-14')]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].rehearsals.map(r => r.id), ['previous', 'r']);
  groups = preparationGroups([rehearsal('a', '2026-10-15'), rehearsal('b', '2026-10-16', '10:00'), rehearsal('c', '2026-10-17', '08:00')]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].due, now);
  assert.equal(preparationGroups([current, rehearsal('cancelled', '2026-10-14', '19:00', { cancelled: true })]).length, 1);
});
test('announcement waits strictly more than an hour, reads current details and sends once', async () => {
  put('kittens-rehearsals', rehearsal('r', undefined, undefined, { createdAt: new Date(now - HOUR).toISOString(), location: 'New studio' }));
  await runRehearsalNotifications(now);
  assert.equal(messages('-1003138570084').length, 0);
  assert.equal(messages('100').length, 0);
  await runRehearsalNotifications(now + 1);
  assert.equal(messages('-1003138570084').length, 1);
  assert.match(messages('-1003138570084')[0].payload.text, /New studio/);
  assert.equal(messages('-1003138570084')[0].payload.reply_markup.inline_keyboard[1][0].text, 'А мне чё учить?');
  await runRehearsalNotifications(now + HOUR);
  assert.equal(messages('-1003138570084').length, 1);
});
test('scheduled personal delivery is approved-admin-only and repeated ticks do not resend', async () => {
  put('kittens-rehearsals', rehearsal());
  put('kittens-people', { ...admin, id: 'pending', telegramId: '300', status: 'pending' });
  await runRehearsalNotifications(now);
  assert.equal(messages('100').length, 1);
  assert.equal(messages('200').length, 0);
  assert.equal(messages('300').length, 0);
  await runRehearsalNotifications(now + HOUR);
  assert.equal(messages('100').length, 1);
});
test('24h group reminder uses the preceding hourly slot and is independent of private preference', async () => {
  const r = rehearsal(); put('kittens-rehearsals', r);
  put('kittens-notifications', { id: 'preference:100', enabled: false });
  await runRehearsalNotifications(now);
  await runRehearsalNotifications(rehearsalStart(r) - 24.5 * HOUR);
  await runRehearsalNotifications(rehearsalStart(r) - 23.5 * HOUR);
  assert.equal(messages('-1003138570084').length, 2);
  assert.match(messages('-1003138570084')[1].payload.text, /Напоминание/);
  assert.equal(messages('100').length, 0);
});
test('manual request immediately sends latest progress; 48h cutoff is strict and scope-specific', async () => {
  put('kittens-rehearsals', rehearsal());
  put('kittens-songs', { ...song, progress: { Bass: 'mastering' } });
  await handleReminderCallback(callback('request', 'prep:r'), now - HOUR);
  assert.match(messages('100')[0].payload.text, /Доработать/);
  assert.equal(state('request:100:r').lastRequestedAt, now - HOUR);
  await runRehearsalNotifications(now);
  assert.equal(messages('100').length, 1);
  for (const hours of [48, 48.001]) {
    tables.get('kittens-notifications').clear(); calls.length = 0;
    put('kittens-notifications', { id: 'request:100:r', lastRequestedAt: now - hours * HOUR });
    await runRehearsalNotifications(now);
    assert.equal(messages('100').length, hours === 48 ? 0 : 1);
  }
});
test('group request by nonadmin, wrong chat, cancelled, past or absent user sends no private message', async () => {
  put('kittens-rehearsals', rehearsal());
  await handleReminderCallback(callback('writer', 'prep:r', 200), now);
  await handleReminderCallback(callback('wrong', 'prep:r', 100, 20, true), now);
  put('kittens-rehearsals', rehearsal('r', undefined, undefined, { cancelled: true }));
  await handleReminderCallback(callback('cancelled', 'prep:r'), now);
  put('kittens-rehearsals', rehearsal('r', '2026-10-11'));
  await handleReminderCallback(callback('past', 'prep:r'), now);
  put('kittens-rehearsals', rehearsal('r', undefined, undefined, { attendees: ['Keys'] }));
  await handleReminderCallback(callback('absent', 'prep:r'), now);
  assert.equal(messages('100').length, 0); assert.equal(messages('200').length, 0);
});
test('remove previous keyboard strictly before new send; explicit request works while opted out', async () => {
  put('kittens-rehearsals', rehearsal());
  put('kittens-notifications', { id: 'preference:100', enabled: false, latestMessageId: 42 });
  await handleReminderCallback(callback('request', 'prep:r'), now);
  assert.deepEqual(calls.slice(0, 2).map(c => c.method), ['editMessageReplyMarkup', 'sendMessage']);
  assert.deepEqual(calls[0].payload.reply_markup.inline_keyboard, []);
  assert.equal(messages('100')[0].payload.reply_markup.inline_keyboard[1][0].callback_data, 'notify:resume');
  assert.equal(state('preference:100').latestMessageId, 1000);
  assert.equal(state('preference:100').enabled, false);
});
test('stop/resume edits only clicked latest message; stale and group buttons cannot change preference', async () => {
  put('kittens-notifications', { id: 'preference:100', latestMessageId: 42 });
  await handleReminderCallback(callback('stale', 'notify:stop', 100, 41, true), now);
  await handleReminderCallback(callback('group', 'notify:stop', 100, 42), now);
  assert.equal(state('preference:100').enabled, undefined);
  await handleReminderCallback(callback('stop', 'notify:stop', 100, 42, true), now);
  assert.equal(state('preference:100').enabled, false);
  await handleReminderCallback(callback('resume', 'notify:resume', 100, 42, true), now);
  assert.equal(state('preference:100').enabled, true);
  assert.equal(calls.filter(c => c.method === 'editMessageReplyMarkup').length, 2);
  assert.ok(calls.filter(c => c.method === 'editMessageReplyMarkup').every(c => c.payload.message_id === 42));
});
test('failed keyboard removal prevents posting; ambiguous send is never repeated by scheduler', async () => {
  put('kittens-rehearsals', rehearsal());
  put('kittens-notifications', { id: 'preference:100', latestMessageId: 42 });
  failure = method => method === 'editMessageReplyMarkup' ? 'reject' : undefined;
  await handleReminderCallback(callback('request', 'prep:r'), now);
  assert.equal(messages('100').length, 0);
  failure = (method, payload) => method === 'sendMessage' && payload.chat_id === '100' ? 'timeout' : undefined;
  await runRehearsalNotifications(now);
  await runRehearsalNotifications(now + HOUR);
  assert.equal(messages('100').length, 1);
  assert.equal(state(`personal:100:r:${rehearsalStart(rehearsal())}`).status, 'uncertain');
});
test('manual double taps and retries are deduplicated; latest-only state stays bounded', async () => {
  put('kittens-rehearsals', rehearsal());
  await handleReminderCallback(callback('a', 'prep:r'), now);
  await handleReminderCallback(callback('a', 'prep:r'), now + 31_000);
  await handleReminderCallback(callback('b', 'prep:r'), now + 1000);
  assert.equal(messages('100').length, 1);
  await handleReminderCallback(callback('c', 'prep:r'), now + 31_000);
  assert.equal(messages('100').length, 2);
  const removed = calls.find(c => c.method === 'editMessageReplyMarkup');
  assert.deepEqual(removed.payload.reply_markup.inline_keyboard, [[{ text: 'Открыть репетицию', url: 'https://kittens.band/rehearsals/r' }]]);
  assert.equal([...table('kittens-notifications').keys()].filter(key => key.startsWith('preference:')).length, 1);
});
test('deduplicated preparation separates refresh from readiness and protects private notes', () => {
  const r = rehearsal(); r.songs[0].song = { ...song, personalComment: 'secret', progress: { Bass: 'ready' } };
  assert.equal(preparationText([r], 'Bass', now).hasWork, false);
  r.songs[0].refreshFor = ['Bass']; r.songs[0].note = 'Ending';
  const result = preparationText([r, { ...r, id: 'other' }], 'Bass', now);
  assert.equal(result.hasWork, true); assert.match(result.text, /Освежить/); assert.match(result.text, /Ending/);
  assert.equal(result.text.split('Artist — Song').length, 2); assert.ok(!result.text.includes('secret'));
});
test('logistical edits, cancellation, restoration and deletion notify announced group once', async () => {
  put('kittens-rehearsals', rehearsal());
  await runRehearsalNotifications(now);
  put('kittens-rehearsals', rehearsal('r', undefined, undefined, { location: 'Other studio', version: 2 }));
  await runRehearsalNotifications(now + HOUR);
  await runRehearsalNotifications(now + 2 * HOUR);
  put('kittens-rehearsals', rehearsal('r', undefined, undefined, { location: 'Other studio', version: 3, cancelled: true }));
  await runRehearsalNotifications(now + 3 * HOUR);
  put('kittens-rehearsals', rehearsal('r', undefined, undefined, { location: 'Other studio', version: 4 }));
  await runRehearsalNotifications(now + 4 * HOUR);
  table('kittens-rehearsals').delete('r');
  await runRehearsalNotifications(now + 5 * HOUR);
  assert.equal(messages('-1003138570084').length, 5);
});
test('webhook rejects untrusted callers and invalid JSON; preference endpoint is admin-only', async () => {
  const event = { requestContext: { http: { method: 'POST' } }, headers: {}, body: '{}' };
  assert.equal((await rehearsalNotificationsHandler(event)).statusCode, 403);
  assert.equal((await rehearsalNotificationsHandler({ ...event, headers: { 'x-telegram-bot-api-secret-token': 'é'.repeat(64) } })).statusCode, 403);
  const headers = { 'x-telegram-bot-api-secret-token': telegram.telegramWebhookSecret() };
  assert.equal((await rehearsalNotificationsHandler({ ...event, headers, body: 'bad' })).statusCode, 400);
  assert.equal((await rehearsalNotificationsHandler({ ...event, headers })).statusCode, 200);
  for (const user of [{ ...admin, isAdmin: false }, { ...admin, status: 'pending' }]) assert.equal((await preferences.notificationPreferencesHandler(event, user)).statusCode, 403);
  const response = await preferences.notificationPreferencesHandler({ ...event, requestContext: { http: { method: 'PATCH' } }, body: '{"enabled":false}' }, admin);
  assert.equal(response.statusCode, 200); assert.equal(state('preference:100').enabled, false);
});

test('close rehearsals share one automatic digest and later ticks do not resend after the first ends', async () => {
  const first = rehearsal('a');
  const second = rehearsal('b', '2026-10-16', '10:00', { songs: [{ songId: 'other', song: { ...song, id: 'other', title: 'Other song' } }] });
  put('kittens-songs', second.songs[0].song);
  put('kittens-rehearsals', first); put('kittens-rehearsals', second);
  await runRehearsalNotifications(now);
  assert.equal(messages('100').length, 1);
  assert.match(messages('100')[0].payload.text, /Other song/);
  await runRehearsalNotifications(rehearsalStart(first) + HOUR);
  assert.equal(messages('100').length, 1);
});

test('moving an upcoming announced rehearsal and then deleting it still posts cancellation', async () => {
  put('kittens-rehearsals', rehearsal());
  await runRehearsalNotifications(now);
  put('kittens-rehearsals', rehearsal('r', '2026-10-30', '19:00', { version: 2 }));
  await runRehearsalNotifications(now + HOUR);
  table('kittens-rehearsals').delete('r');
  await runRehearsalNotifications(Date.parse('2026-10-20T17:00:00Z'));
  assert.match(messages('-1003138570084').at(-1).payload.text, /Репетиция отменена/);
  assert.match(messages('-1003138570084').at(-1).payload.text, /30 октября/);
});

test('a next-morning slot exactly on the 24h cutoff is combined, not lost', () => {
  const groups = preparationGroups([rehearsal('previous', '2026-10-13'), rehearsal('next', '2026-10-15', '09:00')]);
  assert.equal(groups.length, 1);
});

test('one-minute trial checks still wait an hour and send logistical reminders within the final minute before 24h', async () => {
  process.env.REMINDER_CHECK_MINUTES = '1';
  const r = rehearsal(); put('kittens-rehearsals', r);
  await runRehearsalNotifications(now);
  await runRehearsalNotifications(rehearsalStart(r) - 24 * HOUR - 90_000);
  assert.equal(messages('-1003138570084').length, 1);
  await runRehearsalNotifications(rehearsalStart(r) - 24 * HOUR - 30_000);
  await runRehearsalNotifications(rehearsalStart(r) - 24 * HOUR + 30_000);
  assert.equal(messages('-1003138570084').length, 2);
});
