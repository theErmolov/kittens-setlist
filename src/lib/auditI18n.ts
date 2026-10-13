import type { AuditLogEntry } from './types';

type Lang = 'ru' | 'en';

export const auditStrings = {
  en: {
    fields: {
      title: 'Title', artist: 'Artist', category: 'Category', comment: 'Comment', lengthMinutes: 'Length (min)', archived: 'Archived',
      name: 'Name', date: 'Date', startTime: 'Start time', vibe: 'Vibe mode', defaultInstruments: 'Default instruments', sortOrder: 'Order', guest: 'Guest',
      amount: 'Amount (cents)', method: 'Method', person: 'Donor', spentBy: 'Spent by', description: 'Description', creditor: 'Owed to', paid: 'Paid off', setlistId: 'Setlist', receiptKey: 'Receipt',
    },
    values: { true: 'Yes', false: 'No', null: '—', top: '💩 Top', mid: '🎵 Mid', low: '🧪 Under', cash: 'Cash', transfer: 'Transfer', income: 'Income', expense: 'Expense', debt: 'Debt', reader: 'Reader', writer: 'Writer', approved: 'Approved', rejected: 'Rejected', pending: 'Pending' },
    createdSong: 'Created song', createdSetlist: 'Created setlist', createdMusician: 'Added musician',
    added: 'Added', removed: 'Removed', updated: 'Updated', deleted: 'Deleted', noChanges: 'No changes',
    progress: 'Progress', comment: 'Comment', sharedComment: 'Shared setlist comment changed',
    break: 'Break', addedBreak: 'Added break', removedBreak: 'Removed break', order: 'order', reordered: 'Order changed', positions: 'positions', minutes: 'min',
    merged: 'Merged users', status: 'Status', role: 'Role', removedMusician: 'Removed musician status', accessKept: 'Telegram access kept', deletedMusician: 'Deleted musician without Telegram access',
    createdRehearsal: 'Created rehearsal', deletedRehearsal: 'Deleted rehearsal', cancelledRehearsal: 'Cancelled rehearsal', restoredRehearsal: 'Restored rehearsal', updatedRehearsal: 'Updated rehearsal plan',
    income: 'Income', expense: 'Expense', debt: 'Debt',
  },
  ru: {
    fields: {
      title: 'Название', artist: 'Исполнитель', category: 'Категория', comment: 'Комментарий', lengthMinutes: 'Длительность (мин)', archived: 'В архиве',
      name: 'Имя', date: 'Дата', startTime: 'Начало', vibe: 'Вайбовый режим', defaultInstruments: 'Инструменты', sortOrder: 'Порядок', guest: 'Гость',
      amount: 'Сумма (центы)', method: 'Способ', person: 'Кто пожертвовал', spentBy: 'Кто потратил', description: 'Описание', creditor: 'Кому должны', paid: 'Погашено', setlistId: 'Сетлист', receiptKey: 'Чек',
    },
    values: { true: 'Да', false: 'Нет', null: '—', top: '💩 По говну', mid: '🎵 Середняк', low: '🧪 Андеграунд', cash: 'Наличка', transfer: 'Перевод', income: 'Доход', expense: 'Расход', debt: 'Долг', reader: 'Читатель', writer: 'Редактор', approved: 'Одобрен', rejected: 'Отклонён', pending: 'Ожидает' },
    createdSong: 'Создана песня', createdSetlist: 'Создан сетлист', createdMusician: 'Добавлен музыкант',
    added: 'Добавлено', removed: 'Удалено', updated: 'Обновлено', deleted: 'Удалено', noChanges: 'Без изменений',
    progress: 'Прогресс', comment: 'Комментарий', sharedComment: 'Общий комментарий к сетлисту изменён',
    break: 'Перерыв', addedBreak: 'Добавлен перерыв', removedBreak: 'Удалён перерыв', order: 'порядок', reordered: 'Порядок изменён', positions: 'позиций', minutes: 'мин',
    merged: 'Объединены пользователи', status: 'Статус', role: 'Роль', removedMusician: 'Удалён статус музыканта', accessKept: 'Доступ Telegram сохранён', deletedMusician: 'Удалён музыкант без доступа Telegram',
    createdRehearsal: 'Создана репетиция', deletedRehearsal: 'Удалена репетиция', cancelledRehearsal: 'Отменена репетиция', restoredRehearsal: 'Восстановлена репетиция', updatedRehearsal: 'Обновлён план репетиции',
    income: 'Доход', expense: 'Расход', debt: 'Долг',
  },
};

