<script lang="ts">
  import type { Setlist, Song, Category } from '$lib/types';
  import StageSong from './StageSong.svelte';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import SortBar, { type SortKey } from '$components/shared/SortBar.svelte';
  import { togglePlayed } from '$lib/api';
  import { t } from '$lib/i18n';

  let {
    setlist,
    allSongs
  }: {
    setlist: Setlist;
    allSongs: Song[];
  } = $props();

  let categoryFilter = $state(new Set<Category>());
  let sortKey = $state<SortKey>('default');
  let onlyWithComment = $state(false);

  let songMap = $derived(new Map(allSongs.map(s => [s.id, s])));

  type DisplayItem =
    | { kind: 'song'; entry: typeof setlist.entries[0]; song: Song }
    | { kind: 'break'; entry: typeof setlist.entries[0] };

  let sortedEntries = $derived((): DisplayItem[] => {
    const sorted = [...setlist.entries].sort((a, b) => a.order - b.order);

    if (sortKey !== 'default') {
      // When sorting by name, only show songs (no breaks)
      return sorted
        .filter(e => e.songId)
        .map(e => ({ kind: 'song' as const, entry: e, song: songMap.get(e.songId!) }))
        .filter((x): x is { kind: 'song'; entry: typeof x.entry; song: Song } => x.song !== undefined)
        .filter(({ song }) => {
          if (categoryFilter.size > 0 && !categoryFilter.has(song.category)) return false;
          if (onlyWithComment && !song.comment) return false;
          return true;
        })
        .sort((a, b) => sortKey === 'artist'
          ? a.song.artist.localeCompare(b.song.artist)
          : a.song.title.localeCompare(b.song.title));
    }

    return sorted.flatMap(e => {
      if (e.breakMinutes) return [{ kind: 'break' as const, entry: e }];
      const song = e.songId ? songMap.get(e.songId) : undefined;
      if (!song) return [];
      if (categoryFilter.size > 0 && !categoryFilter.has(song.category)) return [];
      if (onlyWithComment && !song.comment) return [];
      return [{ kind: 'song' as const, entry: e, song }];
    });
  });

  async function handleToggle(songId: string) {
    await togglePlayed(setlist.id, songId);
  }

  let playedCount = $derived(setlist.entries.filter(e => e.songId && e.played).length);
  let visibleCount = $derived(sortedEntries().length);
  let totalCount = $derived(setlist.entries.filter(e => e.songId).length);
</script>

<div class="stage">
  <div class="stage-header">
    <div class="stage-title">
      <a href="/setlists/{setlist.id}" class="back-link">←</a>
      <span class="name">{setlist.name}</span>
      <span class="progress">
        {playedCount}/{totalCount}
        {#if visibleCount !== totalCount}<span class="filtered-count">{$t.stage.shown(visibleCount)}</span>{/if}
      </span>
    </div>
    <div class="stage-controls">
      <SortBar sort={sortKey} onchange={v => { sortKey = v; }} />
      <label class="comment-toggle">
        <input type="checkbox" bind:checked={onlyWithComment} />
        {$t.stage.comment}
      </label>
    </div>
    <FilterChips selected={categoryFilter} onchange={v => { categoryFilter = v; }} />
  </div>

  <div class="song-list">
    {#each sortedEntries() as item, i (item.entry.songId ?? `break-${item.entry.order}`)}
      {#if item.kind === 'song'}
        <StageSong song={item.song} entry={item.entry} position={i + 1} ontoggle={() => handleToggle(item.entry.songId!)} />
      {:else}
        <div class="stage-break">⏸ {item.entry.breakMinutes} мин</div>
      {/if}
    {/each}
    {#if sortedEntries().length === 0}
      <p class="empty">{$t.stage.noSongs}</p>
    {/if}
  </div>
</div>

<style>
  .stage { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); }

  .stage-header {
    position: sticky; top: 0; z-index: 10;
    background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 10px 14px; display: flex; flex-direction: column; gap: 8px;
  }
  .stage-title { display: flex; align-items: center; gap: 10px; }
  .back-link { text-decoration: none; color: var(--accent); font-size: 1.2rem; line-height: 1; }
  .name { font-size: 1.05rem; font-weight: 700; flex: 1; }

  .progress {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.88rem; color: var(--text-muted);
    background: var(--chip-bg); padding: 2px 8px; border-radius: 10px; white-space: nowrap;
  }
  .filtered-count { font-size: 0.78rem; opacity: 0.75; }

  .stage-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .comment-toggle { display: flex; align-items: center; gap: 4px; font-size: 0.78rem; cursor: pointer; color: var(--text-muted); }

  .song-list { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  .empty { text-align: center; color: var(--text-muted); padding: 40px; }
  .stage-break {
    text-align: center; padding: 6px 12px; font-size: 0.82rem;
    color: var(--text-muted); border: 1px dashed var(--border); border-radius: 8px;
    letter-spacing: 0.03em;
  }
</style>
