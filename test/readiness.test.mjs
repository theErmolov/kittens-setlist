import assert from 'node:assert/strict';
import test from 'node:test';
import { progressPct, songReadiness } from '../src/lib/utils.ts';

const musicians = {
  Bass: { instruments: ['bass', 'vocals'] },
  Guest: { instruments: ['violin'] },
  Idle: { instruments: [] },
};

test('progress counts each active musician once, includes guests and defaults missing progress to queue', () => {
  assert.equal(progressPct(musicians, { Bass: 'ready', Guest: 'structure', Idle: 'ready' }), 63);
  assert.equal(progressPct(musicians, { Bass: 'ready' }), 50);
  assert.equal(progressPct({ Idle: musicians.Idle }, { Idle: 'queue' }), 100);
  assert.equal(progressPct({}, {}), 100);
});

test('readiness uses the least-ready active part within the musician selection', () => {
  const progress = { Bass: 'ready', Guest: 'structure', Idle: 'queue' };
  assert.equal(songReadiness(musicians, progress, new Set()), 'structure');
  assert.equal(songReadiness(musicians, progress, new Set(['Bass'])), 'ready');
  assert.equal(songReadiness(musicians, {}, new Set(['Guest'])), 'queue');
  assert.equal(songReadiness(musicians, progress, new Set(['Idle', 'Missing'])), 'ready');
});
