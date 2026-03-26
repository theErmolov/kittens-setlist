<script lang="ts">
  import { onMount } from 'svelte';
  import SongTable from '$components/backlog/SongTable.svelte';
  import SongEditModal from '$components/backlog/SongEditModal.svelte';
  import type { Song, Setlist, BandMusician } from '$lib/types';
  import { getSongs, addSong, getSetlists, getMusicians } from '$lib/api';
  import { startPolling } from '$lib/poller';

  let songs = $state<Song[]>([]);
  let setlists = $state<Setlist[]>([]);
  let musicians = $state<BandMusician[]>([]);
  let showAddModal = $state(false);
  let loading = $state(true);
  let loadError = $state(false);

  async function loadAll() {
    loading = true;
    loadError = false;
    try {
      const [s, sl, m] = await Promise.all([getSongs(), getSetlists(), getMusicians()]);
      songs = s; setlists = sl; musicians = m;
    } catch {
      // Auto-retry once after 2 s (handles Lambda cold starts)
      await new Promise(r => setTimeout(r, 2000));
      try {
        const [s, sl, m] = await Promise.all([getSongs(), getSetlists(), getMusicians()]);
        songs = s; setlists = sl; musicians = m;
      } catch {
        loadError = true;
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadAll();
    return startPolling(async () => { songs = await getSongs(); }, 10000, () => false);
  });

  async function handleAdd(song: Song) {
    const { id: _, ...rest } = song;
    const created = await addSong(rest);
    songs = [...songs, created];
    showAddModal = false;
  }
</script>

{#if loadError}
  <div class="load-error">
    <span>Не удалось загрузить каталог</span>
    <button onclick={loadAll}>Повторить</button>
  </div>
{:else}
  <SongTable
    {songs}
    {setlists}
    {musicians}
    onadd={() => { showAddModal = true; }}
    {loading}
  />
{/if}

{#if showAddModal}
  <SongEditModal
    song={null}
    {musicians}
    onclose={() => { showAddModal = false; }}
    onsave={handleAdd}
  />
{/if}

<style>
  .load-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 80px 24px;
    color: var(--text-muted);
  }
  .load-error button {
    padding: 8px 20px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    font-size: 0.95rem;
  }
  .load-error button:hover { border-color: var(--accent); color: var(--accent); }
</style>
