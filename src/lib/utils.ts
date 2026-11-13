import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** tailwind-merge that knows the app's custom type scale (`--text-*`) and radius (`--radius-soft`) from app.css, so `text-small` and `text-muted-foreground` are not mistaken for each other. */
const twMerge = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: ['micro', 'tiny', 'caption', 'small', 'body', 'body-lg', 'lead', 'title-sm', 'title', 'glyph'] }], rounded: [{ rounded: ['soft'] }], leading: [{ leading: ['compact'] }] } } });

/** Strips a leading emoji / drag-handle glyph and whitespace from a label ("🎛️ Filters" → "Filters"). */
export const stripLeadingEmoji = (text: string) => text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D⠿\s]+/u, '');

/** ISO date (YYYY-MM-DD) from numeric year, 1-based month and day. */
export const isoDate = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Class-name helper used by the shadcn-svelte components. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Type helpers used by the shadcn-svelte components (src/components/ui).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

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

/** Classes for a progress percentage bubble: 100 = green outline, >=75 = yellow, >0 = red, 0 = gray (the `--pct-*` tokens). */
export function pctBubbleClass(pct: number): string {
  return pct === 100 ? 'border-pct-full-border bg-pct-full-bg text-pct-full-ink'
    : pct >= 75 ? 'border-pct-high-border bg-pct-high-bg text-pct-high-ink'
    : pct > 0 ? 'border-pct-low-border bg-pct-low-bg text-pct-low-ink'
    : 'border-pct-none-border bg-pct-none-bg text-pct-none-ink';
}

export const INSTRUMENT_ORDER: Instrument[] = ['vocals', 'guitar', 'bass', 'keys', 'violin', 'saxophone', 'trumpet', 'drums', 'cajon', 'percussion'];

const KNOWN_INSTRUMENT_ICONS: Record<Instrument, string> = {
  guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹',
  cajon: '🪘', violin: '🎻', saxophone: '🎷', trumpet: '🎺', percussion: '🪇', vocals: '🎤',
};

/** Instrument → emoji. Unknown/legacy instrument values fall back to 🎵 so an icon is always shown. */
export const INSTRUMENT_ICONS: Record<Instrument, string> = new Proxy(KNOWN_INSTRUMENT_ICONS, {
  get: (target, key) => target[key as Instrument] ?? '🎵',
});

/** Minutes an entry takes in a setlist: a break's length, a song's length (5 when unknown). */
export const entryMinutes = (e: { breakMinutes?: number; song?: { lengthMinutes?: number } }): number => e.breakMinutes ?? e.song?.lengthMinutes ?? 5;

export function sortInstruments(instruments: Instrument[]): Instrument[] {
  return [...instruments].sort((a, b) => INSTRUMENT_ORDER.indexOf(a) - INSTRUMENT_ORDER.indexOf(b));
}

export function formatDuration(minutes: number, lang: 'ru' | 'en' = 'en'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === 'en') {
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
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
export function formatDate(dateStr: string, lang: 'ru' | 'en' = 'ru'): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
}