const instruments: Record<string, string> = { guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', saxophone: '🎷', trumpet: '🎺', percussion: '🪇', vocals: '🎤' };

// Legacy summaries contain JSON field values mixed with prose. Split only outside
// quoted strings and arrays, so commas inside comments and instrument lists survive.
function splitOutside(summary: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < summary.length; i++) {
    const ch = summary[i];
    if (escaped) { escaped = false; continue; }
    if (quoted && ch === '\\') { escaped = true; continue; }
    if (ch === '"') quoted = !quoted;
    if (quoted) continue;
    if (ch === '[' || ch === '{' || ch === '(') depth++;
    if (ch === ']' || ch === '}' || ch === ')') depth--;
    if (depth === 0 && summary.startsWith(separator, i)) {
      // Commas between unquoted instrument codes belong to one musician change.
      const next = summary.slice(i + separator.length).split(/, | → /)[0];
      if (separator === ', ' && (next in instruments || next === '—')) continue;
      parts.push(summary.slice(start, i)); start = i + separator.length; i += separator.length - 1;
    }
  }
  parts.push(summary.slice(start));
  return parts;
}

function formatValue(value: string, field: string, lang: Lang): string {
  const text = auditStrings[lang];
  if (value in text.values && ['true', 'false', 'null'].includes(value)) return text.values[value as keyof typeof text.values];
  if (['category', 'method', 'kind', 'role', 'status'].includes(field)) {
    const key = value.replace(/^"|"$/g, '');
    return text.values[key as keyof typeof text.values] ?? value;
  }
  if (field === 'defaultInstruments') {
    try { return (JSON.parse(value) as string[]).map(item => instruments[item] ?? item).join(' ') || '—'; } catch { return value; }
  }
  return value;
}

function isJsonValue(value: string): boolean {
  try { JSON.parse(value); return true; } catch { return false; }
}

