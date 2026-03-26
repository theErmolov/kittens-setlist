<script lang="ts">
  import type { Song, SetlistEntry, BandMusician, LearningStage } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { sortInstruments } from '$lib/utils';

  const instrumentIcons: Record<string, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };

  const STAGE_COLOR: Record<LearningStage, string> = {
    nothing: '#94a3b8', queue: '#cbd5e1', structure: '#f59e0b', mastering: '#3b82f6', ready: '#22c55e'
  };
  const READINESS_COLOR: Record<LearningStage, string> = {
    nothing: '#ef4444', queue: '#cbd5e1', structure: '#f59e0b', mastering: '#3b82f6', ready: '#22c55e'
  };

  let {
    song,
    entry,
    position,
    startTime,
    liveProgress = {},
    readiness = 'nothing',
    musicians = [],
    selectedMusician = '',
    canMark = true,
    ontoggle
  }: {
    song: Song;
    entry: SetlistEntry;
    position: number;
    startTime?: string;
    liveProgress?: Record<string, LearningStage>;
    readiness?: LearningStage;
    musicians: BandMusician[];
    selectedMusician?: string;
    canMark?: boolean;
    ontoggle: () => void;
  } = $props();

  let permanentNames = $derived(new Set(musicians.map(m => m.name)));

  let rosterCells = $derived(() => {
    const cells = musicians.map(m => {
      const role = song.musicians[m.name];
      const active = (role?.instruments?.length ?? 0) > 0;
      const highlight = !!selectedMusician && m.name === selectedMusician && !!active;
      const stage = (liveProgress[m.name] ?? 'nothing') as LearningStage;
      return { name: m.name, role: role ?? null, active, highlight, stage };
    });
    // append ad-hoc guests
    for (const [name, role] of Object.entries(song.musicians)) {
      if (!permanentNames.has(name) && role.instruments.length > 0) {
        const stage = (liveProgress[name] ?? 'nothing') as LearningStage;
        cells.push({ name, role, active: true, highlight: !!selectedMusician && name === selectedMusician, stage });
      }
    }
    return cells;
  });
</script>

<button
  class="stage-song"
  class:played={entry.played}
  class:no-mark={!canMark}
  style="border-left-color: {READINESS_COLOR[readiness]}"
  onclick={ontoggle}
>
  <div class="song-main">
    <div class="song-top">
      <span class="position">{position}</span>
      <CategoryBadge category={song.category} iconOnly />
      <span class="title">{song.title}</span>
      <span class="artist">{song.artist}</span>
      {#if startTime}<span class="start-time">{startTime}</span>{/if}
    </div>
    <div class="musicians">
      {#each rosterCells() as cell}
        <span class="musician" class:inactive={!cell.active} class:highlight={cell.highlight}>
          {#if cell.active}
            <span class="prog-dot" style="background: {STAGE_COLOR[cell.stage]}"></span>
            <span class="m-icons" class:has-name={!!cell.name}>{sortInstruments(cell.role?.instruments ?? []).map(i => instrumentIcons[i]).join('')}</span>
            <span class="m-name">{cell.name}</span>
          {/if}
        </span>
      {/each}
    </div>
    {#if entry.comment}
      <div class="comment">{entry.comment}</div>
    {/if}
  </div>
</button>

<style>
  .stage-song {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-left-width: 4px;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, opacity 0.15s;
    gap: 8px;
  }
  .stage-song:hover { background: var(--row-hover); }
  .stage-song.no-mark { cursor: default; }
  .stage-song.no-mark:hover { background: var(--surface); }
  .stage-song.played { opacity: 0.45; }
  .stage-song.played .song-top { text-decoration: line-through; }

  .song-main { flex: 1; }

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

  .prog-dot {
    width: 6px; height: 6px; border-radius: 50%;
    flex-shrink: 0;
  }

  .m-icons { flex-shrink: 0; display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 1px; line-height: 1.1; font-size: 1.17rem; }
  .m-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
  .comment {
    margin-top: 2px;
    font-size: 0.78rem;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
