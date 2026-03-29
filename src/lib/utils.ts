import type { Instrument, LearningStage, MusicianRole } from '$lib/types';

export const STAGE_PCT: Record<LearningStage, number> = {
  nothing: 0, queue: 0, structure: 25, mastering: 75, ready: 100
};

/** Compute overall progress % (0–100) for a set of musicians. */
export function progressPct(
  musicians: Record<string, MusicianRole>,
  progress: Record<string, LearningStage>
): number {
  const active = Object.keys(musicians).filter(n => (musicians[n].instruments?.length ?? 0) > 0);
  if (active.length === 0) return 100;
  const total = active.reduce((s, n) => s + STAGE_PCT[progress[n] ?? 'nothing'], 0);
  return Math.round(total / active.length);
}

/** Inline CSS style string for a progress percentage bubble. */
export function pctBubbleStyle(pct: number): string {
  if (pct === 100) return 'border: 1px solid #22c55e; color: #22c55e; background: transparent';
  if (pct >= 75)   return 'background: rgba(59,130,246,0.22); color: #3b82f6';
  if (pct >= 25)   return 'background: rgba(245,158,11,0.30); color: #b45309';
  return                  'background: rgba(239,68,68,0.18); color: #ef4444';
}

export const INSTRUMENT_ORDER: Instrument[] = ['vocals', 'guitar', 'bass', 'keys', 'violin', 'drums', 'cajon', 'percussion'];

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

const STAGE_ORDER: LearningStage[] = ['nothing', 'queue', 'structure', 'mastering', 'ready'];

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
    .map(n => progress[n] ?? 'nothing')
    .reduce((worst, s) =>
      STAGE_ORDER.indexOf(s) < STAGE_ORDER.indexOf(worst) ? s : worst,
      'ready' as LearningStage
    );
}

/** Add `minutes` to a "HH:MM" time string, wrapping at midnight. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
