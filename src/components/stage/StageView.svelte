<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { Setlist, Song, Category, SetlistEntry, BandMusician } from '$lib/types';
  import StageSong from './StageSong.svelte';
  import LyricsOverlay from './LyricsOverlay.svelte';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import SortBar, { type SortKey } from '$components/shared/SortBar.svelte';
  import { getSetlist, togglePlayed } from '$lib/api';
  import { t } from '$lib/i18n';
  import { startPolling } from '$lib/poller';
  import { formatDuration, addMinutes, isEventLongOver, isEventFarFuture } from '$lib/utils';
  import { base } from '$app/paths';

  let {
    setlist,
    musicians = [],
    canMark = true,
    pollInterval = 2000,
  }: {
    setlist: Setlist;
    musicians: BandMusician[];
    canMark?: boolean;
    pollInterval?: number;
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
    isEventFarFuture(setlist.date, setlist.startTime) ? pollInterval * 10 : pollInterval,
    () => isEventLongOver(setlist.date, setlist.startTime),
  ));

  let categoryFilter = $state(new Set<Category>());
  let sortKey = $state<SortKey>('default');
  let onlyWithComment = $state(false);
  let selectedMusician = $state(browser ? (localStorage.getItem('kittens_stage_musician') ?? '') : '');

  let permanentNames = $derived(new Set(musicians.map(m => m.name)));
  let selectedMusicianSet = $derived(selectedMusician ? new Set([selectedMusician]) : new Set<string>());
  let guestNames = $derived((): string[] => {
    const guests = new Set<string>();
    for (const entry of localEntries) {
      if (!entry.song) continue;
      for (const [name, role] of Object.entries(entry.song.musicians)) {
        if (!permanentNames.has(name) && role.instruments.length > 0) guests.add(name);
      }
    }
    return [...guests].sort();
  });
  $effect(() => { if (browser) localStorage.setItem('kittens_stage_musician', selectedMusician); });

  // Original position numbers (unfiltered, by setlist order)
  let songPositions = $derived((): Map<number, number> => {
    const map = new Map<number, number>();
    let pos = 1;
    for (const e of [...localEntries].sort((a, b) => a.order - b.order)) {
      if (e.songId) map.set(e.order, pos++);
    }
    return map;
  });

  type DisplayItem =
    | { kind: 'song'; entry: SetlistEntry; song: Song }
    | { kind: 'break'; entry: SetlistEntry };

  let sortedEntries = $derived((): DisplayItem[] => {
    const sorted = [...localEntries].sort((a, b) => a.order - b.order);

    if (sortKey !== 'default') {
      // When sorting by name, only show songs (no breaks)
      return sorted
        .filter(e => e.songId && e.song)
        .map(e => ({ kind: 'song' as const, entry: e, song: e.song! }))
        .filter(({ song, entry }) => {
          if (categoryFilter.size > 0 && !categoryFilter.has(song.category)) return false;
          if (onlyWithComment && !entry.comment) return false;
          return true;
        })
        .sort((a, b) => sortKey === 'artist'
          ? a.song.artist.localeCompare(b.song.artist)
          : a.song.title.localeCompare(b.song.title));
    }

    return sorted.flatMap((e): DisplayItem[] => {
      if (e.breakMinutes) return [{ kind: 'break', entry: e }];
      if (!e.song) return [];
      if (categoryFilter.size > 0 && !categoryFilter.has(e.song.category)) return [];
      if (onlyWithComment && !e.comment) return [];
      return [{ kind: 'song', entry: e, song: e.song }];
    });
  });

  async function handleToggle(songId: string) {
    if (!canMark) return;
    // Optimistic update so the tap feels instant, then confirm from server
    localEntries = localEntries.map(e => e.songId === songId ? { ...e, played: !e.played } : e);
    const updated = await togglePlayed(setlist.id, songId);
    applyPoll(updated.entries);
  }

  let playedCount = $derived(localEntries.filter(e => e.songId && e.played).length);
  let totalCount = $derived(localEntries.filter(e => e.songId).length);
  let totalMinutes = $derived(localEntries.reduce((s, e) => s + (e.breakMinutes ?? (e.song?.lengthMinutes ?? 5)), 0));
  let visibleCount = $derived(sortedEntries().length);

  let filterOpen = $state(false);
  let isFiltered = $derived(categoryFilter.size > 0 || selectedMusician !== '');

  let lyricsForSong = $state<Song | null>(null);

  // Per-entry start times keyed by entry order, only when startTime is set
  let entryTimes = $derived((): Map<number, string> => {
    if (!setlist.startTime) return new Map();
    const map = new Map<number, string>();
    let offset = 0;
    for (const e of [...localEntries].sort((a, b) => a.order - b.order)) {
      map.set(e.order, addMinutes(setlist.startTime!, offset));
      offset += e.breakMinutes ?? (e.song?.lengthMinutes ?? 5);
    }
    return map;
  });
