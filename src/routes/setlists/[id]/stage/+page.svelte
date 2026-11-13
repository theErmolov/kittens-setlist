<script lang="ts">
  import NotFound from '$components/shared/NotFound.svelte';
  import { browser } from '$app/environment';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import SetlistStage from '$components/stage/SetlistStage.svelte';
  import { t } from '$lib/i18n';
  import { currentUser, authLoading } from '$lib/auth';
  import { musiciansQuery } from '$lib/query/queries';
  import { stageIsApproved } from '$lib/store/stage';
  import { keys } from '$lib/query/queries';
  import { stageSetlistQuery } from '$lib/query/stage';

  const qc = useQueryClient();
  let id = $derived(page.params.id ?? '');
  const setlistQ = createQuery(() => ({ ...stageSetlistQuery(id), enabled: !!id }));
  const musiciansQ = createQuery(() => ({ ...musiciansQuery(), enabled: $stageIsApproved }));
  // One version of the page: wait for the session and the band roster (the musician columns depend on both) before drawing anything.
  const loading = $derived(!browser || setlistQ.isPending || $authLoading || ($stageIsApproved && musiciansQ.isPending));

  afterNavigate(() => { window.scrollTo(0, 0); });

  // Personal comments depend on the viewer: reload when the user changes.
  let seen = false;
  let lastUserId: string | undefined;
  $effect(() => {
    const userId = $currentUser?.id;
    if (seen && userId !== lastUserId && id) qc.invalidateQueries({ queryKey: keys.setlist(id) });
    lastUserId = userId;
    seen = true;
  });
</script>

{#if loading}
  <LoadingCat />
{:else if setlistQ.data}
  <SetlistStage setlistId={id} />
{:else}
  <NotFound backLabel={$t.notFound.back} />
{/if}
