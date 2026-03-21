import type { Instrument } from '$lib/types';

export const INSTRUMENT_ORDER: Instrument[] = ['vocals', 'guitar', 'bass', 'keys', 'violin', 'drums', 'percussion', 'maracas'];

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

/** Add `minutes` to a "HH:MM" time string, wrapping at midnight. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