/** Translate stored audit templates; names, quoted text and musician keys remain data. */
export function formatLocalizedAuditSummary(entry: Pick<AuditLogEntry, 'action' | 'summary'>, lang: Lang): string {
  const text = auditStrings[lang], summary = entry.summary;
  const fixed: Record<string, string> = {
    'обновлена': text.updated, 'обновлён': text.updated, 'удалена': text.deleted, 'удалён': text.deleted, 'no changes': text.noChanges,
    'комментарий к сетлисту изменён': text.sharedComment,
    'создана репетиция': text.createdRehearsal, 'удалена репетиция': text.deletedRehearsal,
    'отменена репетиция': text.cancelledRehearsal, 'восстановлена репетиция': text.restoredRehearsal, 'обновлён план репетиции': text.updatedRehearsal,
    'удалён пользователь-музыкант без доступа Telegram': text.deletedMusician,
  };
  if (fixed[summary]) return fixed[summary];
  const prefixes: Record<string, [string, string]> = {
    'song.create': ['создана песня ', text.createdSong], 'setlist.create': ['создан сетлист ', text.createdSetlist],
    'musician.create': ['добавлен музыкант ', text.createdMusician], 'setlist.song_add': ['добавлено: ', text.added + ':'],
    'setlist.song_remove': ['удалена: ', text.removed + ':'], 'user.merge': ['объединены пользователи ', text.merged],
    'setlist.entry_comment_update': ['комментарий: ', text.comment + ':'],
    'user.musician_remove': ['удалён статус музыканта ', text.removedMusician],
  };
  const prefix = prefixes[entry.action];
  if (prefix && summary.startsWith(prefix[0])) {
    let data = summary.slice(prefix[0].length);
    if (entry.action === 'user.musician_remove') data = data.replace(/; доступ Telegram сохранён$/, `; ${text.accessKept}`);
    return `${prefix[1]} ${data}`;
  }
  if (entry.action === 'budget.create') return summary.replace(/^добавлен /, `${text.added} `).replace(/^(\S+ )?(доход|расход|долг)(?= \d)/, (_, prefix = '', kind: string) => prefix + ({ доход: text.income, расход: text.expense, долг: text.debt }[kind]));
  if (entry.action === 'setlist.break_add') return summary.replace(/^добавлен перерыв (\d+) мин$/, `${text.addedBreak} $1 ${text.minutes}`);
  if (entry.action === 'setlist.break_remove') return summary.replace(/^удалён перерыв \(порядок (\d+)\)$/, `${text.removedBreak} (${text.order} $1)`);
  if (entry.action === 'setlist.break_update') return summary.replace(/^перерыв: (.+) мин$/, `${text.break}: $1 ${text.minutes}`);
  if (entry.action === 'setlist.reorder') return summary.replace(/^порядок изменён \((\d+) позиций\)$/, `${text.reordered} ($1 ${text.positions})`);
  if (entry.action === 'user.role_change' || entry.action === 'user.approve' || entry.action === 'user.reject') {
    const match = /^(роль|статус): (.+) → (.+)$/.exec(summary);
    if (match) return `${match[1] === 'роль' ? text.role : text.status}: ${formatValue(match[2], 'role', lang)} → ${formatValue(match[3], 'role', lang)}`;
  }
  // Progress-only actions contain a musician name rather than template prose.
  if (entry.action.endsWith('progress_update')) return summary;
  return splitOutside(summary, ', ').map(part => {
    const label = /^([A-Za-z]+): (.+)$/.exec(part);
    const values = label ? splitOutside(label[2], ' → ') : [];
    const match = label && values.length === 2 ? [part, label[1], ...values] : null;
    if (match && match[1] in text.fields && isJsonValue(match[2]) && isJsonValue(match[3])) {
      const field = match[1] as keyof typeof text.fields;
      return `${text.fields[field]}: ${formatValue(match[2], field, lang)} → ${formatValue(match[3], field, lang)}`;
    }
    if (part.startsWith('прогресс ')) return `${text.progress} ${part.slice('прогресс '.length)}`;
    // Instrument codes in musician changes are values, not the musician's name.
    const musician = /^(.*?): (.+) → (.+)$/.exec(part);
    const instrumentList = (value: string) => value === '—' || value.split(', ').every(key => key in instruments);
    if (musician && instrumentList(musician[2]) && instrumentList(musician[3])) {
      const icons = (value: string) => value.split(', ').map(key => instruments[key] ?? key).join(', ');
      return `${musician[1]}: ${icons(musician[2])} → ${icons(musician[3])}`;
    }
    return part.replace(/^(\+ .+)( \()([a-z, ]+)(\))$/, (original, name, open, values: string, close) =>
      instrumentList(values) ? name + open + values.split(', ').map(key => instruments[key]).join(', ') + close : original);
  }).join(', ');
}

export function formatLocalizedAuditEntity(entry: Pick<AuditLogEntry, 'entityType' | 'entityName'>, lang: Lang): string {
  const text = auditStrings[lang];
  if (entry.entityType === 'budget') return entry.entityName.replace(/^(доход|расход|долг)(?= \d)/, kind => ({ доход: text.income, расход: text.expense, долг: text.debt }[kind]!));
  return entry.entityName;
}
