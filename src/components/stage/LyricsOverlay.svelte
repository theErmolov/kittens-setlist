<script lang="ts">
  import { browser } from '$app/environment';
  import type { Song } from '$lib/types';
  import { updateSong } from '$lib/api';
  import { canWrite } from '$lib/auth';

  let { song, onclose, onsongupdate }: {
    song: Song;
    onclose: () => void;
    onsongupdate?: (song: Song) => void;
  } = $props();

  // ── Constants ──────────────────────────────────────────────────────────────

  const MIN_FONT = 12;
  const MAX_FONT = 100;
  const FONT_FAMILY = `'JetBrains Mono', 'Consolas', 'Courier New', monospace`;
  const LINE_HEIGHT = 1.6;
  const BODY_PAD_L = 20;     // left padding
  const BODY_PAD_R = 20;     // right padding when no page buttons
  const BODY_PAD_V = 32;     // top + bottom padding
  const COL_GAP = 32;
  const PAGE_BTN_WIDTH = 96; // width of prev/next page buttons

  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const FLAT_TO_SHARP: Record<string, string> = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#' };

  const CHORD_TOKEN_RE = /^[A-G][b#]?(?:m(?:aj\d*)?|sus[24]?|aug|dim|\d+(?:add\d+)?)*(?:\/[A-G][b#]?)?$/;
  const ANNOTATION_TOKEN_RE = /^(?:[}\]|([)]*[xхх×]\d+|[+-]\d+)$/i;
  const CHORD_FIND_SRC = /[A-G][b#]?(?:m(?:aj\d*)?|sus[24]?|aug|dim|\d+(?:add\d+)?)*(?:\/[A-G][b#]?)?/.source;

  // ── Types ──────────────────────────────────────────────────────────────────

  type LyricsPair = { chordLine: string | null; lyricLine: string };

  // ── State ──────────────────────────────────────────────────────────────────

  let transpose = $state(song.transpose ?? 0);
  let userFontSize = $state<number | null>(null);
  let dropdownOpen = $state(false);
  let autoFontSize = $state(MIN_FONT);
  let columns = $state(1);
  let renderedPairs = $state<LyricsPair[]>([]);
  let lyricsBodyEl = $state<HTMLDivElement | null>(null);
  let currentPage = $state(0);
  let pairsPerCol = $state(0);
  let hasPagination = $state(false);

  // ── Chord logic ────────────────────────────────────────────────────────────

  function isChordLine(line: string): boolean {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    return tokens.length > 0
      && tokens.some(t => CHORD_TOKEN_RE.test(t))
      && tokens.every(t => CHORD_TOKEN_RE.test(t) || ANNOTATION_TOKEN_RE.test(t));
  }

  function transposeRoot(root: string, n: number): string {
    const i = NOTES.indexOf(FLAT_TO_SHARP[root] ?? root);
    if (i === -1) return root;
    return NOTES[((i + n) % 12 + 12) % 12];
  }

  function transposeChord(chord: string, n: number): string {
    if (n === 0) return chord;
    const slash = chord.lastIndexOf('/');
    if (slash > 0) {
      return transposeChord(chord.slice(0, slash), n) + '/' + transposeRoot(chord.slice(slash + 1), n);
    }
    const m = chord.match(/^([A-G][b#]?)(.*)/);
    if (!m) return chord;
    return transposeRoot(m[1], n) + m[2];
  }

  function transposeChordLine(line: string, n: number): string {
    if (n === 0) return line;
    const re = new RegExp(CHORD_FIND_SRC, 'g');
    const tokens: Array<{ origStart: number; origEnd: number; transposed: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      tokens.push({ origStart: m.index, origEnd: m.index + m[0].length, transposed: transposeChord(m[0], n) });
    }
    if (tokens.length === 0) return line;

    let result = '';
    let outputPos = 0;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      // First token keeps its original position; subsequent must have at least 1 space gap
      const targetPos = i === 0 ? tok.origStart : Math.max(outputPos + 1, tok.origStart);
      if (targetPos > outputPos) {
        result += ' '.repeat(targetPos - outputPos);
        outputPos = targetPos;
      }
      result += tok.transposed;
      outputPos += tok.transposed.length;
    }
    // Preserve any trailing non-whitespace content after the last chord
    const lastTok = tokens[tokens.length - 1];
    const trailing = line.slice(lastTok.origEnd).trim();
    if (trailing) { result += ' ' + trailing; }
    return result;
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  let rawLines = $derived((song.lyrics ?? '').split('\n'));

  let transposedLines = $derived(
    rawLines.map(l => isChordLine(l) ? transposeChordLine(l, transpose) : l)
  );

  let originalKey = $derived.by((): string => {
    for (const line of rawLines) {
      if (isChordLine(line)) {
        return line.trim().split(/\s+/).filter(Boolean)[0] ?? '';
      }
    }
    return '';
  });

  let targetKey = $derived(originalKey ? transposeChord(originalKey, transpose) : '');

  let maxKeyLength = $derived.by(() => {
    if (!originalKey) return 0;
    return Math.max(...Array.from({ length: 12 }, (_, i) => transposeChord(originalKey, i).length));
  });

  let effectiveFontSize = $derived(userFontSize ?? autoFontSize);

  let totalPages = $derived.by(() =>
    pairsPerCol <= 0 ? 1 : Math.max(1, Math.ceil(renderedPairs.length / (pairsPerCol * columns)))
  );

  let visiblePairs = $derived.by(() => {
    if (!hasPagination) return renderedPairs;
    const perPage = pairsPerCol * columns;
    return renderedPairs.slice(currentPage * perPage, (currentPage + 1) * perPage);
  });

  // ── Measurement ────────────────────────────────────────────────────────────

  let _canvas: HTMLCanvasElement | null = null;

  function measureLine(text: string, sizePx: number): number {
    if (!browser) return text.length * sizePx * 0.6;
    _canvas ??= document.createElement('canvas');
    const ctx = _canvas.getContext('2d')!;
    ctx.font = `${sizePx}px ${FONT_FAMILY}`;
    return ctx.measureText(text).width;
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  function findOptimalFontSize(lines: string[], maxW: number, maxH: number): number {
    let lo = MIN_FONT, hi = MAX_FONT, best = MIN_FONT;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const widthOk = lines.every(l => measureLine(l, mid) <= maxW);
      const heightOk = lines.length * mid * LINE_HEIGHT <= maxH;
      if (widthOk && heightOk) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return best;
  }

  // ── Wrapping ───────────────────────────────────────────────────────────────

  function buildPairs(lines: string[]): LyricsPair[] {
    const pairs: LyricsPair[] = [];
    let i = 0;
    while (i < lines.length) {
      const cur = lines[i];
      const next = lines[i + 1];
      if (isChordLine(cur) && next !== undefined && !isChordLine(next)) {
        pairs.push({ chordLine: cur, lyricLine: next });
        i += 2;
      } else if (isChordLine(cur)) {
        pairs.push({ chordLine: cur, lyricLine: '' });
        i++;
      } else {
        pairs.push({ chordLine: null, lyricLine: cur });
        i++;
      }
    }
    return pairs;
  }

  function findWordBoundary(text: string, charPos: number): number {
    let p = Math.min(charPos, text.length);
    // Search backward for a space
    while (p > 0 && text[p - 1] !== ' ') p--;
    if (p > 0) return p;
    // No space found before — search forward
    let q = charPos;
    while (q < text.length && text[q] !== ' ') q++;
    return q < text.length ? q + 1 : text.length;
  }

  function findSplitPos(line: string, maxW: number, sizePx: number): number {
    let lo = 0, hi = line.length, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (measureLine(line.slice(0, mid), sizePx) <= maxW) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return best;
  }

  function wrapPair(pair: LyricsPair, maxW: number, sizePx: number): LyricsPair[] {
    const cw = pair.chordLine ? measureLine(pair.chordLine, sizePx) : 0;
    const lw = measureLine(pair.lyricLine, sizePx);
    if (cw <= maxW && lw <= maxW) return [pair];

    if (pair.chordLine && cw > maxW) {
      const p = findSplitPos(pair.chordLine, maxW, sizePx);
      const q = findWordBoundary(pair.lyricLine, p);
      const p1: LyricsPair = {
        chordLine: pair.chordLine.slice(0, p).trimEnd() || null,
        lyricLine: pair.lyricLine.slice(0, q).trimEnd(),
      };
      const p2: LyricsPair = {
        chordLine: pair.chordLine.slice(p).trimStart() || null,
        lyricLine: pair.lyricLine.slice(q).trimStart(),
      };
      const result: LyricsPair[] = [];
      if (p1.chordLine || p1.lyricLine) result.push(p1);
      if (p2.chordLine || p2.lyricLine) result.push(...wrapPair(p2, maxW, sizePx));
      return result.length ? result : [pair];
    }

    // Lyric-only overflow — wrap at word boundary
    const p = findSplitPos(pair.lyricLine, maxW, sizePx);
    const q = findWordBoundary(pair.lyricLine, p);
    if (!q || q >= pair.lyricLine.length) return [pair];
    const p1: LyricsPair = { chordLine: null, lyricLine: pair.lyricLine.slice(0, q).trimEnd() };
    const p2: LyricsPair = { chordLine: null, lyricLine: pair.lyricLine.slice(q).trimStart() };
    return [p1, ...wrapPair(p2, maxW, sizePx)];
  }

  // ── Main recompute ─────────────────────────────────────────────────────────

  function recompute() {
    if (!browser || !lyricsBodyEl) return;
    const clientW = lyricsBodyEl.clientWidth;
    const availH = lyricsBodyEl.clientHeight - BODY_PAD_V;
    if (clientW <= 0 || availH <= 0) return;

    const lines = transposedLines;
    const uf = userFontSize;

    function computeAt(avail: number) {
      if (avail <= 0) return null;
      let fontSize: number;
      let cols: number;

      if (uf === null) {
        const longestAtMin = lines.reduce((mx, l) => Math.max(mx, measureLine(l, MIN_FONT)), 0);
        if (longestAtMin < avail / 2) {
          const colW = (avail - COL_GAP) / 2;
          fontSize = findOptimalFontSize(lines, colW, availH * 2);
          cols = 2;
        } else {
          fontSize = findOptimalFontSize(lines, avail, availH);
          cols = 1;
        }
      } else {
        fontSize = uf;
        const longest = lines.reduce((mx, l) => Math.max(mx, measureLine(l, uf)), 0);
        cols = longest < avail / 2 ? 2 : 1;
      }

      const colAvail = cols === 2 ? (avail - COL_GAP) / 2 : avail;
      const pairs = buildPairs(lines).flatMap(p => wrapPair(p, Math.max(1, colAvail), fontSize));

      const lineH = fontSize * LINE_HEIGHT;
      let h = 0, ppc = 0;
      for (const pair of pairs) {
        const ph = (pair.chordLine ? 2 : 1) * lineH;
        if (h + ph > availH && ppc > 0) break;
        h += ph;
        ppc++;
      }
      const pairsPerColumn = Math.max(1, ppc);
      const pages = Math.max(1, Math.ceil(pairs.length / (pairsPerColumn * cols)));
      return { fontSize, cols, pairs, pairsPerColumn, pages };
    }

    const r1 = computeAt(clientW - BODY_PAD_L - BODY_PAD_R);
    if (!r1) return;

    let result = r1;
    let withButtons = false;
    if (r1.pages > 1) {
      const r2 = computeAt(clientW - BODY_PAD_L - PAGE_BTN_WIDTH);
      if (r2) { result = r2; withButtons = true; }
    }

    if (uf === null) autoFontSize = result.fontSize;
    columns = result.cols;
    renderedPairs = result.pairs;
    pairsPerCol = result.pairsPerColumn;
    hasPagination = withButtons;
    if (!hasPagination || currentPage >= result.pages) currentPage = 0;
  }

  // ── Effects ────────────────────────────────────────────────────────────────

  $effect(() => {
    if (!browser) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  });

  $effect(() => {
    if (!browser) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onclose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ResizeObserver — fires on container size change
  $effect(() => {
    if (!browser || !lyricsBodyEl) return;
    const obs = new ResizeObserver(recompute);
    obs.observe(lyricsBodyEl);
    recompute(); // initial layout
    return () => obs.disconnect();
  });

  // Re-run when lyrics content or manual font size changes
  $effect(() => {
    transposedLines; // track
    userFontSize;    // track
    recompute();
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  function prevPage() { currentPage = Math.max(0, currentPage - 1); }
  function nextPage() { currentPage = Math.min(totalPages - 1, currentPage + 1); }

  $effect(() => { song; currentPage = 0; });
  $effect(() => { song; transpose = song.transpose ?? 0; });
  $effect(() => {
    void song.id;
    if (!browser) return;
    const stored = localStorage.getItem(`lyrics_zoom_${song.id}`);
    userFontSize = stored !== null ? Number(stored) : null;
  });

  // ── Zoom ──────────────────────────────────────────────────────────────────

  function zoomIn() {
    const next = Math.min((userFontSize ?? autoFontSize) + 1, 96);
    userFontSize = next;
    if (browser) localStorage.setItem(`lyrics_zoom_${song.id}`, String(next));
  }

  function zoomOut() {
    const next = Math.max((userFontSize ?? autoFontSize) - 1, MIN_FONT);
    userFontSize = next;
    if (browser) localStorage.setItem(`lyrics_zoom_${song.id}`, String(next));
  }

  // ── Transpose ─────────────────────────────────────────────────────────────

  let _saveTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSaveTranspose(value: number) {
    if (!$canWrite) return;
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      const updated = await updateSong({ ...song, transpose: value }, true);
      onsongupdate?.(updated);
    }, 1500);
  }

  $effect(() => () => { if (_saveTimer) clearTimeout(_saveTimer); });

  function transposeUp() {
    transpose = (transpose + 1) % 12;
    scheduleSaveTranspose(transpose);
  }

  function transposeDown() {
    transpose = (transpose + 11) % 12;
    scheduleSaveTranspose(transpose);
  }
</script>

<div class="overlay">
  <div class="overlay-header">
    <button class="close-btn" onclick={onclose}>✕</button>
    <div class="song-info">
      <span class="song-title">{song.title}</span>
      <span class="song-artist">{song.artist}</span>
    </div>
    {#if hasPagination}
      <span class="page-counter">{currentPage + 1} / {totalPages}</span>
    {/if}
    <div class="header-controls">
      <div class="zoom-buttons">
        <button class="zoom-btn" onclick={zoomOut} title="Smaller">A−</button>
        <button class="zoom-btn" onclick={zoomIn} title="Larger">A+</button>
      </div>
      {#if originalKey}
        <div class="transpose-wrap">
          <div class="transpose-controls">
            <button class="step-btn" onclick={transposeDown} title="Semitone down">▼</button>
            <button
              class="transpose-btn"
              class:active={dropdownOpen}
              onclick={() => { dropdownOpen = !dropdownOpen; }}
              title="Transpose"
            >
              <span class="key-label" style:min-width="{maxKeyLength}ch">{targetKey}</span>
              <span class="offset-label" style:visibility={transpose === 0 ? 'hidden' : 'visible'}>{transpose > 0 ? `+${transpose}` : transpose}</span>
            </button>
            <button class="step-btn" onclick={transposeUp} title="Semitone up">▲</button>
          </div>
          {#if dropdownOpen}
            <div
              class="dropdown-backdrop"
              role="button"
              tabindex="-1"
              onclick={() => { dropdownOpen = false; }}
              onkeydown={() => { dropdownOpen = false; }}
            ></div>
            <div class="dropdown-panel">
              {#each Array.from({ length: 12 }, (_, i) => i) as offset}
                <button
                  class="dropdown-row"
                  class:selected={offset === transpose}
                  onclick={() => { transpose = offset; dropdownOpen = false; scheduleSaveTranspose(offset); }}
                >
                  <span class="d-offset">{offset > 0 ? `+${offset}` : offset}</span>
                  <span class="d-keys">{transposeChord(originalKey, offset)}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <div class="lyrics-body" bind:this={lyricsBodyEl}>
    <div
      class="lyrics-content"
      class:two-col={columns > 1}
      style:font-size="{effectiveFontSize}px"
      style:columns={columns > 1 ? columns : undefined}
    >
      {#each visiblePairs as pair}
        <div class="pair">
          {#if pair.chordLine !== null}
            <span class="chord-line">{pair.chordLine || ' '}</span>
          {/if}
          <span class="lyric-line">{pair.lyricLine || ' '}</span>
        </div>
      {/each}
    </div>
    {#if hasPagination}
      <div class="page-nav">
        <button class="page-btn" onclick={prevPage} disabled={currentPage === 0}>←</button>
        <button class="page-btn" onclick={nextPage} disabled={currentPage >= totalPages - 1}>→</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: var(--bg);
    display: flex;
    flex-direction: column;
  }

  .overlay-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.65rem;
    color: var(--text-muted);
    padding: 6px 12px;
    flex-shrink: 0;
    line-height: 1;
  }
  .close-btn:hover { color: var(--text); }

  .song-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }
  .song-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .song-artist {
    font-size: 0.85rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .zoom-buttons {
    display: flex;
    gap: 4px;
  }

  .zoom-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 1.275rem;
    font-weight: 600;
    color: var(--text);
    line-height: 1;
    transition: background 0.15s;
  }
  .zoom-btn:hover { background: var(--chip-bg); }

  .transpose-wrap {
    position: relative;
  }

  .transpose-controls {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .step-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 6px 14px;
    cursor: pointer;
    font-size: 1.275rem;
    color: var(--text-muted);
    line-height: 1;
    transition: background 0.15s, color 0.15s;
  }
  .step-btn:hover { background: var(--chip-bg); color: var(--text); }

  .transpose-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 6px 15px;
    cursor: pointer;
    font-size: 1.275rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background 0.15s, border-color 0.15s;
  }
  .transpose-btn:hover,
  .transpose-btn.active { background: var(--chip-bg); border-color: var(--accent); }

  .key-label {
    font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
  }

  .offset-label {
    font-size: 1.05rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
    min-width: 3ch;
  }

  .dropdown-backdrop {
    position: fixed;
    inset: 0;
    z-index: 298;
    cursor: default;
  }

  .dropdown-panel {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    z-index: 299;
    min-width: 190px;
    overflow: hidden;
  }

  .dropdown-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 12px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    font-size: 0.88rem;
    color: var(--text);
    text-align: left;
    transition: background 0.1s;
  }
  .dropdown-row:last-child { border-bottom: none; }
  .dropdown-row:hover { background: var(--row-hover); }
  .dropdown-row.selected { background: var(--chip-bg); }

  .d-offset {
    min-width: 28px;
    font-weight: 700;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .dropdown-row.selected .d-offset { color: var(--accent); }

  .d-keys {
    font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
  }

  .lyrics-body {
    position: relative;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px 20px;
  }

  .lyrics-content {
    font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
    line-height: 1.6;
    column-gap: 32px;
  }

  .lyrics-content.two-col {
    column-fill: auto;
    height: 100%;
  }

  .pair {
    break-inside: avoid;
  }

  .chord-line {
    display: block;
    white-space: pre;
    color: #60a5fa;
    font-weight: bold;
    min-height: 1.6em;
  }

  .lyric-line {
    display: block;
    white-space: pre;
    color: #ffffff;
    min-height: 1.6em;
  }

  :global([data-theme="light"]) .chord-line {
    color: #e8305a;
  }

  :global([data-theme="light"]) .lyric-line {
    color: #000000;
  }

  .page-counter {
    font-size: 0.85rem;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .page-nav {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 96px;
    display: flex;
    flex-direction: column;
    z-index: 10;
  }

  .page-btn {
    flex: 1;
    background: #7c3aed;
    border: none;
    color: #ffffff;
    font-size: 2.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    line-height: 1;
  }
  .page-btn:first-child { border-bottom: 1px solid rgba(255,255,255,0.2); }
  .page-btn:hover:not(:disabled) { background: #6d28d9; }
  .page-btn:disabled { opacity: 0.25; cursor: default; }
</style>
