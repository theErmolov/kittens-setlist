import type { Rehearsal } from '$lib/types';
import { isUpcoming } from '$lib/rehearsals';

/** Wall-clock HH:MM (and optional end) exactly as stored for the rehearsal's own time zone; never parsed through Date. */
export const rehearsalTime = (r: Pick<Rehearsal, 'startTime' | 'endTime'>): string =>
  r.endTime ? `${r.startTime.slice(0, 5)}–${r.endTime.slice(0, 5)}` : r.startTime.slice(0, 5);

/** A rehearsal's day is over in its own time zone (cancelled ones included). */
export const isPastRehearsal = (r: Rehearsal): boolean => !isUpcoming({ ...r, cancelled: false });

/** Time text colour: brand purple; past rehearsals keep the hue but a darker/dimmer shade (light + dark). */
export const timeText = (past: boolean) =>
  past ? 'text-[color-mix(in_oklab,var(--primary-ink)_78%,black)]' : 'text-primary-ink';

/** Time chip in a calendar cell: filled purple; past = darker/dimmer purple fill, still readable white text. */
export const timeChip = (past: boolean, cancelled: boolean) =>
  cancelled
    ? 'border-transparent bg-danger text-danger-ink line-through'
    : past
      ? 'border-transparent bg-[color-mix(in_oklab,var(--primary)_78%,black)] text-primary-foreground'
      : 'border-transparent bg-primary text-primary-foreground';
