import type { Song } from '$lib/types';

// Vocals don't count as an "instrument" for change-minimization purposes.
function effectiveKey(song: Song, musicianName: string): string | null {
  const instruments = song.musicians[musicianName]?.instruments;
  if (!instruments) return null;
  const effective = instruments.filter(i => i !== 'vocals');
  if (effective.length === 0) return null;
  return [...effective].sort().join(',');
}

function activeMusicianNames(songs: Song[]): string[] {
  const names = new Set<string>();
  for (const song of songs) {
    for (const name of Object.keys(song.musicians)) names.add(name);
  }
  return [...names];
}

/**
 * Cost of placing `next` right after `prev` (with `prev2` before `prev`).
 * For a musician active in `next`, look at the nearest preceding song they're
 * also active in:
 *  - adjacent (`prev`, distance 1): cost 1 only if the instrument actually changes
 *    — they're playing continuously, so only a literal swap is disruptive.
 *  - one song back (`prev2`, distance 2, i.e. they sat out exactly one song):
 *    cost 1 unconditionally — stepping off stage and back on is disruptive even
 *    if they pick the same instrument back up.
 *  - further back (2+ songs skipped) or no prior occurrence: cost 0 — a real
 *    break, no re-entry penalty.
 */
function transitionCost(prev2: Song | null, prev: Song | null, next: Song, musicians: string[]): number {
  let cost = 0;
  for (const name of musicians) {
    const nextKey = effectiveKey(next, name);
    if (nextKey === null) continue;
    if (prev !== null) {
      const prevKey = effectiveKey(prev, name);
      if (prevKey !== null) {
        if (prevKey !== nextKey) cost++;
        continue;
      }
    }
    if (prev2 !== null && effectiveKey(prev2, name) !== null) cost++;
  }
  return cost;
}

interface SortContext {
  anchorPrev2: Song | null;
  anchorPrev: Song | null;
  musicians: string[];
}

function buildContext(songs: Song[], anchors: Song[]): SortContext {
  const recentAnchors = anchors.slice(-2);
  return {
    anchorPrev2: recentAnchors.length >= 2 ? recentAnchors[recentAnchors.length - 2] : null,
    anchorPrev: recentAnchors.length >= 1 ? recentAnchors[recentAnchors.length - 1] : null,
    musicians: activeMusicianNames([...recentAnchors, ...songs]),
  };
}

/** Total instrument-change cost of `order`, chained after `anchors` (most recently played first...last). */
export function countChanges(order: Song[], anchors: Song[] = []): number {
  const { anchorPrev2, anchorPrev, musicians } = buildContext(order, anchors);
  let total = 0;
  let prev2 = anchorPrev2;
  let prev = anchorPrev;
  for (const song of order) {
    total += transitionCost(prev2, prev, song, musicians);
    prev2 = prev;
    prev = song;
  }
  return total;
}

const EXACT_LIMIT = 10;

function exactDP(songs: Song[], ctx: SortContext): Song[] {
  const { anchorPrev2, anchorPrev, musicians } = ctx;
  const n = songs.length;
  const memo = new Map<string, { cost: number; order: number[] }>();
  const full = (1 << n) - 1;

  function solve(mask: number, last: number, secondLast: number): { cost: number; order: number[] } {
    if (mask === full) return { cost: 0, order: [] };
    const key = `${mask}|${last}|${secondLast}`;
    const cached = memo.get(key);
    if (cached) return cached;
    const prevSong = songs[last];
    const prev2Song = secondLast === -1 ? anchorPrev : songs[secondLast];
    let best: { cost: number; order: number[] } | null = null;
    for (let j = 0; j < n; j++) {
      if (mask & (1 << j)) continue;
      const stepCost = transitionCost(prev2Song, prevSong, songs[j], musicians);
      const rest = solve(mask | (1 << j), j, last);
      const total = stepCost + rest.cost;
      if (!best || total < best.cost) best = { cost: total, order: [j, ...rest.order] };
    }
    memo.set(key, best!);
    return best!;
  }

  let best: { cost: number; order: number[] } | null = null;
  for (let i = 0; i < n; i++) {
    const stepCost = transitionCost(anchorPrev2, anchorPrev, songs[i], musicians);
    const rest = solve(1 << i, i, -1);
    const total = stepCost + rest.cost;
    if (!best || total < best.cost) best = { cost: total, order: [i, ...rest.order] };
  }
  return best!.order.map(i => songs[i]);
}

function heuristic(songs: Song[], ctx: SortContext): Song[] {
  const { anchorPrev2, anchorPrev, musicians } = ctx;
  const n = songs.length;
  const remaining = songs.map((_, i) => i);
  const order: number[] = [];
  let prev2 = anchorPrev2;
  let prev = anchorPrev;
  while (remaining.length) {
    let bestIdx = 0;
    let bestCost = Infinity;
    for (let k = 0; k < remaining.length; k++) {
      const c = transitionCost(prev2, prev, songs[remaining[k]], musicians);
      if (c < bestCost) { bestCost = c; bestIdx = k; }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    order.push(chosen);
    prev2 = prev;
    prev = songs[chosen];
  }

  const totalCost = (o: number[]) => countChanges(o.map(i => songs[i]), anchorPrev2 ? [anchorPrev2, anchorPrev!] : anchorPrev ? [anchorPrev] : []);
  let improved = true;
  let passes = 0;
  while (improved && passes < 3) {
    improved = false;
    passes++;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const before = totalCost(order);
        [order[i], order[j]] = [order[j], order[i]];
        const after = totalCost(order);
        if (after < before) {
          improved = true;
        } else {
          [order[i], order[j]] = [order[j], order[i]];
        }
      }
    }
  }
  return order.map(i => songs[i]);
}

/**
 * Reorder `songs` to minimize instrument changes across musicians, chained
 * after `anchors` (the songs immediately preceding this block, oldest first).
 */
export function sortSubset(songs: Song[], anchors: Song[] = []): Song[] {
  if (songs.length <= 1) return songs;
  const ctx = buildContext(songs, anchors);
  return songs.length <= EXACT_LIMIT ? exactDP(songs, ctx) : heuristic(songs, ctx);
}
