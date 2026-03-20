<script lang="ts">
  import { onMount } from 'svelte';
  import SongTable from '$components/backlog/SongTable.svelte';
  import SongEditModal from '$components/backlog/SongEditModal.svelte';
  import type { Song, Setlist, BandMusician } from '$lib/types';
  import { getSongs, addSong, getSetlists, getMusicians } from '$lib/api';

  let songs = $state<Song[]>([]);
  let setlists = $state<Setlist[]>([]);
  let musicians = $state<BandMusician[]>([]);
  let showAddModal = $state(false);

  onMount(async () => {
    [songs, setlists, musicians] = await Promise.all([getSongs(), getSetlists(), getMusicians()]);
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
