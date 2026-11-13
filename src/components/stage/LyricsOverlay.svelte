<script lang="ts">
  import { isChordLine, firstChord, CHORD_FIND_SRC, withoutChords } from '$lib/lyricsChords';
  import { packLyricsColumns, type LyricsPair } from '$lib/lyricsLayout';
  import { browser } from '$app/environment';
  import type { Song } from '$lib/types';
  import { canWrite } from '$lib/auth';
  import { t } from '$lib/i18n';
  import { useStore } from '$lib/store/bridge';
  import { lyricsStore } from '$lib/store/stage';
  import { useSaveSongTranspose } from '$lib/query/stage';
  import { Button } from '$components/ui/button';
  import { pressedOn } from '../setlist/classes';
  import IconButton from '$components/shared/IconButton.svelte';
  import { Slider } from '$components/ui/slider';
  import * as Dialog from '$components/ui/dialog';
  import * as DropdownMenu from '$components/ui/dropdown-menu';

  let { song, onclose, onsongupdate, onsavetranspose }: {
    song: Song;
    onclose: () => void;
    onsongupdate?: (song: Song) => void;
    onsavetranspose?: (song: Song) => Promise<Song>;
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


  // ── State ──────────────────────────────────────────────────────────────────

  const hideChords = useStore(lyricsStore, s => s.hideChords);
  const transpose = useStore(lyricsStore, s => s.transpose);
  const userFontSize = useStore(lyricsStore, s => s.userFontSize);
  const dropdownOpen = useStore(lyricsStore, s => s.dropdownOpen);
  const autoFontSize = useStore(lyricsStore, s => s.autoFontSize);
  const columns = useStore(lyricsStore, s => s.columns);
  const renderedColumns = useStore(lyricsStore, s => s.renderedColumns);
  const currentPage = useStore(lyricsStore, s => s.currentPage);
  const hasPagination = useStore(lyricsStore, s => s.hasPagination);
  const set = lyricsStore.setState;
  const saveSongMut = useSaveSongTranspose();
  // DOM element handle (not UI state): needed by the layout effects
  let lyricsBodyEl = $state<HTMLDivElement | null>(null);

  // ── Chord logic ────────────────────────────────────────────────────────────

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

    let result = line.slice(0, tokens[0].origStart);
    let outputPos = result.length;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      // Preserve labels and bar/repeat annotations as well as chord alignment.
      if (i > 0) {
        const between = line.slice(tokens[i - 1].origEnd, tok.origStart);
        if (between.trim()) { result += between; outputPos += between.length; }
      }
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
    rawLines.map(l => isChordLine(l) ? transposeChordLine(l, $transpose) : l)
  );

  let displayLines = $derived($hideChords ? withoutChords(rawLines) : transposedLines);

  let originalKey = $derived.by((): string => {
    for (const line of rawLines) {
      if (isChordLine(line)) {
        return firstChord(line);
      }
    }
    return '';
  });

  let targetKey = $derived(originalKey ? transposeChord(originalKey, $transpose) : '');

  let maxKeyLength = $derived.by(() => {
    if (!originalKey) return 0;
    return Math.max(...Array.from({ length: 12 }, (_, i) => transposeChord(originalKey, i).length));
  });

  let effectiveFontSize = $derived($userFontSize ?? $autoFontSize);

  let totalPages = $derived(Math.max(1, Math.ceil($renderedColumns.length / $columns)));
  let visibleColumns = $derived($renderedColumns.slice($currentPage * $columns, ($currentPage + 1) * $columns));

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
    const p1: LyricsPair = { chordLine: pair.chordLine, lyricLine: pair.lyricLine.slice(0, q).trimEnd() };
    const p2: LyricsPair = { chordLine: null, lyricLine: pair.lyricLine.slice(q).trimStart() };
    return [p1, ...wrapPair(p2, maxW, sizePx)];
  }

  // ── Main recompute ─────────────────────────────────────────────────────────

  function recompute() {
    if (!browser || !lyricsBodyEl) return;
    const clientW = lyricsBodyEl.clientWidth;
    const availH = lyricsBodyEl.clientHeight - BODY_PAD_V;
    if (clientW <= 0 || availH <= 0) return;

    const lines = displayLines;
    const uf = lyricsStore.getState().userFontSize;

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
      function layoutAt(size: number) {
        const pairs = buildPairs(lines).flatMap(pair => wrapPair(pair, Math.max(1, colAvail), size));
        return packLyricsColumns(pairs, size * LINE_HEIGHT, availH);
      }
      let packed = layoutAt(fontSize);
      // Total line height alone can fit while a chord/lyric pair cannot fit
      // at a column boundary. Reduce auto zoom until the actual columns fit.
      while (uf === null && fontSize > MIN_FONT && packed.length > cols) {
        fontSize--;
        packed = layoutAt(fontSize);
      }
      const pages = Math.max(1, Math.ceil(packed.length / cols));
      return { fontSize, cols, packed, pages };
    }

    const r1 = computeAt(clientW - BODY_PAD_L - BODY_PAD_R);
    if (!r1) return;

    let result = r1;
    let withButtons = false;
    if (r1.pages > 1) {
      const r2 = computeAt(clientW - BODY_PAD_L - PAGE_BTN_WIDTH);
      if (r2) { result = r2; withButtons = true; }
    }

    const cur = lyricsStore.getState();
    set({
      ...(uf === null ? { autoFontSize: result.fontSize } : {}),
      columns: result.cols,
      renderedColumns: result.packed,
      hasPagination: withButtons,
      ...(!withButtons || cur.currentPage >= result.pages ? { currentPage: 0 } : {}),
    });
  }

  // ── Effects ────────────────────────────────────────────────────────────────

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
    displayLines; // track
    $userFontSize;   // track
    recompute();
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  function prevPage() { set(s => ({ currentPage: Math.max(0, s.currentPage - 1) })); }
  function nextPage() { set(s => ({ currentPage: Math.min(totalPages - 1, s.currentPage + 1) })); }

  $effect(() => { song; set({ currentPage: 0, dropdownOpen: false }); });
  $effect(() => { song; set({ transpose: song.transpose ?? 0 }); });
  $effect(() => {
    void song.id;
    if (!browser) return;
    const stored = localStorage.getItem(`lyrics_zoom_${song.id}`);
    set({ userFontSize: stored !== null ? Number(stored) : null });
  });

  function toggleChords() {
    set(s => ({ hideChords: !s.hideChords, dropdownOpen: false, currentPage: 0 }));
  }

  // ── Zoom ──────────────────────────────────────────────────────────────────

  function setZoom(size: number) {
    const next = Math.min(96, Math.max(MIN_FONT, Math.round(size)));
    set({ userFontSize: next });
    if (browser) localStorage.setItem(`lyrics_zoom_${song.id}`, String(next));
  }
  const zoomIn = () => setZoom(effectiveFontSize + 1);
  const zoomOut = () => setZoom(effectiveFontSize - 1);

  // ── Transpose ─────────────────────────────────────────────────────────────

  let _saveTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSaveTranspose(value: number) {
    if (!$canWrite) return;
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      const changed = { ...song, transpose: value };
      const updated = onsavetranspose
        ? await onsavetranspose(changed)
        : await saveSongMut.mutateAsync(changed);
      onsongupdate?.(updated);
    }, 1500);
  }

  $effect(() => () => { if (_saveTimer) clearTimeout(_saveTimer); });

  function transposeUp() {
    const next = (lyricsStore.getState().transpose + 1) % 12;
    set({ transpose: next });
    scheduleSaveTranspose(next);
  }

  function transposeDown() {
    const next = (lyricsStore.getState().transpose + 11) % 12;
    set({ transpose: next });
    scheduleSaveTranspose(next);
  }
