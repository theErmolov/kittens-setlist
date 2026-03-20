<script lang="ts">
  import type { Setlist, Song, Instrument } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import AddSongsModal from './AddSongsModal.svelte';
  import { addSongsToSetlist, removeSongFromSetlist, reorderEntries, addBreakToSetlist, removeBreakFromSetlist } from '$lib/api';
  import { musiciansStore } from '$lib/stores/musicians';
  import { t } from '$lib/i18n';

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', percussion: '🪘', violin: '🎻'
  };

  let allMusicians = $derived($musiciansStore.map(m => m.name));

  let {
    setlist,
    allSongs
  }: {
    setlist: Setlist;
    allSongs: Song[];
  } = $props();

  let showAddModal = $state(false);
  let showBreakPicker = $state(false);
  let dragIndex = $state<number | null>(null);
  let overIndex = $state<number | null>(null);

  let songMap = $derived(new Map(allSongs.map(s => [s.id, s])));
  let sortedEntries = $derived([...setlist.entries].sort((a, b) => a.order - b.order));
  let existingIds = $derived(new Set(setlist.entries.map(e => e.songId).filter(Boolean)));

  let displayEntries = $derived(() => {
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) return sortedEntries;
    const list = [...sortedEntries];
    const [item] = list.splice(dragIndex, 1);
    list.splice(overIndex, 0, item);
    return list;
  });

  // total columns: drag + num + cat + song + musicians + remove
  let totalCols = $derived(allMusicians.length + 5);

  async function handleAdd(ids: string[]) {
    await addSongsToSetlist(setlist.id, ids);
    showAddModal = false;
  }

  async function handleAddBreak(minutes: number) {
    await addBreakToSetlist(setlist.id, minutes);
    showBreakPicker = false;
  }

  async function handleRemove(songId: string) {
    await removeSongFromSetlist(setlist.id, songId);
  }

  async function handleRemoveBreak(order: number) {
    await removeBreakFromSetlist(setlist.id, order);
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
    await reorderEntries(setlist.id, reordered);
  }

  function onDragEnd() { dragIndex = null; overIndex = null; }
</script>

<div class="editor">
  <div class="editor-header">
    <div class="meta">
      <h1>{setlist.name}</h1>
      {#if setlist.date}<span class="date">{setlist.date}</span>{/if}
      <span class="count">{$t.editor.songs(sortedEntries.length)}</span>
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
      <a href="/setlists/{setlist.id}/stage" class="btn-stage">{$t.editor.stageView}</a>
    </div>
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
            <th class="th-cat"></th>
            <th class="th-song">Песня</th>
            {#each allMusicians as name}
              <th class="th-musician">{name}</th>
            {/each}
            <th class="th-remove"></th>
          </tr>
        </thead>
        <tbody>
          {#each displayEntries() as entry, i (entryKey(entry))}
            {@const isDragging = dragIndex !== null && entryKey(sortedEntries[dragIndex]) === entryKey(entry)}
            {@const isOver = overIndex === i && dragIndex !== null && dragIndex !== i}
            {#if entry.songId}
              {@const song = songMap.get(entry.songId)}
              {#if song}
                <tr
                  class="song-row"
                  class:dragging={isDragging}
                  class:drag-over={isOver}
                  draggable="true"
                  ondragstart={() => onDragStart(sortedEntries.findIndex(e => entryKey(e) === entryKey(entry)))}
                  ondragover={e => onDragOver(e, i)}
                  ondrop={onDrop}
                  ondragend={onDragEnd}
                >
                  <td class="td-drag"><span class="drag-handle">⠿</span></td>
                  <td class="td-num">{i + 1}</td>
                  <td class="td-cat"><CategoryBadge category={song.category} iconOnly /></td>
                  <td class="td-song">
                    <span class="artist">{song.artist}</span>
                    <span class="sep">–</span>
                    <span class="title">{song.title}</span>
                  </td>
                  {#each allMusicians as name}
                    {@const role = song.musicians[name]}
                    <td class="td-musician">
                      {#if role}
                        <span class="inst-slot">{role.instrument ? instrumentIcons[role.instrument] : ''}</span>{role.vocals ? '🎤' : ''}
                      {/if}
                    </td>
                  {/each}
                  <td class="td-remove">
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
                <td colspan={totalCols - 2} class="td-break">
                  <span class="break-icon">⏸</span>
                  Перерыв — {entry.breakMinutes} мин
                </td>
                <td class="td-remove">
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

<style>
  .editor { padding: 16px; }
  .editor-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .meta h1 { margin: 0 0 4px; font-size: 1.4rem; }
  .date, .count { font-size: 0.82rem; color: var(--text-muted); margin-right: 10px; }
  .header-actions { display: flex; gap: 8px; align-items: center; }
  .btn-secondary { padding: 8px 16px; border: 1px solid var(--border); border-radius: 6px; background: transparent; cursor: pointer; color: var(--text); font-size: 0.88rem; }
  .btn-primary { padding: 8px 16px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
  .btn-stage { padding: 8px 16px; background: var(--accent); color: #fff; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.88rem; }
  .empty { text-align: center; padding: 60px 20px; color: var(--text-muted); }
  .empty p { margin-bottom: 12px; }

  .break-wrap { position: relative; }
  .break-picker {
    position: absolute; top: calc(100% + 4px); left: 0;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    display: flex; flex-direction: column; overflow: hidden; z-index: 10; min-width: 100px;
  }
  .break-opt { padding: 8px 16px; background: transparent; border: none; cursor: pointer; text-align: left; font-size: 0.88rem; color: var(--text); }
  .break-opt:hover { background: var(--row-hover); }

  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: separate; border-spacing: 0 3px; }

  thead th {
    padding: 4px 8px; font-size: 0.72rem; font-weight: 700;
    color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;
    text-align: left; white-space: nowrap;
  }
  .th-num, .td-num { text-align: right; width: 28px; }
  .th-cat, .td-cat { width: 32px; text-align: center; }
  .th-drag, .td-drag { width: 24px; }
  .th-musician, .td-musician { text-align: center; width: 52px; }
  .th-remove, .td-remove { width: 32px; }

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

  .td-num { font-size: 0.82rem; color: var(--text-muted); }
  .td-song { white-space: nowrap; }
  .artist { font-weight: 600; font-size: 0.9rem; }
  .sep { color: var(--text-muted); margin: 0 4px; }
  .title { font-size: 0.9rem; }

  .td-musician { font-size: 1rem; white-space: nowrap; }
  .inst-slot { display: inline-block; width: 1.3em; }

  .td-break { font-size: 0.82rem; color: var(--text-muted); font-style: italic; }
  .break-icon { margin-right: 4px; }

  .remove-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px 6px; font-size: 0.82rem; border-radius: 4px; }
  .remove-btn:hover { color: #ef4444; }
</style>
