<script lang="ts">
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import * as Empty from '$components/ui/empty';
  import { Button } from '$components/ui/button';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { createQuery } from '@tanstack/svelte-query';
  import SetlistEditor from '$components/setlist/SetlistEditor.svelte';
  import { t } from '$lib/i18n';
  import { stageSetlistQuery } from '$lib/query/stage';

  let id = $derived(page.params.id ?? '');
  const setlistQ = createQuery(() => ({ ...stageSetlistQuery(id), enabled: !!id }));
</script>

{#if setlistQ.isPending}
  <LoadingCat />
{:else if setlistQ.data}
  <SetlistEditor setlistId={id} />
{:else}
  <Empty.Root class="m-4 py-[60px]">
    <Empty.Header>
      <Empty.Title class="text-base font-normal text-muted-foreground">{$t.notFound.message}</Empty.Title>
    </Empty.Header>
    <Empty.Content>
      <Button variant="link" href="{base}/setlists">{$t.notFound.backToSetlists}</Button>
    </Empty.Content>
  </Empty.Root>
{/if}
