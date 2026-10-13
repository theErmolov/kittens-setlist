import assert from 'node:assert/strict';
import test from 'node:test';
import { startPolling } from '../src/lib/poller.ts';

test('polling respects tab visibility and pause state, resumes immediately, and cleans up', async t => {
  const document = new EventTarget();
  document.hidden = false;
  t.mock.method(globalThis, 'setInterval', (callback, interval) => {
    assert.equal(interval, 3000);
    tick = callback;
    return 42;
  });
  t.mock.method(globalThis, 'clearInterval', timer => assert.equal(timer, 42));
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = document;
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  });
  let tick;
  let paused = false;
  let calls = 0;
  const cleanup = startPolling(async () => { calls++; }, 3000, () => paused);
  assert.equal(calls, 0);
  tick();
  assert.equal(calls, 1);
  paused = true;
  tick(); document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(calls, 1);
  paused = false; document.hidden = true;
  tick(); document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(calls, 1);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(calls, 2);
  cleanup();
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(calls, 2);
  assert.equal(globalThis.clearInterval.mock.callCount(), 1);
});

test('a failed poll does not produce an unhandled rejection or prevent the next tick', async t => {
  let tick;
  const document = new EventTarget();
  document.hidden = false;
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = document;
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  });
  t.mock.method(globalThis, 'setInterval', callback => { tick = callback; return 42; });
  t.mock.method(globalThis, 'clearInterval', () => {});
  let calls = 0;
  const cleanup = startPolling(async () => { if (++calls === 1) throw new Error('offline'); }, 3000, () => false);
  tick();
  await new Promise(resolve => setImmediate(resolve));
  tick();
  assert.equal(calls, 2);
  cleanup();
});
