<script lang="ts">
  import { onMount } from 'svelte';
  import SetlistCard from '$components/setlist/SetlistCard.svelte';
  import { createSetlist, deleteSetlist, getSetlists } from '$lib/api';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';
  import type { Setlist } from '$lib/types';
  import { canWrite } from '$lib/auth';

  let setlists = $state<Setlist[]>([]);
  let sortedSetlists = $derived([...setlists].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  }));
  let showNew = $state(false);
  let newName = $state('');
  let newDate = $state('');
  let newStartTime = $state('');
  let newVibe = $state(true);
  let loading = $state(true);

  onMount(async () => {
    setlists = await getSetlists();
    loading = false;
  });

  async function handleCreate() {
    if (!newName.trim()) return;
    const sl = await createSetlist(newName.trim(), newDate.trim() || undefined, newStartTime.trim() || undefined, newVibe || undefined);
    setlists = [...setlists, sl];
    newName = ''; newDate = ''; newStartTime = ''; newVibe = true; showNew = false;
    goto(`/setlists/${sl.id}`);
  }

  async function handleDelete(id: string) {
    if (!confirm($t.setlists.deleteConfirm)) return;
    await deleteSetlist(id);
    setlists = setlists.filter(s => s.id !== id);
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>{$t.setlists.title}</h1>
    {#if $canWrite}<button class="btn-primary" onclick={() => { showNew = !showNew; }}>{$t.setlists.newBtn}</button>{/if}
  </div>

  {#if showNew && $canWrite}
    <div class="new-form">
      <input bind:value={newName} placeholder={$t.setlists.namePlaceholder} />
      <div class="new-form-row">
        <input type="date" bind:value={newDate} />
        <input type="time" bind:value={newStartTime} />
        <div class="new-form-actions">
          <button class="btn-secondary" onclick={() => { showNew = false; }}>{$t.setlists.cancel}</button>
          <button class="btn-primary" onclick={handleCreate}>{$t.setlists.create}</button>
        </div>
      </div>
      <div class="vibe-toggle">
        <label class="vibe-label">
          <input type="checkbox" bind:checked={newVibe} />
          {$t.setlists.vibe}
        </label>
        <span class="help-tip" title={$t.setlists.vibeTooltip}>?</span>
      </div>
    </div>
  {/if}

  {#if loading}
    <p class="loading">…</p>
  {:else if setlists.length === 0}
    <div class="empty">
      <p>{$t.setlists.empty}</p>
      {#if !showNew && $canWrite}
        <button class="btn-primary" onclick={() => { showNew = true; }}>{$t.setlists.createFirst}</button>
      {/if}
    </div>
  {:else}
    <div class="cards">
      {#each sortedSetlists as sl (sl.id)}
        <SetlistCard setlist={sl} ondelete={() => handleDelete(sl.id)} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { padding: 20px 16px; max-width: 640px; margin: 0 auto; }
  .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .page-header h1 { font-size: 1.4rem; }
  .new-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
  .new-form input { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 0.9rem; }
  .new-form-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .new-form-row input { flex: 1; min-width: 120px; }
  .new-form-actions { display: flex; gap: 8px; margin-left: auto; }
  .cards { display: flex; flex-direction: column; gap: 10px; }
  .empty, .loading { text-align: center; padding: 60px 20px; color: var(--text-muted); }
  .empty p { margin-bottom: 12px; }
  .btn-primary { padding: 8px 18px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.88rem; }
  .btn-secondary { padding: 8px 18px; border: 1px solid var(--border); background: transparent; border-radius: 6px; cursor: pointer; color: var(--text); font-size: 0.88rem; }
  .vibe-toggle { display: flex; align-items: center; gap: 6px; width: fit-content; }
  .vibe-label { display: flex; align-items: center; gap: 6px; font-size: 0.88rem; color: var(--text-muted); cursor: pointer; }
  .vibe-label input[type="checkbox"] { cursor: pointer; }
  .help-tip {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 50%;
    border: 1px solid var(--border); font-size: 0.7rem;
    color: var(--text-muted); cursor: default; flex-shrink: 0; line-height: 1;
  }

  @media (max-width: 700px) {
    .new-form input { font-size: 16px; }
  }
</style>
