<script lang="ts">
  import { setlistsStore } from '$lib/stores/setlists';
  import SetlistCard from '$components/setlist/SetlistCard.svelte';
  import { createSetlist, deleteSetlist } from '$lib/api';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';

  let setlists = $derived($setlistsStore);

  let showNew = $state(false);
  let newName = $state('');
  let newDate = $state('');

  async function handleCreate() {
    if (!newName.trim()) return;
    const sl = await createSetlist(newName.trim(), newDate.trim() || undefined);
    newName = ''; newDate = ''; showNew = false;
    goto(`/setlists/${sl.id}`);
  }

  async function handleDelete(id: string) {
    if (!confirm($t.setlists.deleteConfirm)) return;
    await deleteSetlist(id);
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>{$t.setlists.title}</h1>
    <button class="btn-primary" onclick={() => { showNew = !showNew; }}>{$t.setlists.newBtn}</button>
  </div>

  {#if showNew}
    <div class="new-form">
      <input bind:value={newName} placeholder={$t.setlists.namePlaceholder} />
      <input type="date" bind:value={newDate} />
      <button class="btn-primary" onclick={handleCreate}>{$t.setlists.create}</button>
      <button class="btn-secondary" onclick={() => { showNew = false; }}>{$t.setlists.cancel}</button>
    </div>
  {/if}

  {#if setlists.length === 0}
    <div class="empty">
      <p>{$t.setlists.empty}</p>
      {#if !showNew}
        <button class="btn-primary" onclick={() => { showNew = true; }}>{$t.setlists.createFirst}</button>
      {/if}
    </div>
  {:else}
    <div class="cards">
      {#each setlists as sl (sl.id)}
        <SetlistCard setlist={sl} ondelete={() => handleDelete(sl.id)} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { padding: 20px 16px; max-width: 640px; margin: 0 auto; }
  .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .page-header h1 { font-size: 1.4rem; }
  .new-form { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
  .new-form input { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 0.9rem; flex: 1; min-width: 160px; }
  .cards { display: flex; flex-direction: column; gap: 10px; }
  .empty { text-align: center; padding: 60px 20px; color: var(--text-muted); }
  .empty p { margin-bottom: 12px; }
  .btn-primary { padding: 8px 18px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.88rem; }
  .btn-secondary { padding: 8px 18px; border: 1px solid var(--border); background: transparent; border-radius: 6px; cursor: pointer; color: var(--text); font-size: 0.88rem; }
</style>
