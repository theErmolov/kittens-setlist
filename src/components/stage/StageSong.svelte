<script lang="ts">
  import type { Song, SetlistEntry } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';

  const instrumentIcons: Record<string, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', percussion: '🪘', violin: '🎻'
  };

  let {
    song,
    entry,
    position,
    ontoggle
  }: {
    song: Song;
    entry: SetlistEntry;
    position: number;
    ontoggle: () => void;
  } = $props();
</script>

<button class="stage-song" class:played={entry.played} onclick={ontoggle}>
  <div class="song-main">
    <div class="song-top">
      <span class="position">{position}</span>
      <CategoryBadge category={song.category} iconOnly />
      <span class="title">{song.title}</span>
      <span class="artist">{song.artist}</span>
    </div>
    <div class="musicians">
      {#each Object.entries(song.musicians) as [name, role]}
        <span class="musician">
          {name}
          {role.instrument ? instrumentIcons[role.instrument] : ''}
          {#if role.vocals}🎤{/if}
        </span>
      {/each}
      {#if song.extraMusicians}
        <span class="extra">{song.extraMusicians}</span>
      {/if}
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

  .musicians {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 0.82rem;
    color: var(--text-muted);
  }
  .musician { display: flex; align-items: center; gap: 2px; }
  .extra { color: var(--text-muted); font-style: italic; }

  .comment {
    margin-top: 2px;
    font-size: 0.78rem;
    color: var(--text-muted);
    font-style: italic;
  }

</style>
