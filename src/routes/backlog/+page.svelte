<script lang="ts">
  import { songsStore } from '$lib/stores/songs';
  import { setlistsStore } from '$lib/stores/setlists';
  import SongTable from '$components/backlog/SongTable.svelte';
  import SongEditModal from '$components/backlog/SongEditModal.svelte';
  import type { Song } from '$lib/types';
  import { addSong } from '$lib/api';

  let songs = $derived($songsStore);
  let setlists = $derived($setlistsStore);

  let showAddModal = $state(false);

  async function handleAdd(song: Song) {
    const { id: _, ...rest } = song;
    await addSong(rest);
    showAddModal = false;
  }
</script>

<SongTable
  {songs}
  {setlists}
  onadd={() => { showAddModal = true; }}
/>

{#if showAddModal}
  <SongEditModal
    song={null}
    onclose={() => { showAddModal = false; }}
    onsave={handleAdd}
  />
{/if}
