/**
 * Screen tiers from the theme (`--breakpoint-mid` / `--breakpoint-big` in app.css), for code that cannot use the Tailwind variants.
 *   small  < mid · mid  mid .. < big · big  ≥ big
 * The fallbacks only apply before the stylesheet is available (SSR / very early module evaluation).
 */
import { browser } from '$app/environment';

const FALLBACK = { mid: 1025, big: 1367 } as const;
export type Tier = keyof typeof FALLBACK;

/** Pixel width where tier `name` starts, read from the theme variable. */
export function breakpoint(name: Tier): number {
  if (!browser) return FALLBACK[name];
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--breakpoint-${name}`));
  return Number.isFinite(value) ? value : FALLBACK[name];
}

/** Media query list that matches while the viewport is narrower than tier `name` (`below('mid')` = small view). */
export function below(name: Tier, minWidth = 0): MediaQueryList {
  return window.matchMedia(`(width < ${Math.max(breakpoint(name), minWidth)}px)`);
}
