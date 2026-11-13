<script lang="ts">
  import NotFound from '$components/shared/NotFound.svelte';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { page } from '$app/state';
  import { createQuery } from '@tanstack/svelte-query';
  import SetlistEditor from '$components/setlist/SetlistEditor.svelte';
  import { stageSetlistQuery } from '$lib/query/stage';

  let id = $derived(page.params.id ?? '');
  const setlistQ = createQuery(() => ({ ...stageSetlistQuery(id), enabled: !!id }));
</script>

{#if setlistQ.isPending}
  <LoadingCat />
{:else if setlistQ.data}
  <SetlistEditor setlistId={id} />
{:else}
  <NotFound />
{/if}