</script>

<Dialog.Root open onOpenChange={(o) => { if (!o) onclose(); }}>
  <Dialog.Content
    showCloseButton={false}
    interactOutsideBehavior="ignore"
    class="top-0 left-0 z-200 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 ring-0 mid:max-w-none"
  >
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-4 py-3 mid:flex-nowrap mid:gap-3">
      <IconButton icon="✕" label={$t.common.close} onclick={onclose} />
      <div class="flex min-w-0 flex-1 items-baseline gap-2">
        <Dialog.Title class="truncate text-base font-bold">{song.title}</Dialog.Title>
        <Dialog.Description class="truncate text-body text-muted-foreground">{song.artist}</Dialog.Description>
      </div>
      {#if $hasPagination}
        <span class="shrink-0 whitespace-nowrap text-body text-muted-foreground">{$currentPage + 1} / {totalPages}</span>
      {/if}
      <div class="flex shrink-0 items-center gap-2 max-mid:w-full max-mid:flex-wrap max-mid:justify-end">
        {#if originalKey}
          <IconButton icon="🚫" label={$hideChords ? $t.stage.showChords : $t.stage.hideChords} class={pressedOn} pressed={$hideChords} onpressedchange={() => toggleChords()} />
        {/if}
        <div class="flex items-center gap-2">
          <IconButton icon="A−" label={$t.stage.zoomOut} class="font-semibold" onclick={zoomOut} />
          <Slider
            type="single"
            class="w-24 [&_[data-slot=slider-thumb]]:size-5"
            min={MIN_FONT}
            max={96}
            step={1}
            value={Math.min(96, Math.max(MIN_FONT, effectiveFontSize))}
            onValueChange={setZoom}
            aria-label={$t.stage.zoomIn}
          />
          <IconButton icon="A+" label={$t.stage.zoomIn} class="font-semibold" onclick={zoomIn} />
        </div>
        {#if originalKey && !$hideChords}
          <div class="flex items-center gap-2">
            <IconButton icon="▼" label={$t.stage.semitoneDown} class="text-muted-foreground" onclick={transposeDown} />
            <DropdownMenu.Root open={$dropdownOpen} onOpenChange={(o) => set({ dropdownOpen: o })}>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <Button {...props} variant="outline" class="gap-1.5 font-bold" title={$t.stage.transpose} aria-label={$t.stage.transpose}>
                    <span class="font-mono" style:min-width="{maxKeyLength}ch">{targetKey}</span>
                    <span class="min-w-[3ch] font-mono text-lead font-normal tabular-nums text-muted-foreground" class:invisible={$transpose === 0}>{$transpose > 0 ? `+${$transpose}` : $transpose}</span>
                  </Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" class="z-300 w-auto min-w-47.5 p-0">
                {#each Array.from({ length: 12 }, (_, i) => i) as offset}
                  <DropdownMenu.Item
                    class="gap-2.5 rounded-none border-b px-3 py-1.75 text-body last:border-b-0 {offset === $transpose ? 'bg-muted' : ''}"
                    onSelect={() => { set({ transpose: offset, dropdownOpen: false }); scheduleSaveTranspose(offset); }}
                  >
                    <span class="min-w-7 font-bold tabular-nums {offset === $transpose ? 'text-primary-ink' : 'text-muted-foreground'}">{offset > 0 ? `+${offset}` : offset}</span>
                    <span class="font-mono">{transposeChord(originalKey, offset)}</span>
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            <IconButton icon="▲" label={$t.stage.semitoneUp} class="text-muted-foreground" onclick={transposeUp} />
          </div>
        {/if}
      </div>
    </div>

    <div class="relative flex-1 overflow-x-hidden overflow-y-auto py-4 pl-5" bind:this={lyricsBodyEl} style:padding-right="{$hasPagination ? PAGE_BTN_WIDTH : BODY_PAD_R}px">
      <div
        class="grid items-start gap-x-8 leading-[1.6]"
        class:grid-cols-1={$columns <= 1}
        class:grid-cols-2={$columns > 1}
        style:font-family={FONT_FAMILY}
        style:font-size="{effectiveFontSize}px"
      >
        {#each visibleColumns as column}
          <div class="min-w-0">
            {#each column as pair}
              <div class="break-inside-avoid">
                {#if pair.chordLine !== null}
                  <span class="block min-h-[1.6em] font-bold whitespace-pre text-lyrics-chord">{pair.chordLine || ' '}</span>
                {/if}
                <span class="block min-h-[1.6em] whitespace-pre text-lyrics-text">{pair.lyricLine || ' '}</span>
              </div>
            {/each}
          </div>
        {/each}
      </div>
      {#if $hasPagination}
        <!-- As on main: a full-height strip of two big purple buttons. -->
        <div class="absolute top-0 right-0 bottom-0 z-10 flex w-24 flex-col">
          <button type="button" aria-label={$t.stage.prevPage} class="flex flex-1 items-center justify-center border-b border-lyrics-pager-divider bg-lyrics-pager text-[2.5rem] leading-none text-lyrics-pager-ink transition-colors hover:not-disabled:bg-lyrics-pager-hover disabled:cursor-default disabled:opacity-25" onclick={prevPage} disabled={$currentPage === 0}>←</button>
          <button type="button" aria-label={$t.stage.nextPage} class="flex flex-1 items-center justify-center bg-lyrics-pager text-[2.5rem] leading-none text-lyrics-pager-ink transition-colors hover:not-disabled:bg-lyrics-pager-hover disabled:cursor-default disabled:opacity-25" onclick={nextPage} disabled={$currentPage >= totalPages - 1}>→</button>
        </div>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
