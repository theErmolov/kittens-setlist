import type { Instrument, LearningStage, MusicianRole, BudgetEntry, Setlist } from '$lib/types';

export const STAGE_PCT: Record<LearningStage, number> = {
  queue: 0, structure: 25, mastering: 75, ready: 100
};

/** Compute overall progress % (0–100) for a set of musicians. */
export function progressPct(
  musicians: Record<string, MusicianRole>,
  progress: Record<string, LearningStage>
): number {
  const active = Object.keys(musicians).filter(n => (musicians[n].instruments?.length ?? 0) > 0);
  if (active.length === 0) return 100;
  const total = active.reduce((s, n) => s + STAGE_PCT[progress[n] ?? 'queue'], 0);
  return Math.round(total / active.length);
}

/** Inline CSS style string for a progress percentage bubble. */
export function pctBubbleStyle(pct: number): string {
  if (pct === 100) return 'border: 1px solid #16a34a; color: #16a34a; background: transparent';
  if (pct >= 75)   return 'background: rgba(255,220,0,0.2); color: #ca8a04';
  if (pct > 0)     return 'background: rgba(255,0,0,0.2); color: #dc2626';
  return                  'background: rgba(128,128,128,0.2); color: #6b7280';
}

export const INSTRUMENT_ORDER: Instrument[] = ['vocals', 'guitar', 'bass', 'keys', 'violin', 'drums', 'cajon', 'percussion'];

export const INSTRUMENT_ICONS: Record<Instrument, string> = {
  guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹',
  cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤',
};

export function formatAuditSummary(summary: string): string {
  return summary.replace(
    /\b(guitar|bass|drums|keys|cajon|violin|percussion|vocals)\b/g,
    (m) => INSTRUMENT_ICONS[m as Instrument] ?? m,
  );
}

export function sortInstruments(instruments: Instrument[]): Instrument[] {
  return [...instruments].sort((a, b) => INSTRUMENT_ORDER.indexOf(a) - INSTRUMENT_ORDER.indexOf(b));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const STAGE_ORDER: LearningStage[] = ['queue', 'structure', 'mastering', 'ready'];

/** Returns the worst (lowest) learning stage across participating musicians.
 *  If selectedMusicians is non-empty, only those musicians are considered. */
export function songReadiness(
  musicians: Record<string, MusicianRole>,
  progress: Record<string, LearningStage>,
  selectedMusicians: Set<string>,
): LearningStage {
  const names = Object.keys(musicians).filter(
    n => (musicians[n].instruments?.length ?? 0) > 0
      && (selectedMusicians.size === 0 || selectedMusicians.has(n))
  );
  if (names.length === 0) return 'ready';
  return names
    .map(n => progress[n] ?? 'queue')
    .reduce((worst, s) =>
      STAGE_ORDER.indexOf(s) < STAGE_ORDER.indexOf(worst) ? s : worst,
      'ready' as LearningStage
    );
}

/** Format a YYYY-MM-DD string as a human-readable date (e.g. "2 апреля 2026"). */
export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
}

/** Add `minutes` to a "HH:MM" time string, wrapping at midnight. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function isEventLongOver(date?: string, startTime?: string): boolean {
  if (!date) return false;
  const start = new Date(`${date}T${startTime ?? '00:00'}`);
  if (isNaN(start.getTime())) return false;
  return Date.now() - start.getTime() > 24 * 60 * 60 * 1000;
}

export function isEventFarFuture(date?: string, startTime?: string): boolean {
  if (!date) return false;
  const start = new Date(`${date}T${startTime ?? '00:00'}`);
  if (isNaN(start.getTime())) return false;
  return start.getTime() - Date.now() > 24 * 60 * 60 * 1000;
}

// ─── Budget ───────────────────────────────────────────────────────────────────

/** Format integer EUR cents as a localized currency string, e.g. 2710 → "27,10 €". */
export function formatEUR(cents: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Plain (no symbol) two-decimal format, used in the copy-paste report. e.g. 2710 → "27,10". */
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

/** Parse a user-typed EUR amount ("27,10" / "27.10" / "27") into integer cents. */
export function parseEUR(input: string): number {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export interface BudgetTotals {
  cash: number;      // cents on hand in cash
  transfer: number;  // cents on hand via transfers
  onHand: number;    // cash + transfer
  debts: number;     // outstanding (unpaid) debts
  balance: number;   // onHand − debts
}

/** Cumulative current financial state across all entries (all amounts in cents). */
export function budgetTotals(entries: BudgetEntry[]): BudgetTotals {
  let cash = 0;
  let transfer = 0;
  let debts = 0;
  for (const e of entries) {
    if (e.kind === 'income') {
      if (e.method === 'cash') cash += e.amount; else transfer += e.amount;
    } else if (e.kind === 'expense') {
      if (e.method === 'cash') cash -= e.amount; else transfer -= e.amount;
    } else if (e.kind === 'debt' && !e.paid) {
      debts += e.amount;
    }
  }
  return { cash, transfer, onHand: cash + transfer, debts, balance: cash + transfer - debts };
}

/** Build the copy-paste «По баблу» report from the current cumulative state. */
export function buildBudgetReport(entries: BudgetEntry[], setlists: Setlist[]): string {
  const t = budgetTotals(entries);
  const setlistName = (id?: string) => setlists.find(s => s.id === id)?.name;

  const lines: string[] = [];
  lines.push('Рубрика «По баблу»:');
  lines.push('');
  lines.push(`Наличка — ${formatAmount(t.cash)}`);
  lines.push(`Переводы — ${formatAmount(t.transfer)}`);
  lines.push(`Итого на руках — ${formatAmount(t.onHand)}`);

  const debts = entries.filter((e): e is Extract<BudgetEntry, { kind: 'debt' }> => e.kind === 'debt' && !e.paid);
  if (debts.length > 0) {
    const items = debts.map(d => {
      const note = d.comment || d.description || setlistName(d.setlistId);
      return `${formatAmount(d.amount)}${note ? ` (${note})` : ''}`;
    });
    lines.push('');
    lines.push(`Долги: ${items.join(' + ')} = ${formatAmount(t.debts)}`);
  }

  lines.push('');
  lines.push(`Итого наш баланс пока: ${formatAmount(t.balance)}`);
  return lines.join('\n');
}
