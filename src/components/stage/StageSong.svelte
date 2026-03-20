<script lang="ts">
  import type { Song, SetlistEntry, BandMusician } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';

  const instrumentIcons: Record<string, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', percussion: '🪘', violin: '🎻'
  };

  let {
    song,
    entry,
    position,
    startTime,
    musicians = [],
    ontoggle
  }: {
    song: Song;
    entry: SetlistEntry;
    position: number;
    startTime?: string;
    musicians: BandMusician[];
    ontoggle: () => void;
  } = $props();

  let rosterCells = $derived(
    musicians.map(m => {
      const role = song.musicians[m.name];
      const active = role && (role.instrument || role.vocals);
      return { name: m.name, role: role ?? null, active: !!active };
    })
  );
</script>

<button class="stage-song" class:played={entry.played} onclick={ontoggle}>
  <div class="song-main">
    <div class="song-top">
      <span class="position">{position}</span>
      <CategoryBadge category={song.category} iconOnly />
      <span class="title">{song.title}</span>
      <span class="artist">{song.artist}</span>
      {#if startTime}<span class="start-time">{startTime}</span>{/if}
    </div>
    <div class="musicians" style="grid-template-columns: repeat({musicians.length || 1}, 1fr)">
      {#each rosterCells as cell}
        <span class="musician" class:inactive={!cell.active}>
          {#if cell.active}
            <span class="m-icons" class:has-name={!!cell.name}>{cell.role?.instrument ? instrumentIcons[cell.role.instrument] : ''}{#if cell.role?.vocals}🎤{/if}</span>
            <span class="m-name">{cell.name}</span>
          {/if}
        </span>
      {/each}
    </div>
    {#if song.extraMusicians}
      <div class="extra">{song.extraMusicians}</div>
    {/if}
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
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, opacity 0.15s;
    gap: 8px;
  }
  .stage-song:hover { background: var(--row-hover); }
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
    gap: 3px 4px;
    font-size: 0.82rem;
    color: var(--text-muted);
    margin-top: 5px;
    padding-left: calc(1.4em + 6px);
  }
  .musician {
    display: flex; align-items: center; gap: 1px;
    background: #fcd34d40; border-radius: 6px;
    padding: 1px 6px 1px 3px;
    min-width: 0;
    overflow: hidden;
  }
  .musician.inactive { background: none; }
  :global([data-theme="dark"]) .musician:not(.inactive) { background: #78350f; }
  .m-icons { flex-shrink: 0; white-space: nowrap; letter-spacing: -0.2em; }
  .m-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
  .extra { padding-left: calc(1.4em + 6px); font-size: 0.78rem; color: var(--text-muted); font-style: italic; margin-top: 2px; }

  .comment {
    margin-top: 2px;
    font-size: 0.78rem;
    color: var(--text-muted);
    font-style: italic;
  }

</style>
