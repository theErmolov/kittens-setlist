<script lang="ts">
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import * as Empty from '$components/ui/empty';
  import { Button } from '$components/ui/button';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import StageView from '$components/stage/StageView.svelte';
  import { t } from '$lib/i18n';
  import { currentUser } from '$lib/auth';
  import { keys } from '$lib/query/queries';
  import { stageSetlistQuery } from '$lib/query/stage';

  const qc = useQueryClient();
  let id = $derived(page.params.id ?? '');
  const setlistQ = createQuery(() => ({ ...stageSetlistQuery(id), enabled: !!id }));

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

{#if setlistQ.isPending}
  <LoadingCat />
{:else if setlistQ.data}
  <StageView setlistId={id} />
{:else}
  <Empty.Root class="m-4 py-[60px]">
    <Empty.Header>
      <Empty.Title class="text-base font-normal text-muted-foreground">{$t.notFound.message}</Empty.Title>
    </Empty.Header>
    <Empty.Content>
      <Button variant="link" href="{base}/setlists">{$t.notFound.back}</Button>
    </Empty.Content>
  </Empty.Root>
{/if}
