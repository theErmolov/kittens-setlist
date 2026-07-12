<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Setlist, Song, Instrument, SetlistEntry, SetlistSubset, BandMusician, LearningStage } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import AddSongsModal from './AddSongsModal.svelte';
  import SongEditModal from '$components/backlog/SongEditModal.svelte';
  import { getSetlist, updateSetlist, updateSong, getSong, addSongsToSetlist, removeSongFromSetlist, reorderEntries, addBreakToSetlist, removeBreakFromSetlist, updateBreak, updateEntryComment, updateEntrySong } from '$lib/api';
  import { t } from '$lib/i18n';
  import { startPolling } from '$lib/poller';
  import { currentUser } from '$lib/auth';
  import { formatDuration, formatDate, addMinutes, sortInstruments, songReadiness, progressPct, pctBubbleStyle, STAGE_PCT, isEventLongOver } from '$lib/utils';
  import { sortSubset } from '$lib/subsetSort';
  import CommentInput from './CommentInput.svelte';
  import LyricsOverlay from '$components/stage/LyricsOverlay.svelte';
  import { base } from '$app/paths';

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };

  const PROG_BG: Partial<Record<LearningStage, string>> = {
    queue:     'rgba(128,128,128,0.2)',
    structure: 'rgba(255,0,0,0.2)',
    mastering: 'rgba(255,220,0,0.2)',
    ready:     'rgba(0,200,0,0.2)',
  };

  const PROG_COLOR: Partial<Record<LearningStage, string>> = {
    queue:     '#424242',
    structure: '#8A000A',
    mastering: '#856100',
    ready:     '#005909',
  };


  let {
    setlist,
    allSongs,
    musicians
  }: {
    setlist: Setlist;
    allSongs: Song[];
    musicians: BandMusician[];
  } = $props();

  let allMusicians = $derived(musicians.map(m => m.name));
  let permanentNamesSet = $derived(new Set(allMusicians));

  let guestNames = $derived.by(() => {
    const seen = new Set<string>();
    for (const entry of sortedEntries) {
      if (!entry.song) continue;
      for (const [name, role] of Object.entries(entry.song.musicians)) {
        if (!permanentNamesSet.has(name) && role.instruments.length > 0) seen.add(name);
      }
    }
    return [...seen].sort();
  });

  // Editable meta (name / date / startTime / vibe)
  let editingMeta = $state(false);
  let draftMeta = $state({ name: '', date: '', startTime: '', vibe: false });
  let localMeta = $state({ name: '', date: '', startTime: '', vibe: false });
  $effect(() => {
    // Track setlist prop only — untrack editingMeta so toggling edit mode doesn't re-run this
    // and overwrite localMeta with stale prop data right after a save.
    void setlist;
    if (!untrack(() => editingMeta)) {
      localMeta = { name: setlist.name, date: setlist.date ?? '', startTime: setlist.startTime ?? '', vibe: setlist.vibe ?? false };
    }
  });

  async function saveMeta() {
    const updated = await updateSetlist({ ...setlist, ...draftMeta, entries: localEntries, subsets: localSubsets });
    localMeta = { name: updated.name, date: updated.date ?? '', startTime: updated.startTime ?? '', vibe: updated.vibe ?? false };
    editingMeta = false;
  }

  function startEditMeta() {
    draftMeta = { ...localMeta };
    editingMeta = true;
  }

  let localEntries = $state<SetlistEntry[]>([]);
  let localSubsets = $state<SetlistSubset[]>([]);
  $effect(() => { localEntries = [...setlist.entries]; });
  $effect(() => { localSubsets = [...(setlist.subsets ?? [])]; });

  let showAddModal = $state(false);
  let showBreakPicker = $state(false);
  let editingBreakOrder = $state<number | null>(null);
  let dragIndex = $state<number | null>(null);
  let overIndex = $state<number | null>(null);
  let editingEntry = $state<SetlistEntry | null>(null);
  let lyricsViewSong = $state<Song | null>(null);
  let selectedMusician = $state<string | null>(null);
  let filterNotReady = $state(false);
  let filterText = $state('');
  let filterOpen = $state(false);
  let activeSubsetId = $state<string | null>(null);

  function toggleMusician(name: string) {
    selectedMusician = selectedMusician === name ? null : name;
  }

  // Full replace after own mutations — always authoritative
  function applyUpdate(updated: Setlist) {
    localEntries = [...updated.entries];
    localSubsets = [...(updated.subsets ?? [])];
  }

  // Smart merge for poll updates — preserve drag state
  function applyPoll(incoming: Setlist) {
    const sorted = [...incoming.entries].sort((a, b) => a.order - b.order);
    const localSorted = [...localEntries].sort((a, b) => a.order - b.order);
    const subsetsIncoming = incoming.subsets ?? [];
    const entriesChanged = JSON.stringify(sorted) !== JSON.stringify(localSorted);
    const subsetsChanged = JSON.stringify(subsetsIncoming) !== JSON.stringify(localSubsets);

    if (!entriesChanged && !subsetsChanged) return;

    if (dragIndex !== null) {
      if (entriesChanged) {
        localEntries = localEntries.map(e => {
          const fresh = incoming.entries.find(i => i.order === e.order);
          return fresh ?? e;
        });
      }
      if (subsetsChanged) localSubsets = subsetsIncoming;
    } else {
      localEntries = incoming.entries;
      localSubsets = subsetsIncoming;
    }

    if (activeSubsetId && !localSubsets.some(s => s.id === activeSubsetId)) activeSubsetId = null;
  }

  // Rebuilds the entries array so subset blocks sit contiguously at the top,
  // in `subsets` order, followed by the unassigned pool — then renumbers 0..N.
  // `overrides` lets a caller supply the exact intra-block order for a subset
  // being actively edited, instead of deriving it from existing `order` values.
  function rebuildEntries(
    entries: SetlistEntry[],
    subsets: SetlistSubset[],
    overrides?: Map<string, SetlistEntry[]>
  ): SetlistEntry[] {
    const sorted = [...entries].sort((a, b) => a.order - b.order);
    const bySubset = new Map<string, SetlistEntry[]>();
    const pool: SetlistEntry[] = [];
    for (const e of sorted) {
      if (e.subsetId) {
        if (!bySubset.has(e.subsetId)) bySubset.set(e.subsetId, []);
        bySubset.get(e.subsetId)!.push(e);
      } else {
        pool.push(e);
      }
    }
    const out: SetlistEntry[] = [];
    for (const subset of subsets) {
      out.push(...(overrides?.get(subset.id) ?? bySubset.get(subset.id) ?? []));
    }
    out.push(...pool);
    return out.map((e, i) => ({ ...e, order: i }));
  }

  async function persistSubsets(entries: SetlistEntry[], subsets: SetlistSubset[]) {
    localEntries = entries;
    localSubsets = subsets;
    applyUpdate(await reorderEntries(setlist.id, entries, subsets));
  }

  // Up to 2 songs (oldest→most recent) this subset should chain after: the tail
  // of the previous subset, or — for the first subset — the most recently played songs.
  function computeAnchors(subsetId: string): Song[] {
    const idx = localSubsets.findIndex(s => s.id === subsetId);
    if (idx > 0) {
      const prevMembers = sortedEntries.filter(e => e.subsetId === localSubsets[idx - 1].id);
      return prevMembers.slice(-2).map(e => e.song).filter((s): s is Song => !!s);
    }
    const played = sortedEntries
      .filter(e => e.played && e.song)
      .sort((a, b) => {
        const at = a.playedAt ? Date.parse(a.playedAt) : -Infinity;
        const bt = b.playedAt ? Date.parse(b.playedAt) : -Infinity;
        return at !== bt ? at - bt : a.order - b.order;
      });
    return played.slice(-2).map(e => e.song).filter((s): s is Song => !!s);
  }

  function entriesInSubset(subsetId: string): number {
    return localEntries.filter(e => e.subsetId === subsetId && e.songId).length;
  }

  async function handleNewSubset() {
    const subset: SetlistSubset = { id: crypto.randomUUID(), name: $t.editor.subsetDefaultName(localSubsets.length + 1) };
    const newSubsets = [...localSubsets, subset];
    activeSubsetId = subset.id;
    await persistSubsets(rebuildEntries(localEntries, newSubsets), newSubsets);
  }

  function toggleSubsetMode(subsetId: string) {
    activeSubsetId = activeSubsetId === subsetId ? null : subsetId;
  }

  async function dissolveSubset(subsetId: string) {
    const newSubsets = localSubsets.filter(s => s.id !== subsetId);
    const newEntries = localEntries.map(e => e.subsetId === subsetId ? { ...e, subsetId: undefined } : e);
    if (activeSubsetId === subsetId) activeSubsetId = null;
    await persistSubsets(rebuildEntries(newEntries, newSubsets), newSubsets);
  }

  async function toggleSubsetMembership(entry: SetlistEntry) {
    if (activeSubsetId === null || !entry.songId) return;
    if (entry.subsetId && entry.subsetId !== activeSubsetId) return; // belongs to another subset
    const subsetId = activeSubsetId;
    const subset = localSubsets.find(s => s.id === subsetId);
    if (!subset) return;

    if (entry.subsetId === subsetId) {
      const newEntries = localEntries.map(e => e.songId === entry.songId ? { ...e, subsetId: undefined } : e);
      await persistSubsets(rebuildEntries(newEntries, localSubsets), localSubsets);
      return;
    }

    const taggedEntries = localEntries.map(e => e.songId === entry.songId ? { ...e, subsetId } : e);
    const members = taggedEntries.filter(e => e.subsetId === subsetId).sort((a, b) => a.order - b.order);
    let overrideList = members;
    if (!subset.manualSort) {
      const anchors = computeAnchors(subsetId);
      const sortedSongs = sortSubset(members.map(e => e.song!), anchors);
      const bySongId = new Map(members.map(e => [e.songId!, e]));
      overrideList = sortedSongs.map(s => bySongId.get(s.id)!);
    }
    await persistSubsets(rebuildEntries(taggedEntries, localSubsets, new Map([[subsetId, overrideList]])), localSubsets);
  }

  function handleRowClick(e: MouseEvent, entry: SetlistEntry) {
    if (activeSubsetId === null || !entry.songId) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, button, a')) return;
    toggleSubsetMembership(entry);
  }

  type RenderItem =
    | { kind: 'header'; subset: SetlistSubset }
    | { kind: 'hint'; subset: SetlistSubset }
    | { kind: 'divider' }
    | { kind: 'entry'; entry: SetlistEntry; index: number };

  let renderItems = $derived((): RenderItem[] => {
    const display = displayEntries();
    if (isFiltered) {
      return display.map((entry, index) => ({ kind: 'entry' as const, entry, index }));
    }
    const bySubset = new Map<string, { entry: SetlistEntry; index: number }[]>();
    const pool: { entry: SetlistEntry; index: number }[] = [];
    display.forEach((entry, index) => {
      if (entry.subsetId) {
        if (!bySubset.has(entry.subsetId)) bySubset.set(entry.subsetId, []);
        bySubset.get(entry.subsetId)!.push({ entry, index });
      } else {
        pool.push({ entry, index });
      }
    });
    const items: RenderItem[] = [];
    for (const subset of localSubsets) {
      items.push({ kind: 'header', subset });
      if (activeSubsetId === subset.id) items.push({ kind: 'hint', subset });
      for (const { entry, index } of bySubset.get(subset.id) ?? []) {
        items.push({ kind: 'entry', entry, index });
      }
    }
    if (localSubsets.length > 0 && pool.length > 0) items.push({ kind: 'divider' });
    for (const { entry, index } of pool) items.push({ kind: 'entry', entry, index });
    return items;
  });

  function renderItemKey(item: RenderItem): string {
    if (item.kind === 'entry') return entryKey(item.entry);
    if (item.kind === 'divider') return 'divider';
    return `${item.kind}-${item.subset.id}`;
  }

  onMount(() => {
    const u = $currentUser;
    const pollMs = (u?.isAdmin || u?.role === 'writer') ? 3000 : 15000;
    const stopPoller = startPolling(
      async () => { const s = await getSetlist(setlist.id); if (s) applyPoll(s); },
      pollMs,
      () => isEventLongOver(localMeta.date, localMeta.startTime),
    );

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY === null || touchStartX === null) return;
      const touch = e.touches[0];
      const dy = Math.abs(touch.clientY - touchStartY);
      const dx = Math.abs(touch.clientX - touchStartX);

      if (dragIndex === null) {
        if (touchStartIndex !== null && dy > DRAG_THRESHOLD && dy > dx) {
          dragIndex = touchStartIndex;
        } else {
          return;
        }
      }
      e.preventDefault();
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const row = el?.closest('[data-row-i]') as HTMLElement | null;
      if (row) {
        const idx = parseInt(row.dataset.rowI ?? '');
        if (!isNaN(idx)) overIndex = idx;
      }
    };

    const handleTouchEnd = () => {
      if (dragIndex !== null) onDrop();
      touchStartIndex = null;
      touchStartY = null;
      touchStartX = null;
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      stopPoller();
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  });

  // songMap kept for AddSongsModal deduplication (existingIds)
  let songMap = $derived(new Map(allSongs.map(s => [s.id, s])));
  let sortedEntries = $derived([...localEntries].sort((a, b) => a.order - b.order));
  let existingIds = $derived(new Set(localEntries.map(e => e.songId).filter((id): id is string => !!id)));

  let filteredEntries = $derived(() => {
    let entries: SetlistEntry[] = sortedEntries;

    if (selectedMusician) {
      const m = selectedMusician;
      entries = entries
        .filter(e => {
          if (!e.song) return false; // hide breaks when musician filter active
          const role = e.song.musicians[m];
          return role && role.instruments.length > 0;
        })
        .sort((a, b) => {
          const stageOf = (e: SetlistEntry) => STAGE_PCT[entryStage(e, m)];
          return stageOf(a) - stageOf(b);
        });
    }

    if (filterNotReady) {
      entries = entries
        .filter(e => {
          if (!e.song) return false; // hide breaks when readiness filter active
          return entryProgressPct(e) < 100;
        })
        .sort((a, b) => entryProgressPct(a) - entryProgressPct(b));
    }

    const q = filterText.trim().toLowerCase();
    if (q) {
      entries = entries.filter(e => {
        if (!e.song) return false;
        return e.song.artist.toLowerCase().includes(q)
          || e.song.title.toLowerCase().includes(q)
          || (e.comment ?? '').toLowerCase().includes(q);
      });
    }

    return entries;
  });

  let isFiltered = $derived(selectedMusician !== null || filterNotReady || filterText.trim() !== '');

  let displayEntries = $derived(() => {
    const base = filteredEntries();
    if (!isFiltered && dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const list = [...base];
      const [item] = list.splice(dragIndex, 1);
      list.splice(overIndex, 0, item);
      return list;
    }
    return base;
  });

  let songCount = $derived(sortedEntries.filter(e => e.songId).length);
  let totalMinutes = $derived(sortedEntries.reduce((s, e) => s + (e.breakMinutes ?? (e.song?.lengthMinutes ?? 5)), 0));

  let readyCount = $derived(
    sortedEntries.filter(e =>
      e.song && songReadiness(e.song.musicians, e.progress ?? {}, new Set()) === 'ready'
    ).length
  );

  let musicianCounts = $derived(() => {
    const counts: Record<string, number> = {};
    for (const name of [...allMusicians, ...guestNames]) {
      counts[name] = sortedEntries.filter(e => {
        if (!e.song) return false;
        const role = e.song.musicians[name];
        return role && role.instruments.length > 0;
      }).length;
    }
    return counts;
  });

  function entryStage(entry: SetlistEntry, name: string): LearningStage {
    return (entry.song?.progress?.[name]
      ?? entry.progress?.[name]
      ?? 'queue') as LearningStage;
  }

  function entryProgressPct(entry: SetlistEntry): number {
    if (!entry.song) return 0;
    const merged = Object.fromEntries(
      Object.keys(entry.song.musicians).map(n => [n, entryStage(entry, n)])
    );
    return progressPct(entry.song.musicians, merged);
  }

  // Per-entry start times, keyed by entryKey. Only computed when startTime is set.
  let entryTimes = $derived((): Map<string, string> => {
    if (!localMeta.startTime) return new Map();
    const map = new Map<string, string>();
    let offset = 0;
    for (const entry of sortedEntries) {
      map.set(entryKey(entry), addMinutes(localMeta.startTime, offset));
      offset += entry.breakMinutes ?? (entry.song?.lengthMinutes ?? 5);
    }
    return map;
  });

  // total columns: drag + num + (time?) + song + musicians + actions
  let totalCols = $derived(allMusicians.length + 4 + (localMeta.startTime ? 1 : 0));

  async function handleAdd(songs: Song[]) {
    const updated = await addSongsToSetlist(setlist.id, songs);
    applyUpdate(updated);
    showAddModal = false;

    // Copy song.comment → entry comment for newly added songs that have one
    const addedIds = new Set(songs.map(s => s.id));
    const toComment = updated.entries
      .filter(e => e.songId && addedIds.has(e.songId) && e.song?.comment)
      .map(e => ({ order: e.order, comment: e.song!.comment! }));

    for (const { order, comment } of toComment) {
      applyUpdate(await updateEntryComment(setlist.id, order, comment));
    }
  }

  async function handleAddBreak(minutes: number) {
    applyUpdate(await addBreakToSetlist(setlist.id, minutes));
    showBreakPicker = false;
  }

  async function handleRemove(songId: string) {
    applyUpdate(await removeSongFromSetlist(setlist.id, songId));
  }

  async function handleRemoveBreak(order: number) {
    applyUpdate(await removeBreakFromSetlist(setlist.id, order));
  }

  async function handleUpdateBreak(order: number, minutes: number) {
    applyUpdate(await updateBreak(setlist.id, order, minutes));
    editingBreakOrder = null;
  }

  async function handleEntrySave(updatedSong: Song) {
    if (!editingEntry) return;
    const entry = editingEntry;
    // Optimistic update — reflect changes immediately before API round-trips
    localEntries = localEntries.map(e =>
      e.order === entry.order ? { ...e, song: updatedSong, comment: updatedSong.comment ?? e.comment ?? '' } : e
    );
    let updated = await updateEntrySong(setlist.id, entry.order, updatedSong);
    updated = await updateEntryComment(setlist.id, entry.order, updatedSong.comment ?? '');
    applyUpdate(updated);
    // Sync progress and lengthMinutes back to the canonical backlog song.
    // Fetch fresh to avoid stale prop data and merge progress so we don't wipe
    // keys that weren't present in the entry snapshot.
    if (entry.songId) {
      try {
        const canonical = await getSong(entry.songId);
        if (canonical) {
          await updateSong({
            ...canonical,
            progress: { ...(canonical.progress ?? {}), ...(updatedSong.progress ?? {}) },
            lengthMinutes: updatedSong.lengthMinutes ?? canonical.lengthMinutes,
            lyrics: updatedSong.lyrics ?? canonical.lyrics,
          }, true);
        }
      } catch (err) {
        console.error('Failed to sync song changes to backlog:', err);
      }
    }
    editingEntry = null;
  }

  function entryKey(entry: typeof sortedEntries[0]) {
    return entry.songId ?? `break-${entry.order}`;
  }

  function onDragStart(i: number) { dragIndex = i; }

  function onDragOver(e: DragEvent, i: number) {
    e.preventDefault();
    overIndex = i;
  }

  async function onDrop() {
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) {
      dragIndex = null; overIndex = null; return;
    }
    const list = [...sortedEntries];
    const [item] = list.splice(dragIndex, 1);
    const insertAt = overIndex;
    const prevItem = list[insertAt - 1];
    const nextItem = list[insertAt];
    const newSubsetId =
      prevItem?.subsetId && (prevItem.subsetId === nextItem?.subsetId || !nextItem) ? prevItem.subsetId
      : (!prevItem?.subsetId && nextItem?.subsetId) ? nextItem.subsetId
      : undefined;
    list.splice(insertAt, 0, { ...item, subsetId: newSubsetId });
    const reordered = list.map((e, i) => ({ ...e, order: i }));
    const finalSubsets = newSubsetId
      ? localSubsets.map(s => s.id === newSubsetId ? { ...s, manualSort: true } : s)
      : localSubsets;
    dragIndex = null; overIndex = null;
    await persistSubsets(reordered, finalSubsets);
  }

  function onDragEnd() { dragIndex = null; overIndex = null; }

  let touchStartIndex = $state<number | null>(null);
  let touchStartY = $state<number | null>(null);
  let touchStartX = $state<number | null>(null);
  const DRAG_THRESHOLD = 8;

  // Drag handle touch — drag reorder only, stops propagation so row handler doesn't fire
  function handleDragHandleTouchStart(e: TouchEvent, i: number) {
    e.stopPropagation();
    if (activeSubsetId !== null) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    if (!isFiltered) touchStartIndex = i;
  }

  function guestTagsFor(song: Song): { name: string; instruments: Instrument[] }[] {
    const permSet = new Set(allMusicians);
    return Object.entries(song.musicians)
      .filter(([name, role]) => !permSet.has(name) && role.instruments.length > 0)
      .map(([name, role]) => ({ name, instruments: sortInstruments(role.instruments) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function mobileEntryBubbles(entry: SetlistEntry, song: Song): { name: string; instruments: Instrument[]; progBg: string; progColor: string; isGuest: boolean }[] {
    const out: { name: string; instruments: Instrument[]; progBg: string; progColor: string; isGuest: boolean }[] = [];
    for (const name of allMusicians) {
      const role = song.musicians[name];
      if (!role?.instruments?.length) continue;
      const stage = entryStage(entry, name);
      out.push({ name, instruments: sortInstruments(role.instruments), progBg: PROG_BG[stage] ?? '#fcd34d40', progColor: PROG_COLOR[stage] ?? 'var(--text-muted)', isGuest: false });
    }
    const permSet = new Set(allMusicians);
    for (const [name, role] of Object.entries(song.musicians)) {
      if (!permSet.has(name) && role.instruments.length > 0) {
        const stage = entryStage(entry, name);
        out.push({ name, instruments: sortInstruments(role.instruments), progBg: PROG_BG[stage] ?? '', progColor: 'var(--text)', isGuest: true });
      }
    }
    return out;
  }
</script>

<div class="editor">
  <div class="editor-header">
    <div class="meta">
      {#if editingMeta}
        <div class="meta-form">
          <input class="meta-input meta-name" bind:value={draftMeta.name} placeholder="Название" />
          <input class="meta-input" type="date" bind:value={draftMeta.date} />
          <input class="meta-input" type="time" bind:value={draftMeta.startTime} />
          <div class="vibe-row">
            <label class="vibe-label">
              <input type="checkbox" bind:checked={draftMeta.vibe} />
              {$t.setlists.vibe}
            </label>
            <span class="help-tip" title={$t.setlists.vibeTooltip}>?</span>
          </div>
          <button class="btn-primary" onclick={saveMeta}>Сохранить</button>
          <button class="btn-secondary" onclick={() => { editingMeta = false; }}>Отмена</button>
        </div>
      {:else}
        <div class="meta-view">
          <h1>{localMeta.name} <span class="vibe-badge" class:no-vibe={!localMeta.vibe} title={$t.setlists.vibeTooltip}>{localMeta.vibe ? '+вайб' : '-вайб'}</span></h1>
          <div class="meta-details">
            {#if localMeta.date}<span class="date">{formatDate(localMeta.date)}</span>{/if}
            {#if localMeta.startTime}<span class="start-time">▶ {localMeta.startTime}</span>{/if}
            <span class="count">{$t.editor.songs(songCount)} ({formatDuration(totalMinutes)})</span>
            {#if songCount > 0}<span class="ready-count">{$t.progress.readyCount(readyCount, songCount)}</span>{/if}
          </div>
        </div>
        <button class="edit-meta-btn" onclick={startEditMeta} title="Редактировать">✏️</button>
      {/if}
    </div>
    <div class="header-actions">
      <div class="break-wrap">
        <button class="btn-secondary" onclick={() => { showBreakPicker = !showBreakPicker; }}>⏸ Перерыв</button>
        {#if showBreakPicker}
          <div class="break-picker">
            {#each [5, 10, 20, 30] as min}
              <button class="break-opt" onclick={() => handleAddBreak(min)}>{min} мин</button>
            {/each}
          </div>
        {/if}
      </div>
      <button class="btn-secondary" onclick={() => { showAddModal = true; }}>{$t.editor.addSongs}</button>
      <button class="btn-secondary" onclick={handleNewSubset}>{$t.editor.newSubset}</button>
      <a href="{base}/setlists/{setlist.id}/stage" class="btn-stage">{$t.editor.stageView}</a>
    </div>
  </div>

  <div class="filter-bar">
    <input class="filter-search" type="search" placeholder="Поиск..." bind:value={filterText} />
    {#each allMusicians as name}
      <button
        class="filter-chip"
        class:active={selectedMusician === name}
        onclick={() => toggleMusician(name)}
      >{name} ({musicianCounts()[name] ?? 0})</button>
    {/each}
    {#if guestNames.length > 0}
      <span class="filter-sep"></span>
      {#each guestNames as name}
        <button
          class="filter-chip filter-chip-guest"
          class:active={selectedMusician === name}
          onclick={() => toggleMusician(name)}
        >{name} ({musicianCounts()[name] ?? 0})</button>
      {/each}
    {/if}
    {#if allMusicians.length > 0 || guestNames.length > 0}
      <span class="filter-sep"></span>
    {/if}
    <button
      class="filter-chip"
      class:active={filterNotReady}
      onclick={() => { filterNotReady = !filterNotReady; }}
    >не готово ({songCount - readyCount})</button>
  </div>

  <!-- Mobile filter panel (slides up above bottom bar) -->
  <div class="mobile-filter-panel" class:open={filterOpen}>
    <div class="filter-group">
      <input class="filter-search filter-search-full" type="search" placeholder="Поиск по названию или исполнителю..." bind:value={filterText} />
    </div>
    <div class="filter-sep-h"></div>
    {#if allMusicians.length > 0}
      <div class="filter-group">
        {#each allMusicians as name}
          <button
            class="filter-chip"
            class:active={selectedMusician === name}
            onclick={() => toggleMusician(name)}
          >{name} ({musicianCounts()[name] ?? 0})</button>
        {/each}
      </div>
    {/if}
    {#if guestNames.length > 0}
      <div class="filter-sep-h"></div>
      <div class="filter-group">
        {#each guestNames as name}
          <button
            class="filter-chip filter-chip-guest"
            class:active={selectedMusician === name}
            onclick={() => toggleMusician(name)}
          >{name} ({musicianCounts()[name] ?? 0})</button>
        {/each}
      </div>
    {/if}
    {#if allMusicians.length > 0 || guestNames.length > 0}
      <div class="filter-sep-h"></div>
    {/if}
    <div class="filter-group">
      <button
        class="filter-chip"
        class:active={filterNotReady}
        onclick={() => { filterNotReady = !filterNotReady; }}
      >не готово ({songCount - readyCount})</button>
    </div>
    <div class="filter-sep-h"></div>
    <div class="filter-group mob-break-group">
      <span class="mob-break-label">⏸ Перерыв:</span>
      {#each [5, 10, 20, 30] as min}
        <button class="filter-chip" onclick={() => { handleAddBreak(min); filterOpen = false; }}>{min} мин</button>
      {/each}
    </div>
  </div>

  <!-- Mobile bottom bar -->
  <div class="mobile-bottom-bar">
    <button
      class="bottom-btn"
      class:active={filterOpen || isFiltered}
      onclick={() => { filterOpen = !filterOpen; }}
    >🎛️ Фильтр</button>
    <a href="{base}/setlists/{setlist.id}/stage" class="bottom-btn bottom-stage">🎤 На сцену</a>
    <button class="bottom-btn bottom-subset" onclick={handleNewSubset}>{$t.editor.newSubset}</button>
    <button class="bottom-add-btn" onclick={() => { showAddModal = true; }}>+ Добавить</button>
  </div>

  {#if sortedEntries.length === 0}
    <div class="empty">
      <p>{$t.editor.empty}</p>
      <button class="btn-primary" onclick={() => { showAddModal = true; }}>{$t.editor.addSongsBtn}</button>
    </div>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="th-drag"></th>
            <th class="th-num">#</th>
            {#if localMeta.startTime}<th class="th-time">⏱</th>{/if}
            <th class="th-song">Песня</th>
            {#each allMusicians as name, i}
              <th class="th-musician progress-delim" class:musician-alt={i % 2 === 0}>{name}</th>
            {/each}
            <th class="th-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each renderItems() as item (renderItemKey(item))}
            {#if item.kind === 'header'}
              <tr class="subset-header" class:active={activeSubsetId === item.subset.id} onclick={() => toggleSubsetMode(item.subset.id)}>
                <td colspan={totalCols}>
                  <span class="subset-header-name">⏭ {item.subset.name}</span>
                  <span class="subset-header-count">{$t.editor.subsetSongs(entriesInSubset(item.subset.id))}</span>
                  <button class="subset-dissolve" onclick={(e) => { e.stopPropagation(); dissolveSubset(item.subset.id); }} title={$t.editor.subsetDissolve}>✕</button>
                </td>
              </tr>
            {:else if item.kind === 'hint'}
              <tr class="subset-hint-row">
                <td colspan={totalCols}>
                  <span class="subset-hint-text">{$t.editor.subsetHint}</span>
                  <button class="subset-done-btn" onclick={() => { activeSubsetId = null; }}>{$t.editor.subsetDone}</button>
                </td>
              </tr>
            {:else if item.kind === 'divider'}
              <tr class="subset-rest-divider"><td colspan={totalCols}>{$t.editor.subsetRest}</td></tr>
            {:else}
              {@const entry = item.entry}
              {@const i = item.index}
              {@const isDragging = dragIndex !== null && entryKey(sortedEntries[dragIndex]) === entryKey(entry)}
              {@const isOver = overIndex === i && dragIndex !== null && dragIndex !== i}
              {@const songNum = displayEntries().slice(0, i + 1).filter(e => e.songId).length}
              {@const canDrag = !isFiltered && activeSubsetId === null}
              {#if entry.songId}
                {@const song = entry.song}
                {#if song}
                  {@const guestTags = guestTagsFor(song)}
                  {@const mobBubbles = mobileEntryBubbles(entry, song)}
                  <tr
                    class="song-row"
                    class:dragging={isDragging}
                    class:drag-over={isOver}
                    class:subset-member={!!entry.subsetId}
                    class:subset-active-member={activeSubsetId !== null && entry.subsetId === activeSubsetId}
                    draggable={canDrag}
                    data-row-i={i}
                    onclick={(e) => handleRowClick(e, entry)}
                    ondragstart={canDrag ? (ev) => { if ((ev.target as HTMLElement).closest('input,textarea')) { ev.preventDefault(); return; } onDragStart(sortedEntries.findIndex(e => entryKey(e) === entryKey(entry))); } : undefined}
                    ondragover={canDrag ? (e => onDragOver(e, i)) : undefined}
                    ondrop={canDrag ? onDrop : undefined}
                    ondragend={canDrag ? onDragEnd : undefined}
                  >
                    <td class="td-drag" ontouchstart={(e) => handleDragHandleTouchStart(e, i)}>
                      {#if activeSubsetId !== null}
                        <span class="subset-tap-indicator">{entry.subsetId === activeSubsetId ? '✓' : (entry.subsetId ? '' : '+')}</span>
                      {:else}
                        <span class="drag-handle">⠿</span>
                      {/if}
                    </td>
                    <td class="td-num">
                      {songNum}
                      <span class="entry-pct" style={pctBubbleStyle(entryProgressPct(entry))}>{entryProgressPct(entry)}%</span>
                      {#if localMeta.startTime}<span class="entry-time-mob">{entryTimes().get(entryKey(entry)) ?? ''}</span>{/if}
                    </td>
                    {#if localMeta.startTime}<td class="td-time">{entryTimes().get(entryKey(entry)) ?? ''}</td>{/if}
                    <td class="td-song">
                      <div class="song-name">
                        <span class="cat-inline"><CategoryBadge category={song.category} iconOnly /></span>
                        <span class="artist">{song.artist}</span>
                        <span class="sep">–</span>
                        <span class="title">{song.title}</span>
                        {#if song.lyrics}<button class="lyrics-btn-inline" onclick={(e) => { e.stopPropagation(); lyricsViewSong = song; }} title="Текст песни">📝</button>{/if}
                        {#each guestTags as g}
                          {@const gStage = entryStage(entry, g.name)}
                          <span class="guest-tag desktop-only" style="background: {PROG_BG[gStage] ?? 'var(--border)'}; color: {PROG_COLOR[gStage] ?? 'var(--text-muted)'};">{#each g.instruments as inst (inst)}<span>{instrumentIcons[inst]}</span>{/each} {g.name}</span>
                        {/each}
                      </div>
                      {#if mobBubbles.length > 0}
                        <div class="mobile-musicians">
                          {#each mobBubbles as b}
                            <span class="mob-bubble" class:mob-guest={b.isGuest} style="background: {b.progBg}">
                              <span class="mob-icons">{#each b.instruments as inst (inst)}<span>{instrumentIcons[inst]}</span>{/each}</span>
                              <span class="mob-name" style="color: {b.progColor}">{b.name}</span>
                            </span>
                          {/each}
                        </div>
                      {/if}
                      <CommentInput
                        value={entry.comment ?? ''}
                        onsave={(v) => updateEntryComment(setlist.id, entry.order, v).then(applyUpdate)}
                      />
                    </td>
                    {#each allMusicians as name, mi}
                      {@const role = song.musicians[name]}
                      {@const stage = entryStage(entry, name)}
                      {@const progBg = (role?.instruments?.length ?? 0) > 0 ? (PROG_BG[stage] ?? null) : null}
                      <td
                        class="td-musician progress-delim"
                        class:musician-alt={mi % 2 === 0 && !progBg}
                        style={progBg ? `background: ${progBg}` : ''}
                      >
                        {#if role?.instruments?.length}
                          <span class="inst-slot">{#each sortInstruments(role.instruments) as inst (inst)}<span>{instrumentIcons[inst]}</span>{/each}</span>
                        {/if}
                      </td>
                    {/each}
                    <td class="td-actions">
                      <button class="edit-btn" onclick={() => { editingEntry = entry; }} ontouchstart={(e) => e.stopPropagation()} ontouchend={(e) => { e.stopPropagation(); e.preventDefault(); editingEntry = entry; }} title="Редактировать в сетлисте">✏️</button>
                      <button class="remove-btn desktop-only" onclick={() => handleRemove(entry.songId!)} title={$t.editor.remove}>✕</button>
                    </td>
                  </tr>
                {/if}
              {:else}
                <tr
                  class="break-row"
                  class:dragging={isDragging}
                  class:drag-over={isOver}
                  draggable={activeSubsetId === null}
                  data-row-i={i}
                  ondragstart={() => onDragStart(sortedEntries.findIndex(e => entryKey(e) === entryKey(entry)))}
                  ondragover={e => onDragOver(e, i)}
                  ondrop={onDrop}
                  ondragend={onDragEnd}
                >
                  <td class="td-drag" ontouchstart={(e) => handleDragHandleTouchStart(e, i)}><span class="drag-handle">⠿</span></td>
                  <td class="td-num"></td>
                  {#if localMeta.startTime}<td class="td-time">{entryTimes().get(entryKey(entry)) ?? ''}</td>{/if}
                  <td colspan={totalCols - 2 - (localMeta.startTime ? 1 : 0)} class="td-break">
                    <div class="break-inner">
                    <span class="break-icon">⏸</span>
                    <div class="break-body">
                      {#if editingBreakOrder === entry.order}
                        <div class="break-edit-row">
                          {#each [5, 10, 20, 30] as min}
                            <button
                              class="break-opt"
                              class:break-opt-active={entry.breakMinutes === min}
                              onclick={(e) => { e.stopPropagation(); handleUpdateBreak(entry.order, min); }}
                            >{min} мин</button>
                          {/each}
                          <button class="break-opt-cancel" onclick={(e) => { e.stopPropagation(); editingBreakOrder = null; }}>✕</button>
                        </div>
                      {:else}
                        <button class="break-label" onclick={(e) => { e.stopPropagation(); editingBreakOrder = entry.order; }}>
                          Перерыв — {entry.breakMinutes} мин
                        </button>
                      {/if}
                      <CommentInput
                        value={entry.comment ?? ''}
                        onsave={(v) => updateEntryComment(setlist.id, entry.order, v).then(applyUpdate)}
                      />
                    </div>
                    <button class="remove-btn break-remove" onclick={(e) => { e.stopPropagation(); handleRemoveBreak(entry.order); }}>✕</button>
                    </div>
                  </td>
                </tr>
              {/if}
            {/if}
          {/each}
          {#if dragIndex !== null}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <tr
              class="drop-end-row"
              class:drop-end-active={overIndex === sortedEntries.length}
              ondragover={e => { e.preventDefault(); overIndex = sortedEntries.length; }}
              ondrop={onDrop}
            >
              <td colspan={totalCols}></td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if showAddModal}
  <AddSongsModal
    songs={allSongs}
    {existingIds}
    onclose={() => { showAddModal = false; }}
    onadd={handleAdd}
  />
{/if}

{#if lyricsViewSong}
  <LyricsOverlay
    song={lyricsViewSong}
    onclose={() => { lyricsViewSong = null; }}
    onsongupdate={(updated) => { lyricsViewSong = updated; }}
  />
{/if}

{#if editingEntry}
  <SongEditModal
    song={editingEntry.song ? { ...editingEntry.song, comment: editingEntry.comment ?? '' } : null}
    {musicians}
    mode="entry"
    onclose={() => { editingEntry = null; }}
    onsave={handleEntrySave}
    onremove={editingEntry.songId ? () => { handleRemove(editingEntry!.songId!); } : undefined}
  />
{/if}

<style>
  .editor { display: flex; flex-direction: column; height: calc(100dvh - 56px); }
  .editor-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 16px; flex-shrink: 0; border-bottom: 1px solid var(--border); }
  .meta { display: flex; align-items: flex-start; gap: 8px; }
  .meta-view h1 { margin: 0 0 4px; font-size: 1.4rem; }
  .meta-details { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
  .date, .count, .start-time { font-size: 0.82rem; color: var(--text-muted); }
  .start-time { font-weight: 600; }
  .ready-count { font-size: 0.82rem; font-weight: 600; color: #005909; }
  .edit-meta-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; opacity: 0.5; padding: 4px; margin-top: 2px; }
  .edit-meta-btn:hover { opacity: 1; }
  .meta-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .meta-input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 0.9rem; }
  .meta-name { font-size: 1rem; font-weight: 600; min-width: 200px; }
  .vibe-row { display: flex; align-items: center; gap: 5px; }
  .vibe-label { display: flex; align-items: center; gap: 5px; font-size: 0.82rem; color: var(--text-muted); cursor: pointer; }
  .vibe-label input[type="checkbox"] { cursor: pointer; }
  .vibe-badge { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.04em; padding: 1px 6px; border-radius: 8px; background: #7c3aed; color: #fff; cursor: default; vertical-align: middle; }
  .vibe-badge.no-vibe { background: #dc2626; }
  .lyrics-btn-inline { font-size: 0.75rem; margin-left: 5px; vertical-align: middle; background: #7c3aed; color: #fff; border: none; border-radius: 4px; padding: 4px 18px; line-height: 1.4; cursor: pointer; display: inline-flex; align-items: center; }
  .lyrics-btn-inline:hover { background: #6d28d9; }
  .help-tip {
    display: inline-flex; align-items: center; justify-content: center;
    width: 15px; height: 15px; border-radius: 50%;
    border: 1px solid var(--border); font-size: 0.65rem;
    color: var(--text-muted); cursor: default; flex-shrink: 0; line-height: 1;
  }
  .header-actions { display: flex; gap: 8px; align-items: center; }
  .btn-secondary { padding: 8px 16px; border: 1px solid var(--border); border-radius: 6px; background: transparent; cursor: pointer; color: var(--text); font-size: 0.88rem; }
  .btn-primary { padding: 8px 16px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
  .btn-stage { padding: 8px 16px; background: var(--accent); color: #fff; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.88rem; }
  .empty { text-align: center; padding: 60px 20px; color: var(--text-muted); }
  .empty p { margin-bottom: 12px; }

  .filter-bar {
    display: flex; flex-wrap: wrap; gap: 5px;
    padding: 8px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .filter-chip {
    padding: 3px 12px; border: 1px solid var(--border); border-radius: 20px;
    background: transparent; cursor: pointer; font-size: 0.82rem; font-weight: 500;
    color: var(--text-muted); transition: all 0.15s;
  }
  .filter-chip:hover { border-color: var(--accent); color: var(--accent); }
  .filter-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .filter-chip-guest { border-style: dashed; }
  .filter-sep { width: 1px; height: 22px; background: var(--border); flex-shrink: 0; align-self: center; }

  .mobile-filter-panel { display: none; }
  .mobile-bottom-bar { display: none; }

  .break-wrap { position: relative; }
  .break-picker {
    position: absolute; top: calc(100% + 4px); left: 0;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    display: flex; flex-direction: column; overflow: hidden; z-index: 10; min-width: 100px;
  }
  .break-opt { padding: 8px 16px; background: transparent; border: none; cursor: pointer; text-align: left; font-size: 0.88rem; color: var(--text); }
  .break-opt:hover { background: var(--row-hover); }

  .table-wrap { overflow: auto; flex: 1; min-height: 0; padding: 0 16px 16px; }
  table { width: 100%; border-collapse: separate; border-spacing: 0 3px; background: var(--surface); }

  thead th {
    padding: 4px 8px; font-size: 0.72rem; font-weight: 700;
    color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;
    text-align: left; white-space: nowrap;
    position: sticky; top: 0; z-index: 2;
    background: var(--bg); box-shadow: 0 2px 0 var(--border);
  }
  .th-num, .td-num { text-align: right; width: 28px; }
  .th-time, .td-time { width: 42px; font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; text-align: right; padding-right: 6px; }
  .th-drag, .td-drag { width: 24px; }
  .th-musician { text-align: center; width: 6%; min-width: 52px; }
  .td-musician { text-align: left; width: 6%; min-width: 52px; }
  .td-musician.progress-delim, .th-musician.progress-delim { border-right: 1px solid rgba(128,128,128,0.22); }
  .th-musician.musician-alt { background: var(--musician-alt-bg); }
  tbody tr td.musician-alt { background: var(--musician-alt-bg); }
  thead .th-musician { text-align: center; }
  .th-actions, .td-actions { width: 56px; white-space: nowrap; text-align: right; }

  tbody tr td { padding: 7px 8px; background: var(--surface); vertical-align: middle; }
  tbody tr td:first-child { border-radius: 8px 0 0 8px; }
  tbody tr td:last-child { border-radius: 0 8px 8px 0; }

  .song-row { cursor: grab; user-select: none; }
  .song-row:hover td { background: var(--row-hover); }
  .song-row:active { cursor: grabbing; }
  .song-row.dragging td { opacity: 0.35; }
  .song-row.drag-over td { outline: 2px dashed var(--accent); outline-offset: -1px; }

  .break-row { cursor: grab; user-select: none; }
  .break-row td { background: rgba(59, 130, 246, 0.09); border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border); }
  .break-row td:first-child { border-left: 1px dashed var(--border); }
  .break-row td:last-child { border-right: 1px dashed var(--border); }
  .break-row:hover td { border-color: var(--accent); }
  .break-row.dragging td { opacity: 0.35; }
  .break-row.drag-over td { outline: 2px dashed var(--accent); outline-offset: -1px; }

  .drop-end-row td { height: 28px; border-radius: 8px; }
  .drop-end-active td { outline: 2px dashed var(--accent); }

  .subset-header { cursor: pointer; user-select: none; }
  .subset-header td {
    background: rgba(124, 58, 237, 0.12);
    border-top: 2px solid #7c3aed;
    padding: 6px 10px;
    font-size: 0.86rem;
    display: flex; align-items: center; gap: 8px;
  }
  .subset-header:hover td { background: rgba(124, 58, 237, 0.18); }
  .subset-header.active td { background: rgba(124, 58, 237, 0.24); }
  .subset-header-name { font-weight: 700; color: #7c3aed; }
  .subset-header-count { color: var(--text-muted); font-size: 0.8rem; }
  .subset-dissolve {
    margin-left: auto; background: none; border: none; cursor: pointer;
    color: var(--text-muted); font-size: 0.82rem; padding: 2px 6px; border-radius: 4px;
  }
  .subset-dissolve:hover { color: #ef4444; }

  .subset-hint-row td {
    background: rgba(124, 58, 237, 0.06);
    padding: 6px 10px; font-size: 0.8rem; color: var(--text-muted);
    display: flex; align-items: center; gap: 10px;
  }
  .subset-done-btn {
    margin-left: auto; padding: 4px 14px; border: 1px solid #7c3aed; border-radius: 14px;
    background: #7c3aed; color: #fff; cursor: pointer; font-size: 0.8rem; font-weight: 600;
  }

  .subset-rest-divider td {
    padding: 4px 10px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em;
    text-transform: uppercase; color: var(--text-muted); border-top: 1px solid var(--border);
  }

  .song-row.subset-member td { background: rgba(124, 58, 237, 0.05); }
  .song-row.subset-member:hover td { background: rgba(124, 58, 237, 0.1); }
  .song-row.subset-active-member td { background: rgba(124, 58, 237, 0.1); }
  .subset-tap-indicator {
    display: block; text-align: center; font-size: 1rem; font-weight: 700; color: #7c3aed;
  }

  .drag-handle { color: var(--text-muted); font-size: 1rem; cursor: grab; opacity: 0.4; display: block; text-align: center; }
  .song-row:hover .drag-handle, .break-row:hover .drag-handle { opacity: 1; }

  .td-num { font-size: 0.82rem; color: var(--text-muted); white-space: nowrap; text-align: right; }
  .entry-pct { display: block; font-size: 0.68rem; font-weight: 600; padding: 1px 5px; border-radius: 8px; white-space: nowrap; margin-top: 3px; }
  .cat-inline { font-size: 0.98em; margin-left: 6px; margin-right: 6px; vertical-align: middle; display: inline-block; }


  .td-song { white-space: nowrap; }
  .song-name { display: flex; align-items: center; }
  .artist { font-weight: 400; font-size: 1.08rem; }
  .sep { color: var(--text-muted); margin: 0 4px; }
  .title { font-size: 1.08rem; font-weight: 600; }
  .song-row:hover :global(.comment-input::placeholder) { opacity: 0.5; }
  .song-row:hover :global(.comment-input) { border-bottom-color: var(--border); }

  .guest-tag {
    display: inline-block;
    font-size: 0.89rem;
    font-weight: 500;
    padding: 2px 10px;
    border-radius: 10px;
    margin-left: 6px;
    white-space: nowrap;
    vertical-align: middle;
  }

  .td-musician { font-size: 1.17rem; white-space: nowrap; }
  .inst-slot { display: inline-block; width: 1.3em; vertical-align: middle; }

  .td-break { font-size: 0.82rem; color: var(--text-muted); }
  .break-inner { display: flex; align-items: flex-start; gap: 6px; }
  .break-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .break-edit-row { display: flex; align-items: center; gap: 4px; }
  .break-remove { margin-left: auto; flex-shrink: 0; align-self: center; }
  .break-label {
    background: none; border: none; cursor: pointer; font-size: 0.82rem;
    color: var(--text-muted); font-style: italic; padding: 0; text-align: left;
  }
  .break-label:hover { color: var(--accent); }
  .break-row:hover :global(.comment-input::placeholder) { opacity: 0.5; }
  .break-row:hover :global(.comment-input) { border-bottom-color: var(--border); }
  .break-opt {
    background: none; border: 1px solid var(--border); border-radius: 4px;
    padding: 1px 8px; font-size: 0.8rem; cursor: pointer; color: var(--text-muted); margin-right: 4px;
  }
  .break-opt:hover { border-color: var(--accent); color: var(--accent); }
  .break-opt-active { border-color: var(--accent); color: var(--accent); font-weight: 600; }
  .break-opt-cancel {
    background: none; border: none; cursor: pointer; font-size: 0.78rem;
    color: var(--text-muted); padding: 0 4px; margin-left: 2px;
  }
  .break-icon { flex-shrink: 0; line-height: 1; margin-top: 2px; }
  .break-icon :global(img) { display: block; }

  .filter-search {
    padding: 3px 10px; border: 1px solid var(--border); border-radius: 20px;
    background: transparent; color: var(--text); font-size: 0.82rem;
    outline: none; width: 140px;
  }
  .filter-search:focus { border-color: var(--accent); }
  .filter-search-full { width: 100%; box-sizing: border-box; border-radius: 8px; padding: 6px 10px; }

  .edit-btn { background: none; border: none; cursor: pointer; font-size: 1.17rem; padding: 2px 4px; opacity: 0.4; transition: opacity 0.12s; }
  .edit-btn:hover { opacity: 1; }

  .remove-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px 6px; font-size: 0.82rem; border-radius: 4px; }
  .remove-btn:hover { color: #ef4444; }

  .mobile-musicians { display: none; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
  .mob-bubble {
    display: inline-flex; align-items: center; gap: 3px;
    border-radius: 6px; padding: 1px 6px 1px 3px;
    font-size: 0.82rem; color: var(--text-muted);
  }
  .mob-bubble.mob-guest { border: 1px dashed var(--border); background: transparent !important; }
  .mob-icons { font-size: 1rem; flex-shrink: 0; }
  .mob-name {
    white-space: nowrap;
    overflow: hidden;
    flex: 1;
    min-width: 0;
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 20px), transparent 100%);
    mask-image: linear-gradient(to right, black calc(100% - 20px), transparent 100%);
  }
  :global([data-theme="dark"]) .mob-bubble:not(.mob-guest) { filter: brightness(2); }
  :global([data-theme="dark"]) .guest-tag { color: rgba(255,255,255,0.85) !important; }

  .entry-time-mob { display: none; }

  @media (max-width: 700px) {
    .editor { height: calc(100dvh - 56px - 64px); }
    .th-musician { display: none; }
    .td-musician { display: none; }
    .th-time, .td-time { display: none; }
    .desktop-only { display: none !important; }
    .filter-bar { display: none; }
    .header-actions { display: none; }
    .entry-time-mob { display: block; font-size: 0.65rem; color: var(--text-muted); white-space: nowrap; margin-top: 2px; text-align: right; }
    .mobile-musicians {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      margin-top: 6px;
    }
    .mob-bubble { display: flex; width: 100%; box-sizing: border-box; min-width: 0; overflow: hidden; }
    thead { display: none; }
    .th-actions, .td-actions { width: 32px; }
    .td-actions { vertical-align: top; }
    .td-song { white-space: normal; }
    .table-wrap { padding: 0 0 16px; overflow-x: hidden; }
    .editor-header { padding: 12px 8px; }
    .song-name { flex-wrap: wrap; }
    .meta-input { font-size: 16px; }

    /* Song row separators */
    .song-row td { border-top: 1px solid var(--border); }

    /* Full-width table so td-break colspan reaches the right edge */
    table { width: 100%; }

    /* No hover effects on touch devices */
    .song-row:hover td { background: var(--surface); }
    .song-row:hover .drag-handle { opacity: 0.4; }
    .break-row:hover td { border-color: var(--border); }
    .break-row:hover .drag-handle { opacity: 0.4; }
    .edit-btn { opacity: 1; }

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
    .bottom-stage {
      text-decoration: none; padding: 10px 16px; border: 1px solid var(--border); border-radius: 20px;
      background: transparent; font-size: 0.9rem; font-weight: 500; color: var(--text-muted);
      white-space: nowrap;
    }
    .bottom-subset { padding: 10px 12px; border-color: #7c3aed; color: #7c3aed; font-size: 0.82rem; }
    .bottom-add-btn {
      margin-left: auto; padding: 10px 20px;
      background: var(--accent); color: #fff; border: none; border-radius: 20px;
      cursor: pointer; font-weight: 600; font-size: 0.95rem;
    }
    .mob-break-label { font-size: 0.82rem; color: var(--text-muted); align-self: center; }
    .mob-break-group { align-items: center; }
  }
</style>
