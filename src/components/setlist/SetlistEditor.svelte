<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { Button } from '$components/ui/button';
  import * as Empty from '$components/ui/empty';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { base } from '$app/paths';
  import { t } from '$lib/i18n';
  import { currentUser, canWrite } from '$lib/auth';
  import { PresenceController, setlistRoom } from '$lib/presence';
  import { isEventLongOver } from '$lib/utils';
  import { useStore } from '$lib/store/bridge';
  import { setlistEditorStore } from '$lib/store/setlistEditor';
  import { editorSetlistQuery } from '$lib/query/setlistEditor';
  import { keys } from '$lib/query/queries';
  import { queryClient } from '$lib/query/client';
  import type { Setlist } from '$lib/types';
  import { useReorderEntries, useUpdateSetlist } from '$lib/query/setlistMutations';
  import EditorHeader from './editor/EditorHeader.svelte';
  import EditorFilters from './editor/EditorFilters.svelte';
  import EditorTable from './editor/EditorTable.svelte';
  import EditorModals from './editor/EditorModals.svelte';
  import { useEditorData } from './editor/editorData.svelte';
  import { pollUnlessDenied } from '$lib/query/client';

  let { setlistId }: { setlistId: string } = $props();

  const actions = setlistEditorStore.getState();
  const pollPaused = useStore(setlistEditorStore, s => s.pollPaused);
  const activeSubsetId = useStore(setlistEditorStore, s => s.activeSubsetId);
  const data = useEditorData();

  // Fresh UI state for this setlist (runs synchronously on init).
  $effect.pre(() => { actions.reset(setlistId); });

  // Persistence for store actions goes through TanStack mutations.
  const reorder = useReorderEntries();
  const updateSetlist = useUpdateSetlist();
  actions.setDeps({
    getServer: () => queryClient.getQueryData<Setlist>(keys.setlist(setlistId)),
    reorder: (entries, subsets) => reorder.mutateAsync({ setlistId: setlistEditorStore.getState().setlistId!, entries, subsets }),
    updateSetlist: setlist => updateSetlist.mutateAsync(setlist),
  });

  // Server copy: polled every 3 s for writers/admins (15 s otherwise), paused while the tab is
  // hidden, nobody else is in the room, or the event is long over.
  const pollMs = $derived(($currentUser?.isAdmin || $currentUser?.role === 'writer') ? 3000 : 15000);
  const setlistQ = createQuery(() => ({
    ...editorSetlistQuery(setlistId),
    refetchInterval: pollUnlessDenied($pollPaused ? false : pollMs),
    refetchOnWindowFocus: !$pollPaused,
  }));

  // Quick-set mode ends when its subset disappears (e.g. dissolved by someone else).
  $effect(() => {
    const id = $activeSubsetId;
    if (id && data.loaded && !data.subsets.some(s => s.id === id)) actions.patch({ activeSubsetId: null });
  });

  $effect(() => {
    const presence = new PresenceController(setlistRoom(setlistId), 'setlist');
    presence.start();
    const check = () => {
      const meta = queryClient.getQueryData<Setlist>(keys.setlist(setlistId));
      actions.patch({ pollPaused: document.hidden || presence.isPaused() || isEventLongOver(meta?.date, meta?.startTime) });
    };
    check();
    const timer = setInterval(check, 1000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      presence.stop();
    };
  });

  const notFound = $derived(setlistQ.data === undefined && setlistQ.isError);
</script>

{#if notFound}
  <Empty.Root class="m-4 py-[60px]">
    <Empty.Header>
      <Empty.Title class="text-base font-normal text-muted-foreground">{$t.notFound.message}</Empty.Title>
    </Empty.Header>
    <Empty.Content>
      <Button variant="link" href="{base}/setlists">{$t.notFound.backToSetlists}</Button>
    </Empty.Content>
  </Empty.Root>
{:else if !data.loaded || !data.ready}
  <LoadingCat />
{:else}
  <div class="editor flex h-[calc(100dvh-56px)] flex-col max-mid:h-[calc(100dvh-56px-64px)]" class:read-only={!$canWrite}>
    <EditorHeader />
    <EditorFilters />

    {#if data.sortedEntries.length === 0}
      <Empty.Root class="m-4 flex-none py-[60px]">
        <Empty.Header>
          <Empty.Title class="text-base font-normal text-muted-foreground">{$t.editor.empty}</Empty.Title>
        </Empty.Header>
        {#if $canWrite}
          <Empty.Content>
            <Button class="font-semibold" onclick={() => actions.patch({ showAddModal: true })}>{$t.editor.addSongsBtn}</Button>
          </Empty.Content>
        {/if}
      </Empty.Root>
    {:else}
      <EditorTable />
    {/if}
  </div>

  <EditorModals />
{/if}
