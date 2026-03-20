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

  onMount(() => {
    Promise.all([getSongs(), getSetlists(), getMusicians()]).then(([s, sl, m]) => {
      songs = s; setlists = sl; musicians = m;
    });
    return startPolling(async () => { songs = await getSongs(); }, 10000, () => false);
  });

  async function handleAdd(song: Song) {
    const { id: _, ...rest } = song;
    const created = await addSong(rest);
    songs = [...songs, created];
    showAddModal = false;
  }
</script>

<SongTable
  {songs}
  {setlists}
  {musicians}
  onadd={() => { showAddModal = true; }}
/>

{#if showAddModal}
  <SongEditModal
    song={null}
    {musicians}
    onclose={() => { showAddModal = false; }}
    onsave={handleAdd}
  />
{/if}
