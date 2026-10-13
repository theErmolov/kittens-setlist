import assert from 'node:assert/strict';
import test from 'node:test';
import telegram from '../dist/lib/telegram.js';

// Fixed signed vector for a fake bot token, independent of the implementation.
const token = '123456:test-token';
const signed = {
  username: 'test_user', id: '42', last_name: 'Musician',
  auth_date: '1791892800', first_name: 'Test',
  hash: 'c9f4e2cba986bc9b4841d3134841b682c99012104ee34f97719db9be1828a6a6',
};

test('Telegram login accepts a correctly signed payload regardless of field insertion order', t => {
  t.mock.method(Date, 'now', () => 1791892800 * 1000);
  assert.equal(telegram.verifyTelegramAuth(signed, token), true);
  assert.equal(telegram.verifyTelegramAuth(Object.fromEntries(Object.entries(signed).reverse()), token), true);
});

test('Telegram login rejects changed identity, added fields, wrong token and invalid signatures', t => {
  t.mock.method(Date, 'now', () => 1791892800 * 1000);
  for (const patch of [{ id: '43' }, { first_name: 'Forged' }, { username: 'other' }, { photo_url: 'https://example.test/avatar' }, { hash: '' }, { hash: '0'.repeat(64) }]) {
    assert.equal(telegram.verifyTelegramAuth({ ...signed, ...patch }, token), false);
  }
  assert.equal(telegram.verifyTelegramAuth(signed, 'different-token'), false);
});

test('Telegram login expires after one hour, including the precise boundary', t => {
  t.mock.method(Date, 'now', () => (1791892800 + 3600) * 1000);
  assert.equal(telegram.verifyTelegramAuth(signed, token), true);
  Date.now.mock.restore();
  t.mock.method(Date, 'now', () => (1791892800 + 3601) * 1000);
  assert.equal(telegram.verifyTelegramAuth(signed, token), false);
});
