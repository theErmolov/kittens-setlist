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
    <div class="song-top">
      <span class="position">{position}</span>
      <CategoryBadge category={song.category} iconOnly />
      <div class="song-top-right">
        <div class="song-top-line">
          <span class="title">{song.title}</span>
          <span class="artist">{song.artist}</span>
          {#if startTime}<span class="start-time">{startTime}</span>{/if}
        </div>
        {#if entry.comment}
          <div class="comment">{entry.comment}</div>
        {/if}
      </div>
    </div>
    <div class="song-bottom">
      <div class="bottom-left" class:has-lyrics={!!(song.lyrics && onlyricsclick)}>
        {#if song.lyrics && onlyricsclick}
          <button class="lyrics-col-btn" onclick={(e) => { e.stopPropagation(); onlyricsclick?.(); }} title="Текст песни">📝</button>
        {/if}
      </div>
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
    gap: 8px;
    overflow: hidden;
  }
  .stage-song.played { opacity: 0.45; }
  .stage-song.played .song-top { text-decoration: line-through; }

  .song-main {
    flex: 1;
    padding: 8px 12px;
    cursor: pointer;
    text-align: left;
    min-width: 0;
  }
  .song-main:hover { background: var(--row-hover); }
  .stage-song.no-mark .song-main { cursor: default; }
  .stage-song.no-mark .song-main:hover { background: transparent; }

  .song-bottom {
    display: flex;
    align-items: stretch;
    gap: 6px;
    margin-top: 5px;
    margin-left: -12px;
    margin-right: -12px;
    margin-bottom: -8px;
  }
  .bottom-left {
    width: calc(12px + 1.4em);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px 0;
  }
  .bottom-left.has-lyrics { background: var(--accent); }
  .lyrics-col-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    padding: 4px;
    touch-action: manipulation;
    line-height: 1;
  }

  .musicians {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px 4px;
    font-size: 0.82rem;
    color: var(--text-muted);
    min-width: 0;
    padding: 5px 12px 8px 0;
  }

  .song-top {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 2px;
  }
  .song-top-right { flex: 1; min-width: 0; }
  .song-top-line {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .position { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); min-width: 1.4em; text-align: right; }
  .title { font-size: 1rem; font-weight: 700; color: var(--text); }
  .artist { font-size: 0.85rem; font-weight: 400; color: var(--text-muted); }
  .start-time { margin-left: auto; font-size: 0.82rem; font-weight: 600; color: var(--accent); white-space: nowrap; }

  .musician {
    display: flex; align-items: center; gap: 4px;
    background: #fcd34d40; border-radius: 6px;
    padding: 1px 6px 1px 3px;
    min-width: 0;
    overflow: hidden;
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
  .comment {
    margin-top: 2px;
    font-size: 0.78rem;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
