<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Setlist, Song, Instrument, SetlistEntry, SetlistSubset, BandMusician, LearningStage } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import AddSongsModal from './AddSongsModal.svelte';
  import SongEditModal from '$components/backlog/SongEditModal.svelte';
  import { getSetlist, updateSetlist, updateSong, getSong, addSongsToSetlist, addSetlistOnlySong, removeSongFromSetlist, reorderEntries, addBreakToSetlist, removeBreakFromSetlist, updateBreak, updateEntryComment, updateEntrySong } from '$lib/api';
  import { lang, t } from '$lib/i18n';
  import { startPolling } from '$lib/poller';
  import { currentUser } from '$lib/auth';
  import { formatDuration, formatDate, addMinutes, sortInstruments, songReadiness, progressPct, pctBubbleStyle, STAGE_PCT, isEventLongOver } from '$lib/utils';
  import { sortSubset } from '$lib/subsetSort';
  import { buildSetlistLayout, normalizeSetlistLayout, moveLayoutEntry, moveLayoutEntryToSubset, moveSubsetBlock, moveSubsetBlockBy, type SetlistLayoutItem } from '$lib/setlistLayout';
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
  let showSetlistOnlyModal = $state(false);
  let showBreakPicker = $state(false);
  let editingBreakOrder = $state<number | null>(null);
  let draggedEntryKey = $state<string | null>(null);
  let overEntryKey = $state<string | 'end' | null>(null);
  let overEntrySide = $state<'before' | 'after'>('before');
  let draggedSubsetId = $state<string | null>(null);
  let overSubsetId = $state<string | null>(null);
  let overSubsetSide = $state<'before' | 'after'>('before');
  let editingEntry = $state<SetlistEntry | null>(null);
  let lyricsViewEntry = $state<SetlistEntry | null>(null);
  let selectedMusician = $state<string | null>(null);
  let filterNotReady = $state(false);
  let filterText = $state('');
  let filterOpen = $state(false);
  let activeSubsetId = $state<string | null>(null);
  let draftSubsetName = $state('');
  let tableWrapEl = $state<HTMLDivElement | null>(null);
  let autoScrollFrame: number | null = null;
  let autoScrollSpeed = 0;
  let lastDragClientX = 0;
  let lastDragClientY = 0;
  const AUTO_SCROLL_EDGE = 80;
  const AUTO_SCROLL_MAX_SPEED = 22;

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

    if (draggedEntryKey !== null || draggedSubsetId !== null) {
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

  async function persistSubsets(entries: SetlistEntry[], subsets: SetlistSubset[]) {
    localEntries = entries;
    localSubsets = subsets;
    applyUpdate(await reorderEntries(setlist.id, entries, subsets));
  }

  function currentLayout(): SetlistLayoutItem[] {
    return buildSetlistLayout(localEntries, localSubsets);
  }

  async function persistLayout(layout: SetlistLayoutItem[]) {
    const normalized = normalizeSetlistLayout(layout);
    await persistSubsets(normalized.entries, normalized.subsets);
  }

  // Up to 2 songs (oldest→most recent) this subset should chain after: the tail
  // of the previous subset, or — for the first subset — the most recently played songs.
  function computeAnchors(subsetId: string): Song[] {
    const orderedSubsets = currentLayout()
      .filter((item): item is Extract<SetlistLayoutItem, { kind: 'subset' }> => item.kind === 'subset')
      .map(item => item.subset);
    const idx = orderedSubsets.findIndex(s => s.id === subsetId);
    if (idx > 0) {
      const prevMembers = sortedEntries.filter(e => e.subsetId === orderedSubsets[idx - 1].id);
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

  function subsetPosition(subsetId: string): number {
    return currentLayout()
      .filter(item => item.kind === 'subset')
      .findIndex(item => item.kind === 'subset' && item.subset.id === subsetId);
  }

  function subsetTotal(): number {
    return currentLayout().filter(item => item.kind === 'subset').length;
  }

  async function handleNewSubset() {
    const subset: SetlistSubset = { id: crypto.randomUUID(), name: $t.editor.subsetDefaultName(localSubsets.length + 1) };
    const layout = currentLayout();
    const lastSubsetIndex = layout.findLastIndex(item => item.kind === 'subset');
    layout.splice(lastSubsetIndex + 1, 0, { kind: 'subset', subset, entries: [] });
    activeSubsetId = subset.id;
    draftSubsetName = subset.name;
    await persistLayout(layout);
  }

  function openSubsetEdit(subset: SetlistSubset) {
    activeSubsetId = subset.id;
    draftSubsetName = subset.name;
  }

  function handleSubsetHeaderClick(subset: SetlistSubset) {
    if (activeSubsetId !== subset.id && window.matchMedia('(max-width: 700px)').matches) openSubsetEdit(subset);
  }

  async function finishSubsetEdit() {
    if (!activeSubsetId || !draftSubsetName.trim()) return;
    const layout = currentLayout().map(item =>
      item.kind === 'subset' && item.subset.id === activeSubsetId
        ? { ...item, subset: { ...item.subset, name: draftSubsetName.trim() } }
        : item
    );
    await persistLayout(layout);
    activeSubsetId = null;
  }

  async function dissolveSubset(subsetId: string) {
    const layout = currentLayout();
    const index = layout.findIndex(item => item.kind === 'subset' && item.subset.id === subsetId);
    if (index < 0) return;
    const [removed] = layout.splice(index, 1);
    if (removed.kind === 'subset') {
      layout.push(...removed.entries.map(entry => ({ kind: 'entry' as const, entry })));
    }
    if (activeSubsetId === subsetId) activeSubsetId = null;
    await persistLayout(layout);
  }

  async function moveSubset(subsetId: string, targetSubsetId: string) {
    await persistLayout(moveSubsetBlock(currentLayout(), subsetId, targetSubsetId));
  }

  async function moveSubsetBy(subsetId: string, delta: -1 | 1) {
    await persistLayout(moveSubsetBlockBy(currentLayout(), subsetId, delta));
  }

  async function toggleSubsetMembership(entry: SetlistEntry) {
    if (activeSubsetId === null || !entry.songId) return;
    if (entry.subsetId && entry.subsetId !== activeSubsetId) return; // belongs to another subset
    const subsetId = activeSubsetId;
    const subset = localSubsets.find(s => s.id === subsetId);
    if (!subset) return;

    const layout = currentLayout();
    const block = layout.find((item): item is Extract<SetlistLayoutItem, { kind: 'subset' }> =>
      item.kind === 'subset' && item.subset.id === subsetId
    );
    if (!block) return;

    if (entry.subsetId === subsetId) {
      block.entries = block.entries.filter(member => member.songId !== entry.songId);
      layout.push({ kind: 'entry', entry });
      await persistLayout(layout);
      return;
    }

    const entryIndex = layout.findIndex(item => item.kind === 'entry' && item.entry.songId === entry.songId);
    if (entryIndex < 0) return;
    layout.splice(entryIndex, 1);
    const members = [...block.entries, { ...entry, subsetId }];
    let overrideList = members;
    if (!subset.manualSort) {
      const anchors = computeAnchors(subsetId);
      const sortedSongs = sortSubset(members.map(e => e.song!), anchors);
      const bySongId = new Map(members.map(e => [e.songId!, e]));
      overrideList = sortedSongs.map(s => bySongId.get(s.id)!);
    }
    block.entries = overrideList;
    await persistLayout(layout);
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
    | { kind: 'entry'; entry: SetlistEntry };

  let renderItems = $derived((): RenderItem[] => {
    const display = displayEntries();
    if (isFiltered) {
      return display.map(entry => ({ kind: 'entry' as const, entry }));
    }
    const items: RenderItem[] = [];
    let restDividerAdded = false;
    for (const layoutItem of currentLayout()) {
      if (layoutItem.kind === 'subset') {
        items.push({ kind: 'header', subset: layoutItem.subset });
        if (activeSubsetId === layoutItem.subset.id) items.push({ kind: 'hint', subset: layoutItem.subset });
        for (const entry of layoutItem.entries) items.push({ kind: 'entry', entry });
      } else {
        if (layoutItem.entry.songId && localSubsets.length > 0 && !restDividerAdded) {
          items.push({ kind: 'divider' });
          restDividerAdded = true;
        }
        items.push({ kind: 'entry', entry: layoutItem.entry });
      }
    }
    return items;
  });

  function renderItemKey(item: RenderItem): string {
    if (item.kind === 'entry') return entryKey(item.entry);
    if (item.kind === 'divider') return 'divider';
    return `${item.kind}-${item.subset.id}`;
  }

  function updateDropTargetAtPoint(clientX: number, clientY: number) {
    const el = document.elementFromPoint(clientX, clientY);
    if (draggedSubsetId !== null) {
      const blockRow = el?.closest('[data-subset-block-id]') as HTMLElement | null;
      if (blockRow) {
        overSubsetId = blockRow.dataset.subsetBlockId ?? null;
        return;
      }

      const headers = tableWrapEl
        ? [...tableWrapEl.querySelectorAll<HTMLElement>('.subset-header[data-subset-block-id]')]
        : [];
      const nearest = headers.reduce<HTMLElement | null>((best, header) => {
        if (!best) return header;
        const headerDistance = Math.abs(header.getBoundingClientRect().top - clientY);
        const bestDistance = Math.abs(best.getBoundingClientRect().top - clientY);
        return headerDistance < bestDistance ? header : best;
      }, null);
      overSubsetId = nearest?.dataset.subsetBlockId ?? null;
      return;
    }

    const row = el?.closest('[data-row-key]') as HTMLElement | null;
    if (row) {
      overEntryKey = row.dataset.rowKey ?? null;
      overSubsetId = null;
      const rect = row.getBoundingClientRect();
      overEntrySide = clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      return;
    }

    const header = el?.closest('.subset-header[data-subset-block-id]') as HTMLElement | null;
    if (header) {
      overEntryKey = null;
      overSubsetId = header.dataset.subsetBlockId ?? null;
      const rect = header.getBoundingClientRect();
      overSubsetSide = clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    }
  }

  function stopDragAutoScroll() {
    autoScrollSpeed = 0;
    if (autoScrollFrame !== null) {
      cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = null;
    }
  }

  function autoScrollTick() {
    autoScrollFrame = null;
    if (!tableWrapEl || autoScrollSpeed === 0 || (draggedEntryKey === null && draggedSubsetId === null)) return;
    const before = tableWrapEl.scrollTop;
    tableWrapEl.scrollTop += autoScrollSpeed;
    updateDropTargetAtPoint(lastDragClientX, lastDragClientY);
    if (tableWrapEl.scrollTop === before) {
      autoScrollSpeed = 0;
      return;
    }
    autoScrollFrame = requestAnimationFrame(autoScrollTick);
  }

  function updateDragAutoScroll(clientX: number, clientY: number) {
    lastDragClientX = clientX;
    lastDragClientY = clientY;
    if (!tableWrapEl || (draggedEntryKey === null && draggedSubsetId === null)) {
      stopDragAutoScroll();
      return;
    }

    const rect = tableWrapEl.getBoundingClientRect();
    const edge = Math.min(AUTO_SCROLL_EDGE, rect.height / 3);
    let speed = 0;
    if (clientY < rect.top + edge) {
      const strength = Math.min(1, Math.max(0, (rect.top + edge - clientY) / edge));
      speed = -Math.ceil(AUTO_SCROLL_MAX_SPEED * strength);
    } else if (clientY > rect.bottom - edge) {
      const strength = Math.min(1, Math.max(0, (clientY - (rect.bottom - edge)) / edge));
      speed = Math.ceil(AUTO_SCROLL_MAX_SPEED * strength);
    }

    autoScrollSpeed = speed;
    if (speed === 0) {
      stopDragAutoScroll();
    } else if (autoScrollFrame === null) {
      autoScrollFrame = requestAnimationFrame(autoScrollTick);
    }
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

      if (draggedEntryKey === null) {
        if (touchStartEntryKey !== null && dy > DRAG_THRESHOLD && dy > dx) {
          draggedEntryKey = touchStartEntryKey;
        } else {
          return;
        }
      }
      e.preventDefault();
      updateDropTargetAtPoint(touch.clientX, touch.clientY);
      updateDragAutoScroll(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = () => {
      if (draggedEntryKey !== null) {
        if (overSubsetId) dropEntryOnSubset(overSubsetId);
        else dropEntry();
      }
      touchStartEntryKey = null;
      touchStartY = null;
      touchStartX = null;
      stopDragAutoScroll();
    };

    const handleTouchCancel = () => {
      touchStartEntryKey = null;
      touchStartY = null;
      touchStartX = null;
      clearEntryDrag();
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchCancel);

    return () => {
      stopPoller();
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
      stopDragAutoScroll();
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
    return filteredEntries();
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

  async function handleAddSetlistOnly(song: Song) {
    applyUpdate(await addSetlistOnlySong(setlist.id, song));
    showSetlistOnlyModal = false;
  }

  async function handleAddBreak(minutes: number) {
    applyUpdate(await addBreakToSetlist(setlist.id, minutes));
    showBreakPicker = false;
  }

  async function handleRemove(songId: string) {
    applyUpdate(await removeSongFromSetlist(setlist.id, songId));
  }

  // While editing a subset, ✕ on one of its members removes it from the subset
  // instead of deleting it from the setlist entirely.
  async function handleRemoveClick(entry: SetlistEntry) {
    if (activeSubsetId !== null && entry.subsetId === activeSubsetId) {
      await toggleSubsetMembership(entry);
      return;
    }
    await handleRemove(entry.songId!);
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
    if (entry.songId && !entry.setlistOnly) {
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

  async function saveSetlistOnlyTranspose(entry: SetlistEntry, song: Song): Promise<Song> {
    const updated = await updateEntrySong(setlist.id, entry.order, song);
    applyUpdate(updated);
    return updated.entries.find(candidate => candidate.songId === entry.songId)?.song ?? song;
  }

  function entryKey(entry: typeof sortedEntries[0]) {
    return entry.songId ?? `break-${entry.order}`;
  }

  function onEntryDragStart(key: string) { draggedEntryKey = key; }

  function onEntryDragOver(e: DragEvent, key: string) {
    e.preventDefault();
    if (draggedSubsetId !== null) {
      updateDropTargetAtPoint(e.clientX, e.clientY);
      updateDragAutoScroll(e.clientX, e.clientY);
      return;
    }
    overEntryKey = key;
    const row = e.currentTarget as HTMLElement;
    const rect = row.getBoundingClientRect();
    overEntrySide = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    updateDragAutoScroll(e.clientX, e.clientY);
  }

  async function dropEntry() {
    const sourceKey = draggedEntryKey;
    const targetKey = overEntryKey;
    if (!sourceKey || !targetKey || sourceKey === targetKey) {
      clearEntryDrag();
      return;
    }

    const layout = moveLayoutEntry(currentLayout(), sourceKey, targetKey, overEntrySide);
    clearEntryDrag();
    await persistLayout(layout);
  }

  function clearEntryDrag() {
    draggedEntryKey = null;
    overEntryKey = null;
    if (!draggedSubsetId) overSubsetId = null;
    stopDragAutoScroll();
  }

  function onSubsetDragStart(e: DragEvent, subsetId: string) {
    if (isFiltered || window.matchMedia('(max-width: 700px)').matches) {
      e.preventDefault();
      return;
    }
    draggedSubsetId = subsetId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', subsetId);
      const subset = localSubsets.find(candidate => candidate.id === subsetId);
      const preview = document.createElement('div');
      preview.textContent = `⏭ ${subset?.name ?? ''} · ${$t.editor.subsetSongs(entriesInSubset(subsetId))}`;
      Object.assign(preview.style, {
        position: 'fixed',
        left: '-10000px',
        top: '-10000px',
        padding: '10px 14px',
        borderRadius: '8px',
        background: '#ede9fe',
        color: '#5b21b6',
        border: '2px solid #7c3aed',
        font: '600 14px system-ui, sans-serif',
        whiteSpace: 'nowrap',
      });
      document.body.appendChild(preview);
      e.dataTransfer.setDragImage(preview, 24, 20);
      requestAnimationFrame(() => preview.remove());
    }
  }

  function onSubsetDragOver(e: DragEvent, subsetId: string) {
    if (!draggedSubsetId && !draggedEntryKey) return;
    e.preventDefault();
    overSubsetId = subsetId;
    const row = e.currentTarget as HTMLElement;
    const rect = row.getBoundingClientRect();
    overSubsetSide = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    updateDragAutoScroll(e.clientX, e.clientY);
  }

  async function dropSubset() {
    const source = draggedSubsetId;
    const target = overSubsetId;
    draggedSubsetId = null;
    overSubsetId = null;
    stopDragAutoScroll();
    if (source && target && source !== target) await moveSubset(source, target);
  }

  async function dropEntryOnSubset(subsetId: string) {
    if (!draggedEntryKey) return;
    const layout = moveLayoutEntryToSubset(currentLayout(), draggedEntryKey, subsetId, overSubsetSide);
    clearEntryDrag();
    overSubsetId = null;
    await persistLayout(layout);
  }

  async function dropAtCurrentTarget() {
    if (draggedSubsetId) {
      await dropSubset();
    } else if (draggedEntryKey && overSubsetId) {
      await dropEntryOnSubset(overSubsetId);
    } else {
      await dropEntry();
    }
  }

  function clearSubsetDrag() {
    draggedSubsetId = null;
    overSubsetId = null;
    stopDragAutoScroll();
  }

  let touchStartEntryKey = $state<string | null>(null);
  let touchStartY = $state<number | null>(null);
  let touchStartX = $state<number | null>(null);
  const DRAG_THRESHOLD = 8;

  // Drag handle touch — drag reorder only, stops propagation so row handler doesn't fire
  function handleDragHandleTouchStart(e: TouchEvent, key: string) {
    e.stopPropagation();
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    if (!isFiltered) touchStartEntryKey = key;
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
          <input class="meta-input meta-name" bind:value={draftMeta.name} placeholder={$t.editor.namePlaceholder} />
          <input class="meta-input" type="date" bind:value={draftMeta.date} />
          <input class="meta-input" type="time" bind:value={draftMeta.startTime} />
          <div class="vibe-row">
            <label class="vibe-label">
              <input type="checkbox" bind:checked={draftMeta.vibe} />
              {$t.setlists.vibe}
            </label>
            <span class="help-tip" title={$t.setlists.vibeTooltip}>?</span>
          </div>
          <button class="btn-primary" onclick={saveMeta}>{$t.editor.save}</button>
          <button class="btn-secondary" onclick={() => { editingMeta = false; }}>{$t.editor.cancel}</button>
        </div>
      {:else}
        <div class="meta-view">
          <h1>{localMeta.name} <span class="vibe-badge" class:no-vibe={!localMeta.vibe} title={$t.setlists.vibeTooltip}>{localMeta.vibe ? $t.setlists.vibeOn : $t.setlists.vibeOff}</span></h1>
          <div class="meta-details">
            {#if localMeta.date}<span class="date">{formatDate(localMeta.date, $lang)}</span>{/if}
            {#if localMeta.startTime}<span class="start-time">▶ {localMeta.startTime}</span>{/if}
            <span class="count">{$t.editor.songs(songCount)} ({formatDuration(totalMinutes, $lang)})</span>
            {#if songCount > 0}<span class="ready-count">{$t.progress.readyCount(readyCount, songCount)}</span>{/if}
          </div>
        </div>
        <button class="edit-meta-btn" onclick={startEditMeta} title={$t.editor.edit}>✏️</button>
      {/if}
    </div>
    <div class="header-actions">
      <div class="break-wrap">
        <button class="btn-secondary" onclick={() => { showBreakPicker = !showBreakPicker; }}>⏸ {$t.editor.break}</button>
        {#if showBreakPicker}
          <div class="break-picker">
            {#each [5, 10, 20, 30] as min}
              <button class="break-opt" onclick={() => handleAddBreak(min)}>{$t.editor.minutes(min)}</button>
            {/each}
          </div>
        {/if}
      </div>
      <button class="btn-secondary" onclick={() => { showAddModal = true; }}>{$t.editor.addSongs}</button>
      <button class="btn-secondary" onclick={() => { showSetlistOnlyModal = true; }}>{$t.editor.addSetlistOnly}</button>
      <button class="btn-secondary" onclick={handleNewSubset}>{$t.editor.newSubset}</button>
      <a href="{base}/setlists/{setlist.id}/stage" class="btn-stage">{$t.editor.stageView}</a>
    </div>
  </div>

  <div class="filter-bar">
    <input class="filter-search" type="search" placeholder={$t.editor.search} bind:value={filterText} />
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
    >{$t.editor.notReady(songCount - readyCount)}</button>
  </div>

  <!-- Mobile filter panel (slides up above bottom bar) -->
  <div class="mobile-filter-panel" class:open={filterOpen}>
    <div class="filter-group">
      <input class="filter-search filter-search-full" type="search" placeholder={$t.editor.searchFull} bind:value={filterText} />
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
      >{$t.editor.notReady(songCount - readyCount)}</button>
    </div>
    <div class="filter-sep-h"></div>
    <div class="filter-group mob-break-group">
      <span class="mob-break-label">⏸ {$t.editor.break}:</span>
      {#each [5, 10, 20, 30] as min}
        <button class="filter-chip" onclick={() => { handleAddBreak(min); filterOpen = false; }}>{$t.editor.minutes(min)}</button>
      {/each}
    </div>
  </div>

  <!-- Mobile bottom bar -->
  <div class="mobile-bottom-bar">
    <button
      class="bottom-btn"
      class:active={filterOpen || isFiltered}
      onclick={() => { filterOpen = !filterOpen; }}
    >🎛️ {$t.editor.filter}</button>
    <a href="{base}/setlists/{setlist.id}/stage" class="bottom-btn bottom-stage">{$t.editor.stageView}</a>
    <button class="bottom-subset" onclick={handleNewSubset} title={$t.editor.newSubset}>⏭</button>
    <button class="bottom-add-btn" onclick={() => { showAddModal = true; }}>{$t.editor.add}</button>
  </div>

  {#if sortedEntries.length === 0}
    <div class="empty">
      <p>{$t.editor.empty}</p>
      <button class="btn-primary" onclick={() => { showAddModal = true; }}>{$t.editor.addSongsBtn}</button>
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="table-wrap"
      bind:this={tableWrapEl}
      ondragover={(e) => {
        if (draggedEntryKey !== null || draggedSubsetId !== null) {
          e.preventDefault();
          updateDragAutoScroll(e.clientX, e.clientY);
        }
      }}
      ondragleave={(e) => {
        if (!tableWrapEl?.contains(e.relatedTarget as Node | null)) stopDragAutoScroll();
      }}
    >
      <table>
        <thead>
          <tr>
            <th class="th-drag"></th>
            <th class="th-num">#</th>
            {#if localMeta.startTime}<th class="th-time">⏱</th>{/if}
            <th class="th-song">{$t.editor.songColumn}</th>
            {#each allMusicians as name, i}
              <th class="th-musician progress-delim" class:musician-alt={i % 2 === 0}>{name}</th>
            {/each}
            <th class="th-actions"></th>
          </tr>
        </thead>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <tbody
          ondragover={(e) => {
            if (draggedEntryKey !== null || draggedSubsetId !== null) {
              e.preventDefault();
              updateDropTargetAtPoint(e.clientX, e.clientY);
              updateDragAutoScroll(e.clientX, e.clientY);
            }
          }}
          ondrop={(e) => { e.preventDefault(); void dropAtCurrentTarget(); }}
        >
          {#each renderItems() as item (renderItemKey(item))}
            {#if item.kind === 'header'}
              <tr
                class="subset-header"
                class:active={activeSubsetId === item.subset.id}
                class:dragging={draggedSubsetId === item.subset.id}
                class:drag-over={overSubsetId === item.subset.id && draggedSubsetId !== item.subset.id}
                draggable={!isFiltered && activeSubsetId !== item.subset.id}
                data-subset-block-id={item.subset.id}
                onclick={() => handleSubsetHeaderClick(item.subset)}
                ondragstart={(e) => onSubsetDragStart(e, item.subset.id)}
                ondragover={(e) => onSubsetDragOver(e, item.subset.id)}
                ondragend={clearSubsetDrag}
              >
                <td colspan={totalCols}>
                  <div class="subset-header-inner">
                    <span class="subset-drag desktop-only">⠿</span>
                    {#if activeSubsetId === item.subset.id}
                      <input
                        class="subset-name-input"
                        bind:value={draftSubsetName}
                        required
                        aria-label={$t.editor.subsetEdit}
                        aria-invalid={!draftSubsetName.trim()}
                        onclick={(e) => e.stopPropagation()}
                        onkeydown={(e) => { if (e.key === 'Enter') finishSubsetEdit(); }}
                      />
                    {:else}
                      <span class="subset-header-name">⏭ {item.subset.name}</span>
                    {/if}
                    <span class="subset-header-count">{$t.editor.subsetSongs(entriesInSubset(item.subset.id))}</span>
                    <span class="subset-mobile-hint">{$t.editor.subsetTapEdit}</span>
                    {#if activeSubsetId !== item.subset.id}
                      <button class="subset-edit desktop-only" onclick={(e) => { e.stopPropagation(); openSubsetEdit(item.subset); }} title={$t.editor.subsetEdit}>✏️</button>
                    {/if}
                  </div>
                </td>
              </tr>
            {:else if item.kind === 'hint'}
              <tr class="subset-hint-row">
                <td colspan={totalCols}>
                  <div class="subset-hint-inner">
                    <span class="subset-hint-text">{$t.editor.subsetHint}</span>
                    <div class="subset-mobile-order">
                      <button onclick={() => moveSubsetBy(item.subset.id, -1)} disabled={subsetPosition(item.subset.id) <= 0}>{$t.editor.subsetUp}</button>
                      <button onclick={() => moveSubsetBy(item.subset.id, 1)} disabled={subsetPosition(item.subset.id) >= subsetTotal() - 1}>{$t.editor.subsetDown}</button>
                    </div>
                    <button class="subset-dissolve" onclick={() => dissolveSubset(item.subset.id)}>{$t.editor.subsetDissolve}</button>
                    <button class="subset-done-btn" onclick={finishSubsetEdit} disabled={!draftSubsetName.trim()}>{$t.editor.subsetDone}</button>
                  </div>
                </td>
              </tr>
            {:else if item.kind === 'divider'}
              <tr class="subset-rest-divider"><td colspan={totalCols}>{$t.editor.subsetRest}</td></tr>
            {:else}
              {@const entry = item.entry}
              {@const key = entryKey(entry)}
              {@const entryIndex = displayEntries().findIndex(candidate => entryKey(candidate) === key)}
              {@const isDragging = draggedEntryKey === key}
              {@const isOver = overEntryKey === key && draggedEntryKey !== key}
              {@const songNum = displayEntries().slice(0, entryIndex + 1).filter(e => e.songId).length}
              {@const canDrag = !isFiltered}
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
                    class:subset-block-dragging={draggedSubsetId !== null && entry.subsetId === draggedSubsetId}
                    class:subset-block-over={draggedSubsetId !== null && overSubsetId === entry.subsetId && draggedSubsetId !== entry.subsetId}
                    draggable={canDrag}
                    data-row-key={key}
                    data-subset-block-id={entry.subsetId}
                    onclick={(e) => handleRowClick(e, entry)}
                    ondragstart={canDrag ? (ev) => { if ((ev.target as HTMLElement).closest('input,textarea')) { ev.preventDefault(); return; } onEntryDragStart(key); } : undefined}
                    ondragover={canDrag ? (e => onEntryDragOver(e, key)) : undefined}
                    ondragend={canDrag ? clearEntryDrag : undefined}
                  >
                    <td class="td-drag" ontouchstart={(e) => handleDragHandleTouchStart(e, key)}>
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
                        {#if song.lyrics}<button class="lyrics-btn-inline" onclick={(e) => { e.stopPropagation(); lyricsViewEntry = entry; }} title={$t.common.lyrics}>📝</button>{/if}
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
                      <button class="edit-btn" onclick={() => { editingEntry = entry; }} ontouchstart={(e) => e.stopPropagation()} ontouchend={(e) => { e.stopPropagation(); e.preventDefault(); editingEntry = entry; }} title={$t.editor.editEntry}>✏️</button>
                      <button class="remove-btn desktop-only" onclick={() => handleRemoveClick(entry)} title={activeSubsetId !== null && entry.subsetId === activeSubsetId ? $t.editor.subsetRemove : $t.editor.remove}>✕</button>
                    </td>
                  </tr>
                {/if}
              {:else}
                <tr
                  class="break-row"
                  class:dragging={isDragging}
                  class:drag-over={isOver}
                  draggable={canDrag}
                  data-row-key={key}
                  ondragstart={canDrag ? (() => onEntryDragStart(key)) : undefined}
                  ondragover={canDrag ? (e => onEntryDragOver(e, key)) : undefined}
                  ondragend={canDrag ? clearEntryDrag : undefined}
                >
                  <td class="td-drag" ontouchstart={(e) => handleDragHandleTouchStart(e, key)}><span class="drag-handle">⠿</span></td>
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
                            >{$t.editor.minutes(min)}</button>
                          {/each}
                          <button class="break-opt-cancel" onclick={(e) => { e.stopPropagation(); editingBreakOrder = null; }}>✕</button>
                        </div>
                      {:else}
                        <button class="break-label" onclick={(e) => { e.stopPropagation(); editingBreakOrder = entry.order; }}>
                          {$t.editor.breakLabel(entry.breakMinutes!)}
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
          {#if draggedEntryKey !== null}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <tr
              class="drop-end-row"
              class:drop-end-active={overEntryKey === 'end'}
              ondragover={e => { e.preventDefault(); overEntryKey = 'end'; }}
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
    onaddnew={() => { showAddModal = false; showSetlistOnlyModal = true; }}
  />
{/if}

{#if showSetlistOnlyModal}
  <SongEditModal
    song={null}
    {musicians}
    mode="setlist-only"
    onclose={() => { showSetlistOnlyModal = false; }}
    onsave={handleAddSetlistOnly}
  />
{/if}

{#if lyricsViewEntry?.song}
  <LyricsOverlay
    song={lyricsViewEntry.song}
    onclose={() => { lyricsViewEntry = null; }}
    onsongupdate={(updated) => {
      if (lyricsViewEntry) lyricsViewEntry = { ...lyricsViewEntry, song: updated };
    }}
    onsavetranspose={lyricsViewEntry.setlistOnly
      ? (song) => saveSetlistOnlyTranspose(lyricsViewEntry!, song)
      : undefined}
  />
{/if}

{#if editingEntry}
  <SongEditModal
    song={editingEntry.song ? { ...editingEntry.song, comment: editingEntry.comment ?? '' } : null}
    {musicians}
    mode={editingEntry.setlistOnly ? 'setlist-only' : 'entry'}
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
  .song-row.subset-block-dragging td { opacity: 0.35; }
  .song-row.subset-block-over td { background: rgba(124, 58, 237, 0.12); }

  .break-row { cursor: grab; user-select: none; }
  .break-row td { background: rgba(59, 130, 246, 0.09); border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border); }
  .break-row td:first-child { border-left: 1px dashed var(--border); }
  .break-row td:last-child { border-right: 1px dashed var(--border); }
  .break-row:hover td { border-color: var(--accent); }
  .break-row.dragging td { opacity: 0.35; }
  .break-row.drag-over td { outline: 2px dashed var(--accent); outline-offset: -1px; }

  .drop-end-row td { height: 28px; border-radius: 8px; }
  .drop-end-active td { outline: 2px dashed var(--accent); }

  .subset-header { cursor: grab; user-select: none; }
  .subset-header td {
    background: rgba(124, 58, 237, 0.12);
    border-top: 2px solid #7c3aed;
    padding: 0;
    width: 100%;
  }
  .subset-header-inner {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 10px; font-size: 0.86rem;
  }
  .subset-header:hover td { background: rgba(124, 58, 237, 0.18); }
  .subset-header.active td { background: rgba(124, 58, 237, 0.24); }
  .subset-header.dragging td { opacity: 0.4; }
  .subset-header.drag-over td { outline: 2px dashed #7c3aed; outline-offset: -2px; }
  .subset-drag { color: #7c3aed; opacity: 0.55; font-size: 1rem; }
  .subset-header-name { font-weight: 700; color: #7c3aed; }
  .subset-header-count { color: var(--text-muted); font-size: 0.8rem; }
  .subset-mobile-hint { display: none; color: var(--text-muted); font-size: 0.76rem; }
  .subset-name-input {
    min-width: 180px; padding: 4px 8px; border: 1px solid #7c3aed; border-radius: 5px;
    background: var(--surface); color: var(--text); font-size: 0.86rem; font-weight: 700;
  }
  .subset-name-input[aria-invalid="true"] { border-color: #ef4444; }
  .subset-edit {
    margin-left: auto; background: none; border: none; cursor: pointer;
    font-size: 0.88rem; padding: 2px 6px; opacity: 0.6;
  }
  .subset-edit:hover { opacity: 1; }
  .subset-dissolve {
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); font-size: 0.82rem; padding: 4px 8px; border-radius: 4px;
  }
  .subset-dissolve:hover { color: #ef4444; }

  .subset-hint-row td { background: rgba(124, 58, 237, 0.06); padding: 0; width: 100%; }
  .subset-hint-inner {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 10px; font-size: 0.8rem; color: var(--text-muted);
  }
  .subset-hint-text { flex: 1; }
  .subset-done-btn {
    padding: 4px 14px; border: 1px solid #7c3aed; border-radius: 14px;
    background: #7c3aed; color: #fff; cursor: pointer; font-size: 0.8rem; font-weight: 600;
  }
  .subset-done-btn:disabled { opacity: 0.4; cursor: default; }
  .subset-mobile-order { display: none; gap: 6px; }
  .subset-mobile-order button {
    padding: 4px 10px; border: 1px solid var(--border); border-radius: 12px;
    background: transparent; color: var(--text); font-size: 0.78rem;
  }
  .subset-mobile-order button:disabled { opacity: 0.35; }

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
    .subset-header { cursor: pointer; }
    .subset-header-inner { flex-wrap: wrap; padding: 8px 10px; }
    .subset-header-count { margin-right: auto; }
    .subset-mobile-hint { display: inline; width: 100%; padding-left: 0; }
    .subset-header.active .subset-mobile-hint { display: none; }
    .subset-name-input { flex: 1; min-width: 0; font-size: 16px; }
    .subset-hint-inner { flex-wrap: wrap; }
    .subset-hint-text { width: 100%; }
    .subset-mobile-order { display: flex; }
    .subset-dissolve { margin-left: auto; }

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
      display: flex; align-items: center; gap: 6px; padding: 0 8px;
    }
    .bottom-btn {
      padding: 10px 12px; border: 1px solid var(--border); border-radius: 20px;
      background: transparent; cursor: pointer; font-size: 0.86rem; font-weight: 500;
      color: var(--text-muted); white-space: nowrap; min-width: 0;
    }
    .bottom-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
    .bottom-stage {
      text-decoration: none; padding: 10px 12px; border: 1px solid var(--border); border-radius: 20px;
      background: transparent; font-size: 0.86rem; font-weight: 500; color: var(--text-muted);
      white-space: nowrap; min-width: 0;
    }
    .bottom-subset {
      flex-shrink: 0; width: 40px; height: 40px; padding: 0;
      border: 1px solid #7c3aed; border-radius: 50%;
      background: transparent; color: #7c3aed; font-size: 1.15rem; line-height: 1;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
    }
    .bottom-add-btn {
      margin-left: auto; flex-shrink: 0; padding: 10px 16px;
      background: var(--accent); color: #fff; border: none; border-radius: 20px;
      cursor: pointer; font-weight: 600; font-size: 0.95rem;
    }
    .mob-break-label { font-size: 0.82rem; color: var(--text-muted); align-self: center; }
    .mob-break-group { align-items: center; }
  }
</style>
