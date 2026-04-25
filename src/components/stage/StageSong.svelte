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
      <span class="title">{song.title}</span>
      {#if song.lyrics && onlyricsclick}
        <button class="lyrics-inline-btn" onclick={(e) => { e.stopPropagation(); onlyricsclick(); }} title="Текст песни">♪</button>
      {/if}
      <span class="artist">{song.artist}</span>
      {#if startTime}<span class="start-time">{startTime}</span>{/if}
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
    {#if entry.comment}
      <div class="comment">{entry.comment}</div>
    {/if}
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

  .lyrics-inline-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--text-muted);
    padding: 4px 6px;
    line-height: 1;
    opacity: 0.6;
    transition: opacity 0.12s, color 0.12s;
    touch-action: manipulation;
  }
  .lyrics-inline-btn:hover { opacity: 1; color: var(--accent); }

  @media (max-width: 700px) {
    .lyrics-inline-btn { font-size: 1.1rem; padding: 6px 8px; opacity: 0.75; }
  }

  .song-top {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 2px;
  }
  .position { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); min-width: 1.4em; text-align: right; }
  .title { font-size: 1rem; font-weight: 700; color: var(--text); }
  .artist { font-size: 0.85rem; font-weight: 400; color: var(--text-muted); }
  .start-time { margin-left: auto; font-size: 0.82rem; font-weight: 600; color: var(--accent); white-space: nowrap; }

  .musicians {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px 4px;
    font-size: 0.82rem;
    color: var(--text-muted);
    margin-top: 5px;
    padding-left: calc(1.4em + 6px);
  }
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
  .m-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
  .comment {
    margin-top: 2px;
    font-size: 0.78rem;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
