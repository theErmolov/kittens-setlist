<script lang="ts">
  import { addMusician, updateMusician, deleteMusician } from '$lib/api';
  import { t } from '$lib/i18n';
  import type { BandMusician, Instrument } from '$lib/types';

  let { musicians = $bindable(), onchange }: { musicians: BandMusician[]; onchange?: () => void | Promise<void> } = $props();

  const allInstruments: Instrument[] = ['guitar', 'bass', 'drums', 'keys', 'cajon', 'violin', 'percussion', 'vocals'];
  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };

  let editingId = $state<string | null>(null);
  let showNew = $state(false);
  let draftName = $state('');
  let draftInstruments = $state<Instrument[]>([]);
  let dragIdx = $state<number | null>(null);
  let dragOverIdx = $state<number | null>(null);
  let canDrag = $state(false);

  $effect(() => {
    canDrag = typeof window !== 'undefined' && !('ontouchstart' in window);
  });

  function startAdd() {
    draftName = '';
    draftInstruments = [];
    showNew = true;
    editingId = null;
  }

  function startEdit(musician: BandMusician) {
    draftName = musician.name;
    draftInstruments = [...(musician.defaultInstruments ?? [])];
    editingId = musician.id;
    showNew = false;
  }

  function cancelEdit() {
    editingId = null;
    showNew = false;
  }

  function toggleDraftInstrument(instrument: Instrument) {
    draftInstruments = draftInstruments.includes(instrument)
      ? draftInstruments.filter(item => item !== instrument)
      : [...draftInstruments, instrument];
  }

  async function handleAdd() {
    if (!draftName.trim()) return;
    const musician = await addMusician({
      name: draftName.trim(),
      defaultInstruments: draftInstruments,
      sortOrder: musicians.length,
    });
    musicians = [...musicians, musician];
    showNew = false;
    await onchange?.();
  }

  async function handleSave(musician: BandMusician) {
    if (!draftName.trim()) return;
    const updated = await updateMusician({
      ...musician,
      name: draftName.trim(),
      defaultInstruments: draftInstruments,
    });
    musicians = musicians.map(item => item.id === updated.id ? updated : item);
    editingId = null;
    await onchange?.();
  }

  async function handleDelete(id: string) {
    if (!confirm($t.musicians.deleteConfirm)) return;
    await deleteMusician(id);
    musicians = musicians.filter(musician => musician.id !== id);
    await onchange?.();
  }

  function onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    dragOverIdx = index;
  }

  async function onDrop(event: DragEvent) {
    event.preventDefault();
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      dragIdx = null;
      dragOverIdx = null;
      return;
    }
    const reordered = [...musicians];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dragOverIdx, 0, moved);
    musicians = reordered.map((musician, index) => ({ ...musician, sortOrder: index }));
    dragIdx = null;
    dragOverIdx = null;
    await Promise.all(musicians.map(updateMusician));
    await onchange?.();
  }
</script>

<div class="roster-header">
  <h2>{$t.musicians.title}</h2>
  <button class="btn-primary" onclick={startAdd}>{$t.musicians.addBtn}</button>
</div>

{#if showNew}
  <div class="edit-form">
    <input bind:value={draftName} placeholder={$t.musicians.name} />
    <div class="inst-row">
      {#each allInstruments as instrument}
        <button class="inst-btn" class:active={draftInstruments.includes(instrument)}
          onclick={() => toggleDraftInstrument(instrument)} title={$t.instrument[instrument]}>{instrumentIcons[instrument]}</button>
      {/each}
    </div>
    <div class="form-actions">
      <button class="btn-secondary" onclick={cancelEdit}>{$t.musicians.cancel}</button>
      <button class="btn-primary" onclick={handleAdd}>{$t.musicians.save}</button>
    </div>
  </div>
{/if}

{#if musicians.length === 0 && !showNew}
  <p class="empty">{$t.musicians.empty}</p>
{:else}
  <ul class="musician-list">
    {#each musicians as musician, index (musician.id)}
      <li class="musician-item" class:drag-over={dragOverIdx === index && dragIdx !== index}
        draggable={canDrag}
        ondragstart={canDrag ? () => { dragIdx = index; } : undefined}
        ondragover={canDrag ? event => onDragOver(event, index) : undefined}
        ondrop={canDrag ? onDrop : undefined}
        ondragend={canDrag ? () => { dragIdx = null; dragOverIdx = null; } : undefined}>
        {#if canDrag}<span class="drag-handle" title="Drag to reorder">⠿</span>{/if}
        {#if editingId === musician.id}
          <div class="edit-form inline">
            <input bind:value={draftName} />
            <div class="inst-row">
              {#each allInstruments as instrument}
                <button class="inst-btn" class:active={draftInstruments.includes(instrument)}
                  onclick={() => toggleDraftInstrument(instrument)} title={$t.instrument[instrument]}>{instrumentIcons[instrument]}</button>
              {/each}
            </div>
            <div class="form-actions">
              <button class="btn-secondary" onclick={cancelEdit}>{$t.musicians.cancel}</button>
              <button class="btn-primary" onclick={() => handleSave(musician)}>{$t.musicians.save}</button>
            </div>
          </div>
        {:else}
          <div class="musician-info">
            <span class="mname">{musician.name}</span>
            <span class="minstruments">
              {#if musician.defaultInstruments?.length}
                {#each musician.defaultInstruments as instrument}
                  <span class="inst-badge" title={$t.instrument[instrument]}>{instrumentIcons[instrument]}</span>
                {/each}
              {:else}<span class="free-badge">{$t.musicians.free}</span>{/if}
            </span>
          </div>
          <div class="item-actions">
            <button class="icon-btn" onclick={() => startEdit(musician)}>✏️</button>
            <button class="icon-btn delete" onclick={() => handleDelete(musician.id)}>🗑</button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .roster-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  h2 { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
  .edit-form { display: flex; flex-direction: column; gap: 10px; padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 12px; }
  .edit-form.inline { margin: 0; border: 0; padding: 4px 0; background: transparent; flex: 1; }
  .edit-form input { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 0.9rem; }
  .inst-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .inst-btn { width: 36px; height: 36px; font-size: 1rem; border: 1px solid var(--border); border-radius: 8px; background: transparent; cursor: pointer; }
  .inst-btn.active { background: var(--accent); border-color: var(--accent); }
  .form-actions, .item-actions { display: flex; gap: 8px; }
  .btn-primary, .btn-secondary { padding: 7px 18px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.88rem; }
  .btn-primary { background: var(--accent); color: #fff; border: 0; }
  .btn-secondary { border: 1px solid var(--border); background: transparent; color: var(--text); }
  .musician-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .musician-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  .musician-item.drag-over { border-color: var(--accent); }
  .drag-handle { color: var(--text-muted); cursor: grab; opacity: 0.5; user-select: none; }
  .musician-info { display: flex; align-items: center; gap: 10px; flex: 1; }
  .mname { font-weight: 600; min-width: 80px; }
  .minstruments { display: flex; gap: 4px; flex-wrap: wrap; }
  .inst-badge { font-size: 1.1rem; }
  .free-badge, .empty { color: var(--text-muted); font-size: 0.8rem; font-style: italic; }
  .empty { padding: 20px 0; }
  .icon-btn { background: none; border: 0; cursor: pointer; padding: 4px 6px; opacity: 0.65; }
  .icon-btn:hover { opacity: 1; }
  .icon-btn.delete:hover { color: #ef4444; }
  @media (max-width: 700px) { .edit-form input { font-size: 16px; } }
</style>
