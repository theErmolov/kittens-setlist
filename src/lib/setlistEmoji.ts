/**
 * Every setlist gets an emoji picked by a hash of its title; the setlist list and the calendar show it.
 * Emoji are unique among the given setlists (a taken one moves on to the next free one) as long as there are fewer setlists than emoji.
 * Each emoji needs its SVG in static/emoji/ (named by codepoint) — the whole palette is vendored there.
 */
import type { Setlist } from './types';

export const SETLIST_EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦉', '🦄', '🐝', '🦋', '🐢', '🐙', '🦀', '🐬', '🐳', '🦈', '🐊', '🦒', '🦓', '🐘', '🦘', '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥝', '🍅', '🥑', '🌽', '🥕', '🍄', '🍕', '🍔', '🍩', '🍪', '🍫', '🍿', '🧀', '🥞', '🍦', '🎂', '🌟', '🌈', '🔥', '🍀'];

/** FNV-1a hash of the (trimmed, lower-cased) title. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (const ch of text.trim().toLowerCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** setlist id → emoji. Assigned in id order so the result does not depend on the list's sort order. */
export function setlistEmojis(setlists: Pick<Setlist, 'id' | 'name'>[]): Map<string, string> {
  const taken = new Set<number>();
  const out = new Map<string, string>();
  for (const sl of [...setlists].sort((a, b) => a.id.localeCompare(b.id))) {
    let i = hash(sl.name) % SETLIST_EMOJIS.length;
    if (taken.size < SETLIST_EMOJIS.length) while (taken.has(i)) i = (i + 1) % SETLIST_EMOJIS.length;
    taken.add(i);
    out.set(sl.id, SETLIST_EMOJIS[i]);
  }
  return out;
}
