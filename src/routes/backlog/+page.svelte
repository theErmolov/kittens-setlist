<script lang="ts">
  import { onMount } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import SongTable from '$components/backlog/SongTable.svelte';
  import SongEditModal from '$components/backlog/SongEditModal.svelte';
  import type { Song } from '$lib/types';
  import { musiciansQuery } from '$lib/query/queries';
  import { backlogPoll, useAddBacklogSong } from '$lib/query/backlog';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import { PresenceController, BACKLOG_ROOM } from '$lib/presence';
  import { canWrite } from '$lib/auth';

  const musiciansQ = createQuery(() => musiciansQuery());
  const addSong = useAddBacklogSong();
  const showAddModal = useStore(backlogStore, s => s.showAddModal);
  const actions = backlogStore.getState();

  onMount(() => {
    const presence = new PresenceController(BACKLOG_ROOM, 'backlog');
    presence.start();
    backlogPoll.isPaused = () => presence.isPaused();
    return () => { backlogPoll.isPaused = () => false; presence.stop(); };
  });

  async function handleAdd(song: Song) {
    await addSong.mutateAsync(song);
    actions.setShowAddModal(false);
  }
</script>

<SongTable />

{#if $showAddModal && $canWrite}
  <SongEditModal
    song={null}
    musicians={musiciansQ.data ?? []}
    onclose={() => actions.setShowAddModal(false)}
    onsave={handleAdd}
  />
{/if}
