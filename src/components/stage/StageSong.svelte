<script lang="ts">
  import Note from '$components/shared/Note.svelte';
  import type { Song, SetlistEntry, BandMusician } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { sortInstruments } from '$lib/utils';
  import { t } from '$lib/i18n';

  const instrumentIcons: Record<string, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', saxophone: '🎷', trumpet: '🎺', percussion: '🪇', vocals: '🎤'
  };

  let {
    song,
    entry,
    position,
    startTime,
    musicians = [],
    selectedMusician = '',
    canMark = true,
    ontoggle,
    onlyricsclick,
  }: {
    song: Song;
    entry: SetlistEntry;
    position: number;
    startTime?: string;
    musicians: BandMusician[];
    selectedMusician?: string;
    canMark?: boolean;
    ontoggle: () => void;
    onlyricsclick?: () => void;
  } = $props();

  let permanentNames = $derived(new Set(musicians.map(m => m.name)));

  let rosterCells = $derived.by(() => {
    const cells = musicians.map(m => {
      const role = song.musicians[m.name];
      const active = (role?.instruments?.length ?? 0) > 0;
      const highlight = !!selectedMusician && m.name === selectedMusician && !!active;
      return { name: m.name, role: role ?? null, active, highlight };
    });
    // append ad-hoc guests
    for (const [name, role] of Object.entries(song.musicians)) {
      if (!permanentNames.has(name) && role.instruments.length > 0) {
        cells.push({ name, role, active: true, highlight: !!selectedMusician && name === selectedMusician });
      }
    }
    return cells;
  });
</script>

