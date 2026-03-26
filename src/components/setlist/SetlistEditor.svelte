<script lang="ts">
  import { onMount } from 'svelte';
  import type { Setlist, Song, Instrument, SetlistEntry, BandMusician, LearningStage } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import AddSongsModal from './AddSongsModal.svelte';
  import SongEditModal from '$components/backlog/SongEditModal.svelte';
  import { getSetlist, updateSetlist, addSongsToSetlist, removeSongFromSetlist, reorderEntries, addBreakToSetlist, removeBreakFromSetlist, updateBreak, updateEntryComment, updateEntrySong, updateEntryProgress } from '$lib/api';
  import { t } from '$lib/i18n';
  import { startPolling } from '$lib/poller';
  import { formatDuration, addMinutes, sortInstruments, songReadiness } from '$lib/utils';
  import CommentInput from './CommentInput.svelte';
  import { base } from '$app/paths';

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };

  const STAGE_ORDER_ARR: LearningStage[] = ['nothing', 'queue', 'structure', 'mastering', 'ready'];
  const STAGE_COLOR: Record<LearningStage, string> = {
    nothing: '#94a3b8', queue: '#cbd5e1', structure: '#f59e0b', mastering: '#3b82f6', ready: '#22c55e'
  };
  const READINESS_COLOR: Record<LearningStage, string> = {
    nothing: '#ef4444', queue: '#cbd5e1', structure: '#f59e0b', mastering: '#3b82f6', ready: '#22c55e'
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

  // Editable meta (name / date / startTime)
  let editingMeta = $state(false);
  let draftMeta = $state({ name: setlist.name, date: setlist.date ?? '', startTime: setlist.startTime ?? '' });
  let localMeta = $state({ name: setlist.name, date: setlist.date ?? '', startTime: setlist.startTime ?? '' });
  $effect(() => {
    if (!editingMeta) {
      localMeta = { name: setlist.name, date: setlist.date ?? '', startTime: setlist.startTime ?? '' };
    }
  });

  async function saveMeta() {
    const updated = await updateSetlist({ ...setlist, ...draftMeta, entries: localEntries });
    localMeta = { name: updated.name, date: updated.date ?? '', startTime: updated.startTime ?? '' };
    editingMeta = false;
  }

  function startEditMeta() {
    draftMeta = { ...localMeta };
    editingMeta = true;
  }

  let localEntries = $state([...setlist.entries]);
  $effect(() => { localEntries = [...setlist.entries]; });

  let showAddModal = $state(false);
  let showBreakPicker = $state(false);
  let editingBreakOrder = $state<number | null>(null);
  let dragIndex = $state<number | null>(null);
  let overIndex = $state<number | null>(null);
  let editingEntry = $state<SetlistEntry | null>(null);
  let selectedMusicians = $state(new Set<string>());

  function toggleMusician(name: string) {
    const next = new Set(selectedMusicians);
    next.has(name) ? next.delete(name) : next.add(name);
    selectedMusicians = next;
  }

  // Full replace after own mutations — always authoritative
  function applyUpdate(updated: Setlist) {
    localEntries = [...updated.entries];
  }

  // Smart merge for poll updates — preserve drag state
  function applyPoll(incoming: SetlistEntry[]) {
    const sorted = [...incoming].sort((a, b) => a.order - b.order);
    const localSorted = [...localEntries].sort((a, b) => a.order - b.order);

    if (JSON.stringify(sorted) === JSON.stringify(localSorted)) return;

    if (dragIndex !== null) {
      localEntries = localEntries.map(e => {
        const fresh = incoming.find(i => i.order === e.order);
        return fresh ?? e;
      });
    } else {
      localEntries = incoming;
    }
  }

  onMount(() => startPolling(
    async () => { const s = await getSetlist(setlist.id); if (s) applyPoll(s.entries); },
    3000,
    () => false,
  ));

  // songMap kept for AddSongsModal deduplication (existingIds)
  let songMap = $derived(new Map(allSongs.map(s => [s.id, s])));
  let sortedEntries = $derived([...localEntries].sort((a, b) => a.order - b.order));
  let existingIds = $derived(new Set(localEntries.map(e => e.songId).filter((id): id is string => !!id)));

  let filteredEntries = $derived(() => {
    if (selectedMusicians.size === 0) return sortedEntries;
    return sortedEntries.filter(e => {
      if (!e.song) return false; // hide breaks when filter active
      for (const m of selectedMusicians) {
        const role = e.song.musicians[m];
        if (!role || role.instruments.length === 0) return false;
      }
      return true;
    });
  });

  let isFiltered = $derived(selectedMusicians.size > 0);

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
  let totalMinutes = $derived(songCount * 5 + sortedEntries.reduce((s, e) => s + (e.breakMinutes ?? 0), 0));

  const STAGE_IDX: Record<LearningStage, number> = { nothing: 0, queue: 0, structure: 1, mastering: 2, ready: 3 };

  let readyCount = $derived(
    sortedEntries.filter(e =>
      e.song && songReadiness(e.song.musicians, e.progress ?? {}, new Set()) === 'ready'
    ).length
  );

  function entryProgressPct(entry: SetlistEntry): number {
    if (!entry.song) return 0;
    const participating = Object.entries(entry.song.musicians).filter(([, r]) => r.instruments.length > 0);
    if (!participating.length) return 100;
    const max = participating.length * 3;
    const total = participating.reduce((s, [name]) => s + STAGE_IDX[(entry.progress?.[name] ?? 'nothing') as LearningStage], 0);
    return Math.round(total / max * 100);
  }

  // Per-entry start times, keyed by entryKey. Only computed when startTime is set.
  let entryTimes = $derived((): Map<string, string> => {
    if (!localMeta.startTime) return new Map();
    const map = new Map<string, string>();
    let offset = 0;
    for (const entry of sortedEntries) {
      map.set(entryKey(entry), addMinutes(localMeta.startTime, offset));
      offset += entry.breakMinutes ?? 5;
    }
    return map;
  });

  // total columns: drag + num + (time?) + cat + song + musicians + actions
  let totalCols = $derived(allMusicians.length + 5 + (localMeta.startTime ? 1 : 0));

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
    let updated = await updateEntrySong(setlist.id, editingEntry.order, updatedSong);
    updated = await updateEntryComment(setlist.id, editingEntry.order, updatedSong.comment ?? '');
    applyUpdate(updated);
    editingEntry = null;
  }

  async function cycleProgress(entry: SetlistEntry, name: string, cur: LearningStage) {
    const next = STAGE_ORDER_ARR[(STAGE_ORDER_ARR.indexOf(cur) + 1) % STAGE_ORDER_ARR.length];
    // Optimistic update
    localEntries = localEntries.map(e =>
      e.order !== entry.order ? e : {
        ...e, progress: { ...(e.progress ?? {}), [name]: next }
      }
    );
    const updated = await updateEntryProgress(
      setlist.id, entry.order, name, next,
      entry.songId!, permanentNamesSet.has(name)
    );
    applyUpdate(updated);
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
    list.splice(overIndex, 0, item);
    const reordered = list.map((e, i) => ({ ...e, order: i }));
    dragIndex = null; overIndex = null;
    applyUpdate(await reorderEntries(setlist.id, reordered));
  }

  function onDragEnd() { dragIndex = null; overIndex = null; }

  function guestTagsFor(song: Song): { name: string; icons: string }[] {
    const permSet = new Set(allMusicians);
    return Object.entries(song.musicians)
      .filter(([name, role]) => !permSet.has(name) && role.instruments.length > 0)
      .map(([name, role]) => ({ name, icons: sortInstruments(role.instruments).map(i => instrumentIcons[i]).join('') }));
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
          <button class="btn-primary" onclick={saveMeta}>Сохранить</button>
          <button class="btn-secondary" onclick={() => { editingMeta = false; }}>Отмена</button>
        </div>
      {:else}
        <div class="meta-view">
          <h1>{localMeta.name}</h1>
          <div class="meta-details">
            {#if localMeta.date}<span class="date">{localMeta.date}</span>{/if}
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
            {#each [10, 20, 30] as min}
              <button class="break-opt" onclick={() => handleAddBreak(min)}>{min} мин</button>
            {/each}
          </div>
        {/if}
      </div>
      <button class="btn-secondary" onclick={() => { showAddModal = true; }}>{$t.editor.addSongs}</button>
      <a href="{base}/setlists/{setlist.id}/stage" class="btn-stage">{$t.editor.stageView}</a>
    </div>
  </div>

  {#if allMusicians.length > 0}
    <div class="filter-bar">
      {#each allMusicians as name}
        <button
          class="filter-chip"
          class:active={selectedMusicians.has(name)}
          onclick={() => toggleMusician(name)}
        >{name}</button>
      {/each}
    </div>
  {/if}

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
            <th class="th-cat"></th>
            <th class="th-song">Песня</th>
            {#each allMusicians as name, i}
              <th class="th-musician" class:musician-alt={i % 2 === 0}>{name}</th>
            {/each}
            <th class="th-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each displayEntries() as entry, i (entryKey(entry))}
            {@const isDragging = dragIndex !== null && entryKey(sortedEntries[dragIndex]) === entryKey(entry)}
            {@const isOver = overIndex === i && dragIndex !== null && dragIndex !== i}
            {#if entry.songId}
              {@const song = entry.song}
              {#if song}
                {@const guestTags = guestTagsFor(song)}
                {@const readiness = songReadiness(song.musicians, entry.progress ?? {}, selectedMusicians)}
                <tr
                  class="song-row"
                  class:dragging={isDragging}
                  class:drag-over={isOver}
                  draggable={!isFiltered}
                  ondragstart={!isFiltered ? () => onDragStart(sortedEntries.findIndex(e => entryKey(e) === entryKey(entry))) : undefined}
                  ondragover={!isFiltered ? (e => onDragOver(e, i)) : undefined}
                  ondrop={!isFiltered ? onDrop : undefined}
                  ondragend={!isFiltered ? onDragEnd : undefined}
                >
                  <td class="td-drag"><span class="drag-handle">⠿</span></td>
                  <td class="td-num">
                    <span class="readiness-dot" style="background: {READINESS_COLOR[readiness]}" title={$t.progress[readiness]}></span>
                    {i + 1}
                    <span class="entry-pct">{entryProgressPct(entry)}%</span>
                  </td>
                  {#if localMeta.startTime}<td class="td-time">{entryTimes().get(entryKey(entry)) ?? ''}</td>{/if}
                  <td class="td-cat"><CategoryBadge category={song.category} iconOnly /></td>
                  <td class="td-song">
                    <div class="song-name">
                      <span class="artist">{song.artist}</span>
                      <span class="sep">–</span>
                      <span class="title">{song.title}</span>
                      {#each guestTags as g}
                        <span class="guest-tag">{g.icons} {g.name}</span>
                      {/each}
                    </div>
                    <CommentInput
                      value={entry.comment ?? ''}
                      onsave={(v) => updateEntryComment(setlist.id, entry.order, v).then(applyUpdate)}
                    />
                  </td>
                  {#each allMusicians as name, i}
                    {@const role = song.musicians[name]}
                    {@const prog = (entry.progress?.[name] ?? 'nothing') as LearningStage}
                    <td class="td-musician" class:musician-alt={i % 2 === 0}>
                      <button
                        class="prog-dot"
                        style="background: {STAGE_COLOR[prog]}"
                        onclick={() => cycleProgress(entry, name, prog)}
                        title={$t.progress[prog]}
                      ></button>
                      {#if role?.instruments?.length}
                        <span class="inst-slot">{sortInstruments(role.instruments).map(i => instrumentIcons[i]).join('')}</span>
                      {/if}
                    </td>
                  {/each}
                  <td class="td-actions">
                    <button class="edit-btn" onclick={() => { editingEntry = entry; }} title="Редактировать в сетлисте">✏️</button>
                    <button class="remove-btn" onclick={() => handleRemove(entry.songId!)} title={$t.editor.remove}>✕</button>
                  </td>
                </tr>
              {/if}
            {:else}
              <tr
                class="break-row"
                class:dragging={isDragging}
                class:drag-over={isOver}
                draggable="true"
                ondragstart={() => onDragStart(sortedEntries.findIndex(e => entryKey(e) === entryKey(entry)))}
                ondragover={e => onDragOver(e, i)}
                ondrop={onDrop}
                ondragend={onDragEnd}
              >
                <td class="td-drag"><span class="drag-handle">⠿</span></td>
                <td class="td-num"></td>
                {#if localMeta.startTime}<td class="td-time">{entryTimes().get(entryKey(entry)) ?? ''}</td>{/if}
                <td colspan={totalCols - 3 - (localMeta.startTime ? 1 : 0)} class="td-break">
                  <span class="break-icon">⏸</span>
                  {#if editingBreakOrder === entry.order}
                    {#each [10, 20, 30] as min}
                      <button
                        class="break-opt"
                        class:break-opt-active={entry.breakMinutes === min}
                        onclick={(e) => { e.stopPropagation(); handleUpdateBreak(entry.order, min); }}
                      >{min} мин</button>
                    {/each}
                    <button class="break-opt-cancel" onclick={(e) => { e.stopPropagation(); editingBreakOrder = null; }}>✕</button>
                  {:else}
                    <button class="break-label" onclick={(e) => { e.stopPropagation(); editingBreakOrder = entry.order; }}>
                      Перерыв — {entry.breakMinutes} мин
                    </button>
                  {/if}
                </td>
                <td class="td-actions">
                  <button class="remove-btn" onclick={() => handleRemoveBreak(entry.order)}>✕</button>
                </td>
              </tr>
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

{#if editingEntry}
  <SongEditModal
    song={editingEntry.song ? { ...editingEntry.song, comment: editingEntry.comment ?? '' } : null}
    {musicians}
    mode="entry"
    onclose={() => { editingEntry = null; }}
    onsave={handleEntrySave}
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
  .ready-count { font-size: 0.82rem; font-weight: 600; color: #22c55e; }
  .edit-meta-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; opacity: 0.5; padding: 4px; margin-top: 2px; }
  .edit-meta-btn:hover { opacity: 1; }
  .meta-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .meta-input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 0.9rem; }
  .meta-name { font-size: 1rem; font-weight: 600; min-width: 200px; }
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

  .break-wrap { position: relative; }
  .break-picker {
    position: absolute; top: calc(100% + 4px); left: 0;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    display: flex; flex-direction: column; overflow: hidden; z-index: 10; min-width: 100px;
  }
  .break-opt { padding: 8px 16px; background: transparent; border: none; cursor: pointer; text-align: left; font-size: 0.88rem; color: var(--text); }
  .break-opt:hover { background: var(--row-hover); }

  .table-wrap { overflow: auto; flex: 1; padding: 0 16px 16px; }
  table { width: 100%; border-collapse: separate; border-spacing: 0 3px; }

  thead th {
    padding: 4px 8px; font-size: 0.72rem; font-weight: 700;
    color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;
    text-align: left; white-space: nowrap;
    position: sticky; top: 0; z-index: 2;
    background: var(--bg); box-shadow: 0 2px 0 var(--border);
  }
  .th-num, .td-num { text-align: right; width: 28px; }
  .th-time, .td-time { width: 42px; font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; text-align: right; padding-right: 6px; }
  .th-cat, .td-cat { width: 32px; text-align: center; }
  .th-drag, .td-drag { width: 24px; }
  .th-musician { text-align: center; width: 6%; min-width: 52px; }
  .td-musician { text-align: left; width: 6%; min-width: 52px; }
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
  .break-row td { background: transparent; border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border); }
  .break-row td:first-child { border-left: 1px dashed var(--border); }
  .break-row td:last-child { border-right: 1px dashed var(--border); }
  .break-row:hover td { border-color: var(--accent); }
  .break-row.dragging td { opacity: 0.35; }
  .break-row.drag-over td { outline: 2px dashed var(--accent); outline-offset: -1px; }

  .drop-end-row td { height: 28px; border-radius: 8px; }
  .drop-end-active td { outline: 2px dashed var(--accent); }

  .drag-handle { color: var(--text-muted); font-size: 1rem; cursor: grab; opacity: 0.4; display: block; text-align: center; }
  .song-row:hover .drag-handle, .break-row:hover .drag-handle { opacity: 1; }

  .td-num { font-size: 0.82rem; color: var(--text-muted); white-space: nowrap; }
  .entry-pct { display: block; font-size: 0.68rem; color: var(--text-muted); opacity: 0.7; text-align: right; }
  .readiness-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    margin-right: 2px; vertical-align: middle;
  }

  .td-song { white-space: nowrap; }
  .song-name { display: flex; align-items: center; }
  .artist { font-weight: 400; font-size: 0.9rem; }
  .sep { color: var(--text-muted); margin: 0 4px; }
  .title { font-size: 0.9rem; font-weight: 600; }
  .song-row:hover :global(.comment-input::placeholder) { opacity: 0.5; }
  .song-row:hover :global(.comment-input) { border-bottom-color: var(--border); }

  .guest-tag {
    display: inline-block;
    background: var(--border);
    color: var(--text-muted);
    font-size: 0.7rem;
    padding: 1px 7px;
    border-radius: 10px;
    margin-left: 5px;
    white-space: nowrap;
    vertical-align: middle;
  }

  .td-musician { font-size: 1.17rem; white-space: nowrap; }
  .inst-slot { display: inline-block; width: 1.3em; vertical-align: middle; }

  .prog-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    border: none; cursor: pointer; padding: 0; vertical-align: middle;
    margin-right: 2px; flex-shrink: 0; transition: transform 0.1s;
  }
  .prog-dot:hover { transform: scale(1.4); }

  .td-break { font-size: 0.82rem; color: var(--text-muted); }
  .break-label {
    background: none; border: none; cursor: pointer; font-size: 0.82rem;
    color: var(--text-muted); font-style: italic; padding: 0;
  }
  .break-label:hover { color: var(--accent); }
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
  .break-icon { margin-right: 4px; }

  .edit-btn { background: none; border: none; cursor: pointer; font-size: 1.17rem; padding: 2px 4px; opacity: 0.4; transition: opacity 0.12s; }
  .edit-btn:hover { opacity: 1; }

  .remove-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px 6px; font-size: 0.82rem; border-radius: 4px; }
  .remove-btn:hover { color: #ef4444; }
</style>
