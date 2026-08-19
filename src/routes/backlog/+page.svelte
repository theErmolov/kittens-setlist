<script lang="ts">
  import { onMount } from 'svelte';
  import SongTable from '$components/backlog/SongTable.svelte';
  import SongEditModal from '$components/backlog/SongEditModal.svelte';
  import type { Song, Setlist, BandMusician } from '$lib/types';
  import { getSongs, addSong, getSetlists, getMusicians } from '$lib/api';
  import { startPolling } from '$lib/poller';
  import { PresenceController, BACKLOG_ROOM } from '$lib/presence';
  import { canWrite, currentUser } from '$lib/auth';

  let songs = $state<Song[]>([]);
  let setlists = $state<Setlist[]>([]);
  let musicians = $state<BandMusician[]>([]);
  let showAddModal = $state(false);
  let loading = $state(true);

  onMount(() => {
    Promise.all([getSongs(), getSetlists(), getMusicians()]).then(([s, sl, m]) => {
      songs = s; setlists = sl; musicians = m; loading = false;
    });
    const interval = ($currentUser?.isAdmin || $currentUser?.role === 'writer') ? 10000 : 50000;
    const presence = new PresenceController(BACKLOG_ROOM, 'backlog');
    presence.start();
    const stop = startPolling(async () => { songs = await getSongs(); }, interval, () => presence.isPaused());
    return () => { stop(); presence.stop(); };
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
  {loading}
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
