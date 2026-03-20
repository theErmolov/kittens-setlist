<script lang="ts">
  import { musiciansStore } from '$lib/stores/musicians';
  import { addMusician, updateMusician, deleteMusician } from '$lib/api';
  import { t } from '$lib/i18n';
  import type { BandMusician, Instrument } from '$lib/types';

  const allInstruments: Instrument[] = ['guitar', 'bass', 'drums', 'keys', 'percussion', 'violin'];
  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', percussion: '🪘', violin: '🎻'
  };

  let musicians = $derived($musiciansStore);
  let editingId = $state<string | null>(null);
  let showNew = $state(false);

  // draft for add/edit
  let draftName = $state('');
  let draftInstrument = $state<Instrument | undefined>(undefined);

  function startAdd() {
    draftName = '';
    draftInstrument = undefined;
    showNew = true;
    editingId = null;
  }

  function startEdit(m: BandMusician) {
    draftName = m.name;
    draftInstrument = m.defaultInstrument;
    editingId = m.id;
    showNew = false;
  }

  function cancelEdit() {
    editingId = null;
    showNew = false;
  }

  function selectDraftInstrument(inst: Instrument) {
    // clicking the active one deselects it (free); clicking another selects it
    draftInstrument = draftInstrument === inst ? undefined : inst;
  }

  async function handleAdd() {
    if (!draftName.trim()) return;
    await addMusician({ name: draftName.trim(), defaultInstrument: draftInstrument });
    showNew = false;
  }

  async function handleSave(m: BandMusician) {
    if (!draftName.trim()) return;
    await updateMusician({ ...m, name: draftName.trim(), defaultInstrument: draftInstrument });
    editingId = null;
  }

  async function handleDelete(id: string) {
    if (!confirm($t.musicians.deleteConfirm)) return;
    await deleteMusician(id);
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
            class:active={draftInstrument === inst}
            onclick={() => selectDraftInstrument(inst)}
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

  {#if musicians.length === 0 && !showNew}
    <p class="empty">{$t.musicians.empty}</p>
  {:else}
    <ul class="musician-list">
      {#each musicians as m (m.id)}
        <li class="musician-item">
          {#if editingId === m.id}
            <div class="edit-form inline">
              <input bind:value={draftName} />
              <div class="inst-row">
                {#each allInstruments as inst}
                  <button
                    class="inst-btn"
                    class:active={draftInstrument === inst}
                    onclick={() => selectDraftInstrument(inst)}
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
                {#if m.defaultInstrument}
                  <span class="inst-badge" title={$t.instrument[m.defaultInstrument]}>{instrumentIcons[m.defaultInstrument]}</span>
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

  .edit-form input {
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

  .form-actions { display: flex; gap: 8px; }
  .btn-primary { padding: 7px 18px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.88rem; }
  .btn-secondary { padding: 7px 18px; border: 1px solid var(--border); background: transparent; border-radius: 6px; cursor: pointer; color: var(--text); font-size: 0.88rem; }

  .musician-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .musician-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; border: 1px solid var(--border);
    border-radius: 10px; background: var(--surface);
  }
  .musician-info { display: flex; align-items: center; gap: 10px; flex: 1; }
  .mname { font-weight: 600; font-size: 1rem; min-width: 80px; }
  .minstruments { display: flex; gap: 4px; flex-wrap: wrap; }
  .inst-badge { font-size: 1.1rem; }
  .free-badge { font-size: 0.8rem; color: var(--text-muted); font-style: italic; }

  .item-actions { display: flex; gap: 4px; }
  .edit-btn, .del-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; padding: 4px 6px; border-radius: 4px; opacity: 0.6; transition: opacity 0.12s; }
  .edit-btn:hover, .del-btn:hover { opacity: 1; }
  .del-btn:hover { color: #ef4444; }

  .empty { text-align: center; padding: 40px; color: var(--text-muted); }
</style>
