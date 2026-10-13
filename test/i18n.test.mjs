import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { auditStrings, formatLocalizedAuditSummary, formatLocalizedAuditEntity } from '../src/lib/auditI18n.ts';

function source(file) {
  return ts.createSourceFile(file, fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
}
function find(root, predicate) {
  let result;
  function visit(node) { if (predicate(node)) result = node; ts.forEachChild(node, visit); }
  visit(root);
  assert.ok(result);
  return result;
}
function dictionary(file) {
  const ast = source(file);
  const root = find(ast, node => ts.isVariableDeclaration(node) && node.name.getText(ast) === 'strings').initializer;
  return Object.fromEntries(root.properties.map(prop => [prop.name.getText(ast), prop.initializer]));
}
function keys(node, prefix = '') {
  return node.properties.flatMap(prop => {
    const key = prefix + prop.name.text;
    return ts.isObjectLiteralExpression(prop.initializer) ? keys(prop.initializer, key + '.') : [key];
  }).sort();
}

test('all translation dictionaries have identical Russian and English keys', () => {
  for (const file of ['src/lib/i18n.ts', 'src/lib/rehearsalI18n.ts']) {
    const { en, ru } = dictionary(file);
    assert.deepEqual(keys(en), keys(ru), file);
  }
  assert.deepEqual(Object.keys(auditStrings.en.fields), Object.keys(auditStrings.ru.fields));
  assert.deepEqual(Object.keys(auditStrings.en.values), Object.keys(auditStrings.ru.values));
  assert.deepEqual(Object.keys(auditStrings.en), Object.keys(auditStrings.ru));
});

test('dictionary covers every backend audit entity and frontend instrument, category and progress stage', () => {
  const backend = source('api/src/lib/audit.ts');
  const entities = find(backend, node => ts.isTypeAliasDeclaration(node) && node.name.text === 'EntityType').type.types.map(node => node.literal.text);
  const frontend = source('src/lib/types.ts');
  const { en, ru } = dictionary('src/lib/i18n.ts');
  for (const root of [en, ru]) {
    const present = keys(root);
    for (const entity of entities) assert.ok(present.includes(`admin.auditEntities.${entity}`), entity);
    for (const [type, section] of [['Instrument', 'instrument'], ['Category', 'filter'], ['LearningStage', 'progress']]) {
      const values = find(frontend, node => ts.isTypeAliasDeclaration(node) && node.name.text === type).type.types.map(node => node.literal.text);
      for (const value of values) assert.ok(present.includes(`${section}.${value}`), `${section}.${value}`);
    }
  }
});

const format = (action, summary, lang = 'en') => formatLocalizedAuditSummary({ action, summary }, lang);
test('existing audit records switch languages without rewriting titles, names or comments', () => {
  assert.equal(format('song.create', 'создана песня "прогресс guitar, title: bass"'), 'Created song "прогресс guitar, title: bass"');
  assert.equal(format('setlist.entry_comment_update', 'комментарий: "guitar" → "прогресс, bass"'), 'Comment: "guitar" → "прогресс, bass"');
  assert.equal(format('song.update', 'title: "guitar, прогресс" → "bass", comment: "name: x → y" → "title: guitar", archived: false → true'), 'Title: "guitar, прогресс" → "bass", Comment: "name: x → y" → "title: guitar", Archived: No → Yes');
  assert.equal(format('song.update', 'прогресс Илья: ⚪ → 🟢'), 'Progress Илья: ⚪ → 🟢');
  assert.equal(format('song.progress_update', 'прогресс: ⚪ → 🟢'), 'прогресс: ⚪ → 🟢');
  assert.equal(format('song.update', 'comment: \"old\" → \"guitar → bass, title: x\"'), 'Comment: \"old\" → \"guitar → bass, title: x\"');
  assert.equal(format('song.update', 'Илья: guitar, vocals → bass, vocals, Маша: violin → —'), 'Илья: 🎸, 🎤 → 🪕, 🎤, Маша: 🎻 → —');
  assert.equal(format('song.update', 'comment: guitar → bass'), 'comment: 🎸 → 🪕');
  assert.equal(format('song.update', 'category: "mid" → "top"', 'ru'), 'Категория: 🎵 Середняк → 💩 По говну');
  assert.equal(format('musician.update', 'defaultInstruments: ["guitar","vocals"] → ["bass"], guest: false → true'), 'Default instruments: 🎸 🎤 → 🪕, Guest: No → Yes');
});

test('legacy action templates include breaks, permissions, rehearsals and budget', () => {
  const cases = [
    ['setlist.create', 'создан сетлист "Бар"', 'Created setlist "Бар"'],
    ['musician.create', 'добавлен музыкант "Илья"', 'Added musician "Илья"'],
    ['setlist.song_add', 'добавлено: guitar, Перерыв', 'Added: guitar, Перерыв'],
    ['setlist.song_remove', 'удалена: Перерыв', 'Removed: Перерыв'],
    ['setlist.break_add', 'добавлен перерыв 15 мин', 'Added break 15 min'],
    ['setlist.break_remove', 'удалён перерыв (порядок 3)', 'Removed break (order 3)'],
    ['setlist.break_update', 'перерыв: 5 → 10 мин', 'Break: 5 → 10 min'],
    ['setlist.reorder', 'порядок изменён (12 позиций)', 'Order changed (12 positions)'],
    ['setlist.update', 'комментарий к сетлисту изменён', 'Shared setlist comment changed'],
    ['song.update', 'обновлена', 'Updated'],
    ['setlist.delete', 'удалён', 'Deleted'],
    ['song.delete', 'удалена', 'Deleted'],
    ['user.merge', 'объединены пользователи 1 → 2', 'Merged users 1 → 2'],
    ['user.approve', 'статус: pending → approved', 'Status: Pending → Approved'],
    ['user.role_change', 'роль: reader → writer', 'Role: Reader → Writer'],
    ['user.musician_remove', 'удалён статус музыканта "Илья"; доступ Telegram сохранён', 'Removed musician status "Илья"; Telegram access kept'],
    ['musician.delete', 'удалён пользователь-музыкант без доступа Telegram', 'Deleted musician without Telegram access'],
    ['rehearsal.create', 'создана репетиция', 'Created rehearsal'],
    ['rehearsal.update', 'обновлён план репетиции', 'Updated rehearsal plan'],
    ['rehearsal.update', 'отменена репетиция', 'Cancelled rehearsal'],
    ['rehearsal.update', 'восстановлена репетиция', 'Restored rehearsal'],
    ['rehearsal.delete', 'удалена репетиция', 'Deleted rehearsal'],
    ['budget.create', 'добавлен доход 27.10€ (Илья)', 'Added Income 27.10€ (Илья)'],
    ['budget.update', 'amount: 100 → 200, method: "cash" → "transfer", paid: false → true', 'Amount (cents): 100 → 200, Method: Cash → Transfer, Paid off: No → Yes'],
    ['musician.update', 'no changes', 'No changes'],
  ];
  for (const [action, summary, expected] of cases) assert.equal(format(action, summary), expected, action);
  assert.equal(formatLocalizedAuditEntity({ entityType: 'budget', entityName: 'расход 10.00€ (доход)' }, 'en'), 'Expense 10.00€ (доход)');
  assert.equal(formatLocalizedAuditEntity({ entityType: 'song', entityName: 'доход 10.00€' }, 'en'), 'доход 10.00€');
});
