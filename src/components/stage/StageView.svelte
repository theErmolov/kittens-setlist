<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { Setlist, Song, Category, SetlistEntry, BandMusician } from '$lib/types';
  import StageSong from './StageSong.svelte';
  import LyricsOverlay from './LyricsOverlay.svelte';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import SortBar, { type SortKey } from '$components/shared/SortBar.svelte';
  import { getSetlist, togglePlayed, toggleBreakPlayed, markThrough } from '$lib/api';
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

  let localEntries = $state<SetlistEntry[]>([]);
  $effect(() => { localEntries = [...setlist.entries]; });

  function applyPoll(incoming: SetlistEntry[]) {
    const sorted = [...incoming].sort((a, b) => a.order - b.order);
    const localSorted = [...localEntries].sort((a, b) => a.order - b.order);
    if (JSON.stringify(sorted) === JSON.stringify(localSorted)) return;
    localEntries = incoming;
  }

  let now = $state(new Date());

  onMount(() => {
    const stopPoller = startPolling(
      async () => { const s = await getSetlist(setlist.id); if (s) applyPoll(s.entries); },
      isEventFarFuture(setlist.date, setlist.startTime) ? pollInterval * 10 : pollInterval,
      () => isEventLongOver(setlist.date, setlist.startTime),
    );
    const clockTimer = setInterval(() => { now = new Date(); }, 1000);
    return () => { stopPoller(); clearInterval(clockTimer); };
  });

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
    const entry = localEntries.find(e => e.songId === songId);
    if (!entry) return;
    if (setlist.vibe && !entry.played) {
      localEntries = localEntries.map(e => e.order <= entry.order && !e.played ? { ...e, played: true } : e);
      const updated = await markThrough(setlist.id, entry.order);
      applyPoll(updated.entries);
    } else {
      localEntries = localEntries.map(e => e.songId === songId ? { ...e, played: !e.played } : e);
      const updated = await togglePlayed(setlist.id, songId);
      applyPoll(updated.entries);
    }
  }

  async function handleBreakToggle(order: number) {
    if (!canMark) return;
    const entry = localEntries.find(e => e.order === order && e.breakMinutes !== undefined);
    if (!entry) return;
    if (setlist.vibe && !entry.played) {
      localEntries = localEntries.map(e => e.order <= order && !e.played ? { ...e, played: true } : e);
      const updated = await markThrough(setlist.id, order);
      applyPoll(updated.entries);
    } else {
      localEntries = localEntries.map(e => e.order === order && e.breakMinutes !== undefined ? { ...e, played: !e.played } : e);
      const updated = await toggleBreakPlayed(setlist.id, order);
      applyPoll(updated.entries);
    }
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
    const sorted = [...localEntries].sort((a, b) => a.order - b.order);
    const map = new Map<number, string>();

    if (setlist.vibe) {
      const playedWithTs = sorted.filter(e => e.played && e.playedAt);
      const lastPlayed = playedWithTs.at(-1);
      if (lastPlayed?.playedAt) {
        let offset = 0;
        for (const e of sorted) {
          map.set(e.order, addMinutes(setlist.startTime!, offset));
          offset += e.breakMinutes ?? (e.song?.lengthMinutes ?? 5);
          if (e.order === lastPlayed.order) break;
        }
        const d = new Date(lastPlayed.playedAt);
        let recalcBase = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        for (const e of sorted.filter(e => e.order > lastPlayed.order)) {
          map.set(e.order, recalcBase);
          recalcBase = addMinutes(recalcBase, e.breakMinutes ?? (e.song?.lengthMinutes ?? 5));
        }
        return map;
      }
    }

    let offset = 0;
    for (const e of sorted) {
      map.set(e.order, addMinutes(setlist.startTime!, offset));
      offset += e.breakMinutes ?? (e.song?.lengthMinutes ?? 5);
    }
    return map;
  });

  let timingInfo = $derived((): { currentTime: string; finishTime: string; pace?: number } | null => {
    if (!setlist.startTime) return null;
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    const sorted = [...localEntries].sort((a, b) => a.order - b.order);
    const playedWithTs = sorted.filter(e => e.played && e.playedAt);
    const lastPlayed = playedWithTs.at(-1);

    let baseTime = currentTime;
    if (lastPlayed?.playedAt) {
      const d = new Date(lastPlayed.playedAt);
      baseTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    const remainingMinutes = sorted
      .filter(e => !e.played)
      .reduce((s, e) => s + (e.breakMinutes ?? (e.song?.lengthMinutes ?? 5)), 0);
    const finishTime = addMinutes(baseTime, remainingMinutes);

    let pace: number | undefined;
    if (setlist.vibe && lastPlayed?.playedAt) {
      const scheduledStart = entryTimes().get(lastPlayed.order) ?? setlist.startTime;
      const entryDuration = lastPlayed.breakMinutes ?? (lastPlayed.song?.lengthMinutes ?? 5);
      const scheduledEnd = addMinutes(scheduledStart, entryDuration);
      const d = new Date(lastPlayed.playedAt);
      const actualEnd = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const [sh, sm] = scheduledEnd.split(':').map(Number);
      const [ah, am] = actualEnd.split(':').map(Number);
      pace = (ah * 60 + am) - (sh * 60 + sm);
    }

    return { currentTime, finishTime, pace };
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
      <button
        class="header-filter-btn"
        class:active={filterOpen || isFiltered}
        onclick={() => { filterOpen = !filterOpen; }}
        title="Фильтры"
      >🎛️ <span class="filter-btn-label">Фильтр</span></button>
    </div>
    {#if timingInfo()}
      {@const info = timingInfo()}
      <div class="timing-bar">
        <span class="timing-clock">{info!.currentTime}</span>
        <span class="timing-finish">{$t.stage.finish}: {info!.finishTime}</span>
        {#if info!.pace !== undefined}
          <span class="timing-pace"
            class:on-time={Math.abs(info!.pace) <= 2}
            class:behind={info!.pace > 2}
            class:ahead={info!.pace < -2}
          >
            {#if Math.abs(info!.pace) <= 2}
              {$t.stage.onTime} ✓
            {:else if info!.pace > 0}
              {$t.stage.behind(info!.pace)}
            {:else}
              {$t.stage.ahead(-info!.pace)}
            {/if}
          </span>
        {/if}
      </div>
    {/if}
    {#if !canMark}
      <a href="{base}/login" class="login-hint">{$t.login.stageHint}</a>
    {/if}
    {#if filterOpen}
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
    {/if}
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
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="stage-break" class:played={item.entry.played} class:can-mark={canMark} onclick={() => handleBreakToggle(item.entry.order)}>
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
  .stage { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); max-width: 100%; overflow-x: clip; }

  .stage-header {
    position: sticky; top: 56px; z-index: 10;
    background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 8px 12px; display: flex; flex-direction: column; gap: 6px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
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

  .timing-bar { display: none; }
  .timing-clock { font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
  .timing-finish { font-variant-numeric: tabular-nums; color: var(--text-muted); }
  .timing-pace {
    padding: 2px 8px; border-radius: 10px; font-weight: 600; font-size: 0.78rem;
    background: var(--chip-bg); color: var(--text-muted);
  }
  .timing-pace.on-time { color: #16a34a; background: #dcfce7; }
  .timing-pace.behind { color: #b45309; background: #fef3c7; }
  .timing-pace.ahead { color: #2563eb; background: #dbeafe; }

  .header-filter-btn { display: none; }
  .header-filters { display: flex; flex-direction: column; gap: 6px; }
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
    padding: 12px 14px; min-height: 48px; font-size: 0.82rem;
    color: var(--text-muted); border: 1px dashed var(--border); border-radius: 8px;
    background: rgba(59, 130, 246, 0.09); letter-spacing: 0.03em;
    transition: opacity 0.15s;
    touch-action: manipulation; user-select: none;
  }
  .stage-break.can-mark { cursor: pointer; }
  .stage-break.can-mark:hover { background: rgba(59, 130, 246, 0.16); }
  .stage-break.played { opacity: 0.45; }
  .stage-break.played .break-main { text-decoration: line-through; }
  .break-main { flex: 1; }
  .break-note { font-style: italic; opacity: 0.85; }
  .break-time { margin-left: auto; font-weight: 600; color: var(--accent); white-space: nowrap; flex-shrink: 0; }

  @media (min-width: 701px) {
    .stage-break { font-size: 1rem; padding: 8px 12px; }
    .break-time { font-size: 0.9rem; font-weight: 700; }

    .timing-bar {
      display: flex; align-items: center; gap: 12px;
      font-size: 0.82rem; padding: 2px 0;
    }

    .header-filter-btn {
      display: flex; align-items: center; gap: 6px;
      height: 36px; flex-shrink: 0; padding: 0 12px;
      border: 1px solid var(--border); border-radius: 8px;
      background: transparent; cursor: pointer; font-size: 1.1rem;
      color: var(--text-muted); transition: all 0.15s;
    }
    .filter-btn-label { font-size: 0.88rem; font-weight: 600; }
    .header-filter-btn:hover { border-color: var(--accent); color: var(--accent); }
    .header-filter-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
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
