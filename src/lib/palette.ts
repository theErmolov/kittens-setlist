/**
 * Semantic colour tones (see the palette in src/app.css). Never hard-code colours in components: use a tone.
 * Tailwind: `bg-success text-success-ink`, `bg-warning`, `bg-info`, `bg-neutral`, `bg-danger`, `bg-primary`
 * (accent fill) + `text-primary-ink` (accent as text), `bg-danger-solid` (solid red).
 */
import type { LearningStage } from '$lib/types';

export type Tone = 'accent' | 'success' | 'warning' | 'info' | 'neutral' | 'danger';

/** Inline-style fill + ink for a tone (use where a Tailwind class cannot be chosen statically). */
export const toneStyle = (tone: Tone): string => `background: var(--t-${tone}-bg); color: var(--t-${tone}-ink)`;
/** The vivid colour of each tone (green, orange, red …): what an emphasised badge shifts towards. */
const VIVID: Record<Tone, string> = { accent: '#6c63ff', success: '#22c55e', warning: '#f97316', info: '#3b82f6', neutral: '#a1a1aa', danger: '#ef4444' };
/** A brighter, more saturated fill of the same tone (the pastel pushed towards its vivid colour) with the dark main text colour (semibold) for contrast, for emphasised badges. */
export const toneStrongStyle = (tone: Tone): string => `background: color-mix(in srgb, var(--t-${tone}-bg) 45%, ${VIVID[tone]}); color: var(--text); font-weight: 600`;
export const toneBg = (tone: Tone): string => `var(--t-${tone}-bg)`;
export const toneInk = (tone: Tone): string => `var(--t-${tone}-ink)`;

/** Learning stage → tone: queue = gray, structure = red, mastering = orange, ready = green. */
export const STAGE_TONE: Record<LearningStage, Tone> = { queue: 'neutral', structure: 'danger', mastering: 'warning', ready: 'success' };

/** Song category → tone: top = orange, mid = blue, low = green. */
export const CATEGORY_TONE: Record<'top' | 'mid' | 'low', Tone> = { top: 'warning', mid: 'info', low: 'success' };

/** Readiness percent → tone: 100 = green, >=75 = orange, >0 = red, 0 = gray. */
export const pctTone = (pct: number): Tone => (pct === 100 ? 'success' : pct >= 75 ? 'warning' : pct > 0 ? 'danger' : 'neutral');
