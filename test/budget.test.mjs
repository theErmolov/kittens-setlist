import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEUR, budgetTotals, buildBudgetReport } from '../src/lib/utils.ts';

const entry = (kind, amount, extra = {}) => ({ kind, amount, date: '2026-10-01', ...extra });

test('EUR input converts commas, dots and spaced values to integer cents without float drift', () => {
  for (const [input, cents] of [['27,10', 2710], ['27.10', 2710], ['27', 2700], [' 1\u00a0234,56 ', 123456], ['0.29', 29], ['-1,25', -125], ['', 0], ['invalid', 0], ['Infinity', 0]]) {
    assert.equal(parseEUR(input), cents, input);
  }
});

test('budget separates cash/transfers and deducts only unpaid debts from balance', () => {
  const entries = Object.freeze([
    entry('income', 10000, { method: 'cash' }),
    entry('income', 2550, { method: 'transfer' }),
    entry('expense', 1234, { method: 'cash' }),
    entry('expense', 500, { method: 'transfer' }),
    entry('debt', 3000), entry('debt', 1000, { paid: false }), entry('debt', 9999, { paid: true }),
  ].map(Object.freeze));
  assert.deepEqual(budgetTotals(entries), { cash: 8766, transfer: 2050, onHand: 10816, debts: 4000, balance: 6816 });
  assert.deepEqual(budgetTotals([]), { cash: 0, transfer: 0, onHand: 0, debts: 0, balance: 0 });
  assert.equal(budgetTotals([entry('expense', 500, { method: 'cash' }), entry('debt', 1000)]).balance, -1500);
});

test('report lists donations from the latest started show while totals remain cumulative', () => {
  const setlists = Object.freeze([
    { id: 'future', name: 'Later tonight', date: '2026-10-13', startTime: '21:00' },
    { id: 'old', name: 'Old show', date: '2026-10-01' },
    { id: 'latest', name: 'Latest show', date: '2026-10-13', startTime: '19:00' },
    { id: 'undated', name: 'Undated' },
  ].map(Object.freeze));
  const entries = Object.freeze([
    entry('income', 10000, { method: 'cash', setlistId: 'old', person: 'Old donor' }),
    entry('income', 2710, { method: 'transfer', setlistId: 'latest', person: ' Alice ', date: '2026-10-13T20:00' }),
    entry('income', 1000, { method: 'cash', setlistId: 'latest', person: '  ', date: '2026-10-13T19:30' }),
    entry('expense', 2000, { method: 'cash' }),
    entry('debt', 500, { creditor: ' Studio ', description: 'rent' }),
    entry('debt', 1250, { creditor: 'Studio', comment: 'cables', date: '2026-10-02' }),
    entry('debt', 999, { paid: true, creditor: 'Paid' }),
  ].map(Object.freeze));
  const now = new Date('2026-10-13T20:30').getTime();
  assert.equal(buildBudgetReport(entries, setlists, now, 'en'), [
    'Money report:', '', 'Cash — 10', 'Alice — 27.10', '',
    'Kittens bank — 80', 'Total on hand — 117.1', '',
    'Debt Studio: 5 rent + 12.50 cables', '', 'Current balance: 99.6',
  ].join('\n'));
  const ru = buildBudgetReport(entries, setlists, now, 'ru');
  assert.ok(ru.includes('Alice — 27,10'));
  assert.ok(ru.includes('Итого наш баланс пока: 99,6'));
});

test('report does not repeat donations from an older event when the latest show has none', () => {
  const report = buildBudgetReport(
    [entry('income', 1000, { method: 'cash', setlistId: 'old', person: 'Old donor' })],
    [{ id: 'old', date: '2026-10-01' }, { id: 'latest', date: '2026-10-12' }],
    new Date('2026-10-13T12:00').getTime(), 'en',
  );
  assert.ok(!report.includes('Old donor'));
  assert.ok(report.includes('Kittens bank — 10'));
});