/** Add `minutes` to a "HH:MM" time string, wrapping at midnight. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Milliseconds from now until the event starts (negative once it has started); null without a valid date. */
function msUntilStart(date?: string, startTime?: string): number | null {
  if (!date) return null;
  const start = new Date(`${date}T${startTime ?? '00:00'}`);
  return isNaN(start.getTime()) ? null : start.getTime() - Date.now();
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isEventLongOver(date?: string, startTime?: string): boolean {
  const ms = msUntilStart(date, startTime);
  return ms !== null && -ms > DAY_MS;
}

export function isEventFarFuture(date?: string, startTime?: string): boolean {
  const ms = msUntilStart(date, startTime);
  return ms !== null && ms > DAY_MS;
}

// ─── Budget ───────────────────────────────────────────────────────────────────

/** Format integer EUR cents as a localized currency string, e.g. 2710 → "27,10 €". */
export function formatEUR(cents: number, lang: 'ru' | 'en' = 'ru'): string {
  return new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Plain report-entry format: whole euros omit decimals, cents keep two digits. */
export function formatAmount(cents: number, lang: 'ru' | 'en' = 'ru'): string {
  const fractionDigits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(cents / 100);
}

/** Calculated report totals omit insignificant trailing zeroes. */
function formatReportTotal(cents: number, lang: 'ru' | 'en'): string {
  return new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', { maximumFractionDigits: 2 }).format(cents / 100);
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
export function buildBudgetReport(entries: BudgetEntry[], setlists: Setlist[], now = Date.now(), lang: 'ru' | 'en' = 'ru'): string {
  const t = budgetTotals(entries);
  const setlistName = (id?: string) => setlists.find(s => s.id === id)?.name;

  const latestPastSetlist = setlists
    .map(setlist => {
      if (!setlist.date) return null;
      const startsAt = new Date(`${setlist.date}T${setlist.startTime ?? '00:00'}`).getTime();
      return Number.isNaN(startsAt) || startsAt > now ? null : { setlist, startsAt };
    })
    .filter((item): item is { setlist: Setlist; startsAt: number } => item !== null)
    .sort((a, b) => b.startsAt - a.startsAt)[0]?.setlist;

  const recentDonations = entries
    .filter((entry): entry is Extract<BudgetEntry, { kind: 'income' }> => (
      entry.kind === 'income' && entry.setlistId === latestPastSetlist?.id
    ))
    .sort((a, b) => a.date.localeCompare(b.date));
  const recentDonationTotal = recentDonations.reduce((sum, entry) => sum + entry.amount, 0);

  const lines: string[] = [];
  lines.push(lang === 'ru' ? 'Рубрика «По баблу»:' : 'Money report:');
  lines.push('');

  for (const donation of recentDonations) {
    const label = donation.person?.trim() || (donation.method === 'cash'
      ? (lang === 'ru' ? 'Наличка' : 'Cash')
      : (lang === 'ru' ? 'Пейпал' : 'PayPal'));
    lines.push(`${label} — ${formatAmount(donation.amount, lang)}`);
  }

  if (recentDonations.length > 0) lines.push('');
  lines.push(`${lang === 'ru' ? 'Котятский банк' : 'Kittens bank'} — ${formatReportTotal(t.onHand - recentDonationTotal, lang)}`);
  lines.push(`${lang === 'ru' ? 'Итого на руках' : 'Total on hand'} — ${formatReportTotal(t.onHand, lang)}`);

  const debts = entries.filter((e): e is Extract<BudgetEntry, { kind: 'debt' }> => e.kind === 'debt' && !e.paid);
  if (debts.length > 0) {
    lines.push('');

    const debtsByCreditor = new Map<string, typeof debts>();
    for (const debt of [...debts].sort((a, b) => a.date.localeCompare(b.date))) {
      const creditor = debt.creditor?.trim() ?? '';
      debtsByCreditor.set(creditor, [...(debtsByCreditor.get(creditor) ?? []), debt]);
    }

    for (const [creditor, creditorDebts] of debtsByCreditor) {
      const items = creditorDebts.map(debt => {
        const note = debt.description || debt.comment || setlistName(debt.setlistId);
        return `${formatAmount(debt.amount, lang)}${note ? ` ${note}` : ''}`;
      });
      lines.push(`${lang === 'ru' ? 'Долг' : 'Debt'}${creditor ? ` ${creditor}` : ''}: ${items.join(' + ')}`);
    }
  }

  lines.push('');
  lines.push(`${lang === 'ru' ? 'Итого наш баланс пока' : 'Current balance'}: ${formatReportTotal(t.balance, lang)}`);
  return lines.join('\n');
}

/** Display roster members in users-list order, then ad-hoc guests in saved order. */
export function orderMusicianNames(names: string[], roster: { name: string }[]): string[] {
  const remaining = new Set(names);
  const ordered: string[] = [];
  for (const musician of roster) {
    if (remaining.delete(musician.name)) ordered.push(musician.name);
  }
  return [...ordered, ...remaining];
}

/** Clock-face emoji showing `date`'s time rounded to the nearest half hour (🕐 = 1:00 … 🕛 = 12:00, 🕜 = 1:30 … 🕧 = 12:30). */
export function clockEmoji(date: Date): string {
  const half = Math.round((date.getHours() * 60 + date.getMinutes()) / 30) % 48; // 0..47 half-hours
  const hour12 = Math.floor(half / 2) % 12 === 0 ? 12 : Math.floor(half / 2) % 12;
  const isHalf = half % 2 === 1;
  return String.fromCodePoint((isHalf ? 0x1f55b : 0x1f54f) + hour12);
}
