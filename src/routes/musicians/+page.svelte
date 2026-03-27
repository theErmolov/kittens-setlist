<script lang="ts">
  import { onMount } from 'svelte';
  import { addMusician, updateMusician, deleteMusician, getMusicians } from '$lib/api';
  import { t } from '$lib/i18n';
  import type { BandMusician, Instrument } from '$lib/types';

  const allInstruments: Instrument[] = ['guitar', 'bass', 'drums', 'keys', 'cajon', 'violin', 'percussion', 'vocals'];
  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };

  let musicians = $state<BandMusician[]>([]);
  let editingId = $state<string | null>(null);
  let showNew = $state(false);
  let loading = $state(true);

  let draftName = $state('');
  let draftInstruments = $state<Instrument[]>([]);
  let dragIdx = $state<number | null>(null);
  let dragOverIdx = $state<number | null>(null);

  onMount(async () => {
    musicians = await getMusicians();
    loading = false;
  });

  function startAdd() {
    draftName = '';
    draftInstruments = [];
    showNew = true;
    editingId = null;
  }

  function startEdit(m: BandMusician) {
    draftName = m.name;
    draftInstruments = [...(m.defaultInstruments ?? [])];
    editingId = m.id;
    showNew = false;
  }

  function cancelEdit() {
    editingId = null;
    showNew = false;
  }

  function toggleDraftInstrument(inst: Instrument) {
    const has = draftInstruments.includes(inst);
    draftInstruments = has ? draftInstruments.filter(i => i !== inst) : [...draftInstruments, inst];
  }

  async function handleAdd() {
    if (!draftName.trim()) return;
    const m = await addMusician({ name: draftName.trim(), defaultInstruments: draftInstruments, sortOrder: musicians.length });
    musicians = [...musicians, m];
    showNew = false;
  }

  async function handleSave(m: BandMusician) {
    if (!draftName.trim()) return;
    const updated = await updateMusician({ ...m, name: draftName.trim(), defaultInstruments: draftInstruments });
    musicians = musicians.map(x => x.id === updated.id ? updated : x);
    editingId = null;
  }

  async function handleDelete(id: string) {
    if (!confirm($t.musicians.deleteConfirm)) return;
    await deleteMusician(id);
    musicians = musicians.filter(m => m.id !== id);
  }

  function onDragStart(idx: number) {
    dragIdx = idx;
  }

  function onDragOver(e: DragEvent, idx: number) {
    e.preventDefault();
    dragOverIdx = idx;
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      dragIdx = null;
      dragOverIdx = null;
      return;
    }
    const reordered = [...musicians];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dragOverIdx, 0, moved);
    // Assign new sortOrders and persist changed items
    const updated = reordered.map((m, i) => ({ ...m, sortOrder: i }));
    musicians = updated;
    dragIdx = null;
    dragOverIdx = null;
    await Promise.all(updated.map(m => updateMusician(m)));
  }

  function onDragEnd() {
    dragIdx = null;
    dragOverIdx = null;
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>{$t.musicians.title}</h1>
    <button class="btn-primary" onclick={startAdd}>{$t.musicians.addBtn}</button>
  </div>

  {#if showNew}
    <div class="edit-form">
      <input bind:value={draftName} placeholder={$t.musicians.name} />
      <div class="inst-row">
        {#each allInstruments as inst}
          <button
            class="inst-btn"
            class:active={draftInstruments.includes(inst)}
            onclick={() => toggleDraftInstrument(inst)}
            title={$t.instrument[inst]}
          >{instrumentIcons[inst]}</button>
        {/each}
      </div>
      <div class="form-actions">
        <button class="btn-secondary" onclick={cancelEdit}>{$t.musicians.cancel}</button>
        <button class="btn-primary" onclick={handleAdd}>{$t.musicians.save}</button>
      </div>
    </div>
  {/if}

  {#if loading}
    <p class="loading">…</p>
  {:else if musicians.length === 0 && !showNew}
    <p class="empty">{$t.musicians.empty}</p>
  {:else}
    <ul class="musician-list">
      {#each musicians as m, i (m.id)}
        <li
          class="musician-item"
          class:drag-over={dragOverIdx === i && dragIdx !== i}
          draggable="true"
          ondragstart={() => onDragStart(i)}
          ondragover={(e) => onDragOver(e, i)}
          ondrop={onDrop}
          ondragend={onDragEnd}
        >
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          {#if editingId === m.id}
            <div class="edit-form inline">
              <input bind:value={draftName} />
              <div class="inst-row">
                {#each allInstruments as inst}
                  <button
                    class="inst-btn"
                    class:active={draftInstruments.includes(inst)}
                    onclick={() => toggleDraftInstrument(inst)}
                    title={$t.instrument[inst]}
                  >{instrumentIcons[inst]}</button>
                {/each}
              </div>
              <div class="form-actions">
                <button class="btn-secondary" onclick={cancelEdit}>{$t.musicians.cancel}</button>
                <button class="btn-primary" onclick={() => handleSave(m)}>{$t.musicians.save}</button>
              </div>
            </div>
          {:else}
            <div class="musician-info">
              <span class="mname">{m.name}</span>
              <span class="minstruments">
                {#if m.defaultInstruments?.length}
                  {#each m.defaultInstruments as inst}
                    <span class="inst-badge" title={$t.instrument[inst]}>{instrumentIcons[inst]}</span>
                  {/each}
                {:else}
                  <span class="free-badge">{$t.musicians.free}</span>
                {/if}
              </span>
            </div>
            <div class="item-actions">
              <button class="edit-btn" onclick={() => startEdit(m)}>✏️</button>
              <button class="del-btn" onclick={() => handleDelete(m.id)}>🗑</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .page { padding: 20px 16px; max-width: 520px; margin: 0 auto; }
  .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .page-header h1 { font-size: 1.4rem; }

  .edit-form {
    display: flex; flex-direction: column; gap: 10px;
    padding: 14px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 10px; margin-bottom: 16px;
  }
  .edit-form.inline { margin: 0; border: none; padding: 4px 0; background: transparent; flex: 1; }

  .edit-form input:not([type="checkbox"]) {
    padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px;
    background: var(--bg); color: var(--text); font-size: 0.9rem;
  }

  .inst-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .inst-btn {
    width: 36px; height: 36px; font-size: 1rem;
    border: 1px solid var(--border); border-radius: 8px;
    background: transparent; cursor: pointer; transition: all 0.12s;
  }
  .inst-btn:hover { border-color: var(--accent); }
  .inst-btn.active { background: var(--accent); border-color: var(--accent); }

  .guest-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.85rem; color: var(--text-muted); cursor: pointer; user-select: none;
  }

  .form-actions { display: flex; gap: 8px; }
  .btn-primary { padding: 7px 18px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.88rem; }
  .btn-secondary { padding: 7px 18px; border: 1px solid var(--border); background: transparent; border-radius: 6px; cursor: pointer; color: var(--text); font-size: 0.88rem; }

  .musician-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .musician-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; border: 1px solid var(--border);
    border-radius: 10px; background: var(--surface);
    cursor: grab; transition: border-color 0.12s, opacity 0.12s;
  }
  .musician-item.is-guest { opacity: 0.75; }
  .musician-item.drag-over { border-color: var(--accent); }

  .drag-handle {
    color: var(--text-muted); font-size: 1.1rem; cursor: grab;
    flex-shrink: 0; user-select: none; opacity: 0.5;
  }
  .musician-item:hover .drag-handle { opacity: 1; }

  .musician-info { display: flex; align-items: center; gap: 10px; flex: 1; }
  .mname { font-weight: 600; font-size: 1rem; min-width: 80px; }
  .guest-badge {
    font-size: 0.7rem; color: var(--text-muted); border: 1px solid var(--border);
    border-radius: 10px; padding: 1px 7px; font-style: italic;
  }
  .minstruments { display: flex; gap: 4px; flex-wrap: wrap; }
  .inst-badge { font-size: 1.1rem; }
  .free-badge { font-size: 0.8rem; color: var(--text-muted); font-style: italic; }

  .item-actions { display: flex; gap: 4px; }
  .edit-btn, .del-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; padding: 4px 6px; border-radius: 4px; opacity: 0.6; transition: opacity 0.12s; }
  .edit-btn:hover, .del-btn:hover { opacity: 1; }
  .del-btn:hover { color: #ef4444; }

  .empty, .loading { text-align: center; padding: 40px; color: var(--text-muted); }
</style>