</script>

<div class="stage">
  <div class="stage-header">
    <div class="stage-title">
      <a href="{base}/setlists/{setlist.id}" class="back-link">←</a>
      <span class="name">{setlist.name}</span>
      <span class="progress">
        {playedCount}/{totalCount} ({formatDuration(totalMinutes)})
        {#if visibleCount !== totalCount}<span class="filtered-count">{$t.stage.shown(visibleCount)}</span>{/if}
      </span>
    </div>
    {#if !canMark}
      <a href="{base}/login" class="login-hint">{$t.login.stageHint}</a>
    {/if}
    <div class="header-filters">
      <FilterChips selected={categoryFilter} onchange={v => { categoryFilter = v; }} />
      {#if musicians.length > 0 || guestNames().length > 0}
        <div class="musician-picker">
          {#each musicians as m}
            <button
              class="musician-chip"
              class:active={selectedMusician === m.name}
              onclick={() => { selectedMusician = selectedMusician === m.name ? '' : m.name; }}
            >{m.name}</button>
          {/each}
          {#each guestNames() as name}
            <button
              class="musician-chip guest-chip"
              class:active={selectedMusician === name}
              onclick={() => { selectedMusician = selectedMusician === name ? '' : name; }}
            >{name}</button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="song-list">
    {#each sortedEntries() as item, i (item.entry.songId ?? `break-${item.entry.order}`)}
      {#if item.kind === 'song'}
        <StageSong song={item.song} entry={item.entry} position={songPositions().get(item.entry.order) ?? 0}
          startTime={entryTimes().get(item.entry.order)}
          {musicians}
          {selectedMusician}
          {canMark}
          ontoggle={() => handleToggle(item.entry.songId!)}
          onlyricsclick={() => { lyricsForSong = item.song; }} />
      {:else}
        <div class="stage-break">
          <span class="break-main">⏸ {item.entry.breakMinutes} мин{#if item.entry.comment} — <span class="break-note">{item.entry.comment}</span>{/if}</span>
          {#if setlist.startTime}<span class="break-time">{entryTimes().get(item.entry.order)}</span>{/if}
        </div>
      {/if}
    {/each}
    {#if sortedEntries().length === 0}
      <p class="empty">{$t.stage.noSongs}</p>
    {/if}
  </div>

  <!-- Mobile filter panel (slides up above bottom bar) -->
  <div class="mobile-filter-panel" class:open={filterOpen}>
    <div class="filter-group">
      <FilterChips selected={categoryFilter} onchange={v => { categoryFilter = v; }} />
    </div>
    {#if musicians.length > 0 || guestNames().length > 0}
      <div class="filter-sep-h"></div>
      <div class="filter-group">
        {#each musicians as m}
          <button
            class="musician-chip"
            class:active={selectedMusician === m.name}
            onclick={() => { selectedMusician = selectedMusician === m.name ? '' : m.name; }}
          >{m.name}</button>
        {/each}
        {#each guestNames() as name}
          <button
            class="musician-chip guest-chip"
            class:active={selectedMusician === name}
            onclick={() => { selectedMusician = selectedMusician === name ? '' : name; }}
          >{name}</button>
        {/each}
      </div>
    {/if}
  </div>

  {#if lyricsForSong}
    <LyricsOverlay song={lyricsForSong} onclose={() => { lyricsForSong = null; }} />
  {/if}

  <!-- Mobile bottom bar -->
  <div class="mobile-bottom-bar">
    <button
      class="bottom-btn"
      class:active={filterOpen || isFiltered}
      onclick={() => { filterOpen = !filterOpen; }}
    >🎛️ Фильтр</button>
  </div>
</div>

<style>
  .stage { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); max-width: 100%; overflow-x: hidden; }

  .stage-header {
    position: sticky; top: 56px; z-index: 10;
    background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 10px 8px; display: flex; flex-direction: column; gap: 8px;
  }
  .stage-title { display: flex; align-items: center; gap: 10px; }
  .back-link { text-decoration: none; color: var(--accent); font-size: 2.4rem; line-height: 1; }
  .name { font-size: 1.05rem; font-weight: 700; flex: 1; }

  .progress {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.88rem; color: var(--text-muted);
    background: var(--chip-bg); padding: 2px 8px; border-radius: 10px; white-space: nowrap;
  }
  .filtered-count { font-size: 0.78rem; opacity: 0.75; }

  .stage-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .comment-toggle { display: flex; align-items: center; gap: 4px; font-size: 0.78rem; cursor: pointer; color: var(--text-muted); }

  .musician-picker { display: flex; flex-wrap: wrap; gap: 6px; }
  .musician-chip {
    padding: 3px 12px; border: 1px solid var(--border); border-radius: 20px;
    background: transparent; cursor: pointer; font-size: 0.82rem; font-weight: 500;
    color: var(--text-muted); transition: all 0.15s;
  }
  .musician-chip:hover { border-color: var(--accent); color: var(--accent); }
  .musician-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .guest-chip { border-style: dashed; }

  .song-list { padding: 10px 0; display: flex; flex-direction: column; gap: 8px; }
  .empty { text-align: center; color: var(--text-muted); padding: 40px; }

  .mobile-filter-panel { display: none; }
  .mobile-bottom-bar { display: none; }
  .stage-break {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 12px; font-size: 0.82rem;
    color: var(--text-muted); border: 1px dashed var(--border); border-radius: 8px;
    background: rgba(59, 130, 246, 0.09); letter-spacing: 0.03em;
  }
  .break-main { flex: 1; }
  .break-note { font-style: italic; opacity: 0.85; }
  .break-time { margin-left: auto; font-weight: 600; color: var(--accent); white-space: nowrap; flex-shrink: 0; }

  @media (min-width: 701px) {
    .stage-break { font-size: 1rem; padding: 8px 12px; }
    .break-time { font-size: 0.9rem; font-weight: 700; }
  }

  .login-hint {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-decoration: none;
    text-align: center;
  }
  .login-hint:hover { color: var(--accent); }

  @media (max-width: 700px) {
    .header-filters { display: none; }
    .song-list { padding-bottom: 74px; gap: 0; }
    .stage-break { border-radius: 0; border-left: none; border-right: none; }
    .musician-chip:hover { border-color: var(--border); color: var(--text-muted); }

    .mobile-filter-panel {
      position: fixed; bottom: 64px; left: 0; right: 0; z-index: 20;
      background: var(--surface); border-top: 1px solid var(--border);
      padding: 12px; display: none; flex-direction: column; gap: 10px;
    }
    .mobile-filter-panel.open { display: flex; }
    .filter-group { display: flex; gap: 5px; flex-wrap: wrap; }
    .filter-sep-h { height: 1px; background: var(--border); }

    .mobile-bottom-bar {
      position: fixed; bottom: 0; left: 0; right: 0; height: 64px; z-index: 21;
      background: var(--surface); border-top: 1px solid var(--border);
      display: flex; align-items: center; gap: 8px; padding: 0 12px;
    }
    .bottom-btn {
      padding: 10px 16px; border: 1px solid var(--border); border-radius: 20px;
      background: transparent; cursor: pointer; font-size: 0.9rem; font-weight: 500;
      color: var(--text-muted); white-space: nowrap;
    }
    .bottom-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }

    .musician-chip { padding: 7px 14px; font-size: 0.88rem; }
  }
</style>
