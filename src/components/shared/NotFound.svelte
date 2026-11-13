<script lang="ts">
  import * as Empty from '$components/ui/empty';
  import { Button } from '$components/ui/button';
  import { base } from '$app/paths';
  import { t } from '$lib/i18n';

  // "Setlist not found" page state with a link back to the setlist list.
  let { backLabel }: { backLabel?: string } = $props();
</script>

<Empty.Root class="m-4 py-15">
  <Empty.Header>
    <Empty.Title class="text-base font-normal text-muted-foreground">{$t.notFound.message}</Empty.Title>
  </Empty.Header>
  <Empty.Content>
    <Button variant="link" href="{base}/setlists">{backLabel ?? $t.notFound.backToSetlists}</Button>
  </Empty.Content>
</Empty.Root>
