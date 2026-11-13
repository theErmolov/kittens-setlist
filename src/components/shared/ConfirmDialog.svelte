<script lang="ts">
  import * as AlertDialog from '$components/ui/alert-dialog';
  import { t } from '$lib/i18n';

  // Controlled confirmation dialog (replaces window.confirm). Open state lives in the caller's Zustand store.
  let { open, title, description, confirmLabel, cancelLabel, confirmClass, destructive = true, onopenchange, onconfirm }: {
    open: boolean;
    title?: string;
    description?: string;
    confirmLabel: string;
    cancelLabel?: string;
    /** Extra classes for the confirm button (overrides the variant colours). */
    confirmClass?: string;
    destructive?: boolean;
    onopenchange: (open: boolean) => void;
    onconfirm: () => void | Promise<void>;
  } = $props();
</script>

<AlertDialog.Root {open} onOpenChange={onopenchange}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      {#if title}<AlertDialog.Title>{title}</AlertDialog.Title>{/if}
      {#if description}<AlertDialog.Description>{description}</AlertDialog.Description>{/if}
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{cancelLabel ?? $t.musicians.cancel}</AlertDialog.Cancel>
      <AlertDialog.Action variant={destructive ? 'destructive' : 'default'} class={confirmClass} onclick={() => onconfirm()}>{confirmLabel}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
