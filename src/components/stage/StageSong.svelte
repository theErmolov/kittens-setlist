<script lang="ts">
  import type { Song, SetlistEntry, BandMusician } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { sortInstruments } from '$lib/utils';

  const instrumentIcons: Record<string, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
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
      .top-row becomes display:contents on desktop so col-meta and col-info
      are direct grid children of .song-main alongside col-musicians.
      On mobile .top-row is a normal flex row.
    -->
    <div class="top-row">
      <div class="col-meta" class:has-lyrics={!!(song.lyrics && onlyricsclick)}>
        <div class="meta-num">
          <span class="position">{position}</span>
          <CategoryBadge category={song.category} iconOnly />
        </div>
        {#if song.lyrics && onlyricsclick}
          <button class="lyrics-col-btn" onclick={(e) => { e.stopPropagation(); onlyricsclick?.(); }} title="Текст песни">📝</button>
        {/if}
      </div>
      <div class="col-info">
        <div class="title-row">
          <span class="title">{song.title}</span>
          {#if startTime}<span class="start-time start-time-mobile">{startTime}</span>{/if}
        </div>
        <span class="artist">{song.artist}</span>
        {#if entry.comment}<div class="comment comment-mobile">{entry.comment}</div>{/if}
      </div>
    </div>
    <div class="col-comment">
      {#if entry.comment}<span class="col-comment-text">{entry.comment}</span>{/if}
      {#if song.lyrics && onlyricsclick}
        <button class="lyrics-side-btn" onclick={(e) => { e.stopPropagation(); onlyricsclick?.(); }} title="Текст песни">📝</button>
      {/if}
    </div>
    <div class="col-musicians">
      <div class="musicians">
        {#each rosterCells as cell}
          <span class="musician" class:inactive={!cell.active} class:highlight={cell.highlight}>
            {#if cell.active}
              <span class="m-icons" class:has-name={!!cell.name}>{#each sortInstruments(cell.role?.instruments ?? []) as inst (inst)}<span>{instrumentIcons[inst]}</span>{/each}</span>
              <span class="m-name">{cell.name}</span>
            {/if}
          </span>
        {/each}
      </div>
      {#if startTime}<span class="start-time start-time-desktop">{startTime}</span>{/if}
    </div>
  </div>
</div>

<style>
  .stage-song {
    display: flex;
    align-items: center;
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    transition: background 0.15s, opacity 0.15s;
    overflow: hidden;
  }
  .stage-song.played { opacity: 0.45; }
  .stage-song.played .title { text-decoration: line-through; }

  .song-main {
    flex: 1;
    padding: 8px 12px;
    cursor: pointer;
    text-align: left;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .song-main:hover { background: var(--row-hover); }
  .stage-song.no-mark .song-main { cursor: default; }
  .stage-song.no-mark .song-main:hover { background: transparent; }

  /* ── Mobile defaults ── */
  .top-row { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px; }
  .col-meta { display: flex; flex-direction: row; align-items: center; gap: 4px; flex-shrink: 0; }
  .meta-num { display: flex; align-items: center; gap: 4px; }
  .col-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

  .title-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .position { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); min-width: 1.4em; text-align: right; }
  .title { font-size: 1rem; font-weight: 700; color: var(--text); }
  .artist { font-size: 0.85rem; font-weight: 400; color: var(--text-muted); }
  .start-time { font-size: 0.82rem; font-weight: 600; color: var(--accent); white-space: nowrap; }
  .start-time-mobile { margin-left: auto; }
  .start-time-desktop { display: none; }
  .comment-mobile { margin-top: 2px; font-size: 0.78rem; color: var(--text); font-weight: 500; }
  .col-comment { display: none; }

  .lyrics-col-btn {
    background: none; border: none; cursor: pointer;
    font-size: 1.1rem; padding: 4px; touch-action: manipulation; line-height: 1;
  }

  .col-musicians { display: flex; align-items: stretch; margin: 0 -12px -8px; }
  .musicians {
    flex: 1; display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 3px 4px; font-size: 0.82rem; color: var(--text-muted); min-width: 0;
    padding: 5px 12px 8px;
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

  /* ── Desktop / tablet landscape ── */
  @media (min-width: 701px) {
    .song-main {
      display: grid;
      grid-template-columns: 64px 1.4fr 2fr 1.5fr;
      align-items: stretch;
      padding: 0;
      min-height: 72px;
    }
    /* flatten top-row so col-meta and col-info sit directly in the 4-col grid */
    .top-row { display: contents; }

    .col-meta {
      flex-direction: column; align-items: center; justify-content: center;
      gap: 4px; padding: 6px 8px;
      border-right: 1px solid var(--border);
    }
    .meta-num { flex-direction: column; gap: 4px; }
    .position { font-size: 1.05rem; }
    .col-meta .lyrics-col-btn { display: none; }

    .col-info {
      flex: unset; display: flex; flex-direction: column; justify-content: center;
      gap: 2px; padding: 8px 14px; min-width: 0;
    }
    .title-row { align-items: baseline; gap: 10px; flex-wrap: nowrap; width: 100%; }
    .title { font-size: 1.5rem; line-height: 1.15; }
    .artist { font-size: 0.88rem; }
    .start-time { margin-left: auto; font-size: 0.9rem; font-weight: 700; }

    .comment-mobile { display: none; }

    .col-comment {
      display: flex; align-items: stretch; gap: 0;
      padding: 0; min-width: 0;
    }
    .col-comment-text {
      flex: 1; align-self: center;
      font-size: 0.92rem; font-weight: 500; color: var(--text);
      padding: 8px 14px;
      word-break: break-word; overflow-wrap: break-word; white-space: normal; min-width: 0;
    }
    .lyrics-side-btn {
      background: var(--accent); border: none; cursor: pointer;
      font-size: 1.6rem; line-height: 1;
      align-self: stretch; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      padding: 0 22px; min-width: 64px;
      color: #1a1200;
      margin-left: auto;
      transition: filter 0.15s;
    }
    .lyrics-side-btn:hover { filter: brightness(1.1); }

    .start-time-mobile { display: none; }
    .start-time-desktop { display: inline; flex-shrink: 0; font-size: 0.9rem; font-weight: 700; }
    .col-musicians { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin: 0; }
    .musicians { flex: 1; padding: 0; }
  }

  @media (max-width: 700px) {
    .stage-song { border-radius: 0; border-left: none; border-right: none; }
    .song-main:hover { background: transparent; }
  }
</style>