<div
  class="stage-song"
  class:played={entry.played}
  class:no-mark={!canMark}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="song-main" onclick={ontoggle}>
    <!--
      Mobile: 3-col grid — [col-meta spans rows] | [col-info / col-musicians] | [col-time]
      Desktop: 4-col grid — [col-meta] [col-info] [col-comment] [col-musicians]
    -->
    <div class="col-meta">
      <div class="meta-num">
        <span class="position">{position}</span>
        <CategoryBadge category={song.category} iconOnly />
      </div>
      {#if song.lyrics && onlyricsclick}
        <button class="lyrics-btn" onclick={(e) => { e.stopPropagation(); onlyricsclick?.(); }} title={$t.common.lyrics}>📝</button>
      {/if}
    </div>
    <div class="col-info">
      <span class="title">{song.title}</span>
      <span class="artist">{song.artist}</span>

      {#if entry.comment || entry.personalComment}
        <div class="comment-mobile">
          {#if entry.comment}<div>{entry.comment}</div>{/if}
          <Note value={entry.personalComment} label={$t.common.personalComment} />
        </div>
      {/if}
    </div>
    <div class="col-time">
      {#if startTime}<span class="start-time">{startTime}</span>{/if}
    </div>
    <div class="col-musicians">
      <div class="musicians">
        {#each rosterCells as cell}
          <span
            class="musician"
            class:inactive={!cell.active}
            class:highlight={cell.highlight}
          >
            {#if cell.active}
              <span class="m-icons" class:has-name={!!cell.name}>
                {#each sortInstruments(cell.role?.instruments ?? []) as inst (inst)}
                  <span>{instrumentIcons[inst]}</span>
                {/each}
              </span>
              <span class="m-name">
                {cell.name}
              </span>
            {/if}
          </span>
        {/each}
      </div>
      {#if startTime}<span class="start-time start-time-desktop">{startTime}</span>{/if}
    </div>
    <div class="col-comment">
      <div class="comment-notes">
        {#if entry.comment}<div class="col-comment-text">{entry.comment}</div>{/if}
        <Note value={entry.personalComment} label={$t.common.personalComment} />
      </div>
      {#if song.lyrics && onlyricsclick}
        <button class="lyrics-side-btn" onclick={(e) => { e.stopPropagation(); onlyricsclick?.(); }} title={$t.common.lyrics}>📝</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .stage-song {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    transition: background 0.15s, opacity 0.15s;
    overflow: hidden;
  }
  .stage-song.played { opacity: 0.45; }
  .stage-song.played .title { text-decoration: line-through; }

  /* ── Mobile: 3-column grid ── */
  .song-main {
    flex: 1;
    display: grid;
    grid-template-columns: 44px 1fr auto;
    grid-template-rows: auto auto;
    cursor: pointer;
    text-align: left;
    min-width: 0;
  }
  .song-main:hover { background: var(--row-hover); }
  .stage-song.no-mark .song-main { cursor: default; }
  .stage-song.no-mark .song-main:hover { background: transparent; }

  /* Col 1: position + category + lyrics button, spans both rows */
  .col-meta {
    grid-column: 1;
    grid-row: 1 / 3;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .meta-num {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 4px;
  }
  .position { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); }
  .lyrics-btn {
    flex: 1;
    width: 100%;
    background: #7c3aed;
    color: #fff;
    border: none;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    touch-action: manipulation;
    line-height: 1;
    cursor: pointer;
    min-height: 44px;
  }

  /* Col 2 row 1: title + artist (inline) */
  .col-info {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 4px;
    row-gap: 0;
    padding: 6px 8px;
    min-width: 0;
    align-content: flex-start;
  }
  .title { font-size: 1rem; font-weight: 700; color: var(--text); }
  .artist { font-size: 0.85rem; font-weight: 400; color: var(--text-muted); }
  .artist::before { content: "·"; margin-right: 2px; }
  .comment-mobile { flex-basis: 100%; margin-top: 2px; font-size: 0.78rem; color: var(--text); font-weight: 500; }

  /* Col 3 row 1: time */
  .col-time {
    grid-column: 3;
    grid-row: 1;
    display: flex;
    align-items: center;
    padding: 6px 8px 6px 4px;
    flex-shrink: 0;
  }
  .start-time { font-size: 0.82rem; font-weight: 600; color: var(--accent); white-space: nowrap; }
  .start-time-desktop { display: none; }

  /* Col 2–3 row 2: musicians */
  .col-comment { display: none; }
  .col-musicians {
    grid-column: 2 / 4;
    grid-row: 2;
    display: flex;
  }
  .musicians {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px 4px;
    font-size: 0.82rem;
    color: var(--text-muted);
    min-width: 0;
    padding: 5px 8px 8px 8px;
  }

  .musician {
    display: flex; align-items: center; gap: 4px;
    background: #fcd34d40; border-radius: 6px;
    padding: 1px 6px 1px 3px; min-width: 0; overflow: hidden;
  }
  .musician.inactive { background: none; }
  .musician.highlight { background: #f59e0b; color: #1a1200; }
  :global([data-theme="dark"]) .musician:not(.inactive):not(.highlight) { background: #78350f; }
  :global([data-theme="dark"]) .musician.highlight { background: #d97706; color: #fff; }

  .m-icons { flex-shrink: 0; display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center; gap: 1px; line-height: 1.1; font-size: 1.17rem; }
  .m-name {
    overflow: hidden; white-space: nowrap; min-width: 0; flex: 1;
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 16px), transparent 100%);
    mask-image: linear-gradient(to right, black calc(100% - 16px), transparent 100%);
  }
  :global([data-theme="dark"]) .musician:not(.inactive):not(.highlight) .m-name { color: #d1d5db; }

  /* ── Desktop / tablet landscape: 4-column grid ── */
  @media (min-width: 701px) {
    .song-main {
      display: grid;
      grid-template-columns: 64px 1.66fr 1.49fr 1.75fr;
      grid-template-rows: 1fr;
      align-items: stretch;
      min-height: 60px;
    }

    .col-meta {
      grid-column: 1; grid-row: 1;
      flex-direction: column; align-items: stretch; justify-content: flex-start;
    }
    .meta-num { flex-direction: column; gap: 4px; align-items: center; justify-content: center; padding: 4px 8px; flex: 1; }
    .position { font-size: 1.05rem; }
    .lyrics-btn { display: none; }

    .col-info {
      grid-column: 2; grid-row: 1;
      flex-direction: column; justify-content: center;
      gap: 2px; padding: 5px 14px;
    }
    .title { font-size: 1.8rem; line-height: 1.15; }
    .artist { font-size: 0.88rem; }
    .comment-mobile { display: none; }

    .col-time { display: none; }
    .start-time-desktop { display: inline; flex-shrink: 0; font-size: 0.9rem; font-weight: 700; color: var(--accent); }

    .col-comment {
      grid-column: 3; grid-row: 1;
      display: flex; align-items: stretch; gap: 0; padding: 0; min-width: 0;
    }
    .comment-notes { flex: 1; align-self: center; min-width: 0; padding: 8px 14px; }
    .col-comment-text {
      flex: 1; align-self: center;
      font-size: 0.92rem; font-weight: 500; color: var(--text);
      word-break: break-word; overflow-wrap: break-word; white-space: normal; min-width: 0;
    }
    .lyrics-side-btn {
      background: var(--accent); border: none; cursor: pointer;
      font-size: 1.6rem; line-height: 1;
      align-self: stretch; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      padding: 0 22px; min-width: 64px;
      color: #1a1200; margin-left: auto;
      transition: filter 0.15s;
    }
    .lyrics-side-btn:hover { filter: brightness(1.1); }

    .col-musicians {
      grid-column: 4; grid-row: 1;
      display: flex; align-items: center; gap: 8px; padding: 5px 12px;
    }
    .musicians { flex: 1; padding: 0; }
  }

  @media (max-width: 700px) {
    .stage-song { border-radius: 0; border-left: none; border-right: none; }
    .song-main:hover { background: transparent; }
  }

</style>
