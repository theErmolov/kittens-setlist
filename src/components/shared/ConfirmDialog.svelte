<script lang="ts">
  import * as AlertDialog from '$components/ui/alert-dialog';
  import { t } from '$lib/i18n';

  // Controlled confirmation dialog (replaces window.confirm). Open state lives in the caller's Zustand store.
  let { open, title, description, confirmLabel, destructive = true, onopenchange, onconfirm }: {
    open: boolean;
    title?: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onopenchange: (open: boolean) => void;
    onconfirm: () => void | Promise<void>;
  } = $props();
</script>

<AlertDialog.Root {open} onOpenChange={onopenchange}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      {#if title}<AlertDialog.Title>{title}</AlertDialog.Title>{/if}
      <AlertDialog.Description>{description}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{$t.musicians.cancel}</AlertDialog.Cancel>
      <AlertDialog.Action variant={destructive ? 'destructive' : 'default'} onclick={() => onconfirm()}>{confirmLabel}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
