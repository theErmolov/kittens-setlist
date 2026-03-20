<script lang="ts">
  import { onMount } from 'svelte';
  import type { Setlist, Song, Category, SetlistEntry, BandMusician } from '$lib/types';
  import StageSong from './StageSong.svelte';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import SortBar, { type SortKey } from '$components/shared/SortBar.svelte';
  import { getSetlist, togglePlayed } from '$lib/api';
  import { t } from '$lib/i18n';
  import { startPolling } from '$lib/poller';
  import { formatDuration, addMinutes } from '$lib/utils';

  let {
    setlist,
    allSongs,
    musicians = []
  }: {
    setlist: Setlist;
    allSongs: Song[];
    musicians: BandMusician[];
  } = $props();

  let localEntries = $state<SetlistEntry[]>([...setlist.entries]);
  $effect(() => { localEntries = [...setlist.entries]; });

  function applyPoll(incoming: SetlistEntry[]) {
    const sorted = [...incoming].sort((a, b) => a.order - b.order);
    const localSorted = [...localEntries].sort((a, b) => a.order - b.order);
    if (JSON.stringify(sorted) === JSON.stringify(localSorted)) return;
    localEntries = incoming;
  }

  onMount(() => startPolling(
    async () => { const s = await getSetlist(setlist.id); if (s) applyPoll(s.entries); },
    2000,
    () => false,
  ));

  let categoryFilter = $state(new Set<Category>());
  let sortKey = $state<SortKey>('default');
  let onlyWithComment = $state(false);

  let songMap = $derived(new Map(allSongs.map(s => [s.id, s])));

  type DisplayItem =
    | { kind: 'song'; entry: SetlistEntry; song: Song }
    | { kind: 'break'; entry: SetlistEntry };

  let sortedEntries = $derived((): DisplayItem[] => {
    const sorted = [...localEntries].sort((a, b) => a.order - b.order);

    if (sortKey !== 'default') {
      // When sorting by name, only show songs (no breaks)
      return sorted
        .filter(e => e.songId)
        .map(e => ({ kind: 'song' as const, entry: e, song: songMap.get(e.songId!) }))
        .filter((x): x is { kind: 'song'; entry: typeof x.entry; song: Song } => x.song !== undefined)
        .filter(({ song, entry }) => {
          if (categoryFilter.size > 0 && !categoryFilter.has(song.category)) return false;
          if (onlyWithComment && !entry.comment) return false;
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
      if (onlyWithComment && !e.comment) return [];
      return [{ kind: 'song' as const, entry: e, song }];
    });
  });

  async function handleToggle(songId: string) {
    // Optimistic update so the tap feels instant, then confirm from server
    localEntries = localEntries.map(e => e.songId === songId ? { ...e, played: !e.played } : e);
    const updated = await togglePlayed(setlist.id, songId);
    applyPoll(updated.entries);
  }

  let playedCount = $derived(localEntries.filter(e => e.songId && e.played).length);
  let totalCount = $derived(localEntries.filter(e => e.songId).length);
  let totalMinutes = $derived(totalCount * 5 + localEntries.reduce((s, e) => s + (e.breakMinutes ?? 0), 0));
  let visibleCount = $derived(sortedEntries().length);

  // Per-entry start times keyed by entry order, only when startTime is set
  let entryTimes = $derived((): Map<number, string> => {
    if (!setlist.startTime) return new Map();
    const map = new Map<number, string>();
    let offset = 0;
    for (const e of [...localEntries].sort((a, b) => a.order - b.order)) {
      map.set(e.order, addMinutes(setlist.startTime!, offset));
      offset += e.breakMinutes ?? 5;
    }
    return map;
  });
</script>

<div class="stage">
  <div class="stage-header">
    <div class="stage-title">
      <a href="/setlists/{setlist.id}" class="back-link">←</a>
      <span class="name">{setlist.name}</span>
      <span class="progress">
        {playedCount}/{totalCount} ({formatDuration(totalMinutes)})
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
        <StageSong song={item.song} entry={item.entry} position={i + 1}
          startTime={entryTimes().get(item.entry.order)}
          {musicians}
          ontoggle={() => handleToggle(item.entry.songId!)} />
      {:else}
        <div class="stage-break">
          ⏸ {item.entry.breakMinutes} мин
          {#if setlist.startTime}<span class="break-time">{entryTimes().get(item.entry.order)}</span>{/if}
        </div>
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
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 6px 12px; font-size: 0.82rem;
    color: var(--text-muted); border: 1px dashed var(--border); border-radius: 8px;
    letter-spacing: 0.03em;
  }
  .break-time { margin-left: auto; font-weight: 600; color: var(--accent); white-space: nowrap; }
</style>
