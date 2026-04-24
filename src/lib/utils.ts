import type { Instrument, LearningStage, MusicianRole } from '$lib/types';

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
