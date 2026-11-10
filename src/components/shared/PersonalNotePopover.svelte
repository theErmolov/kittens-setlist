<script lang="ts">
  import * as Popover from '$components/ui/popover';
  import { t } from '$lib/i18n';
  import LinkifiedText from '$components/shared/LinkifiedText.svelte';
  import { useStore } from '$lib/store/bridge';
  import { notePopoverStore } from '$lib/store/notePopover';
  import IconButton from '$components/shared/IconButton.svelte';

  const open = useStore(notePopoverStore, s => s.open);
  const close = () => notePopoverStore.getState().close();

  // Leaving the page must not leave the tooltip behind.
  $effect(() => close);
</script>

<!-- Outside click and Esc are handled by the Popover; scroll/resize close it like the old hand-positioned tooltip did. -->
<svelte:window onscroll={close} onresize={close} />

<Popover.Root open={!!$open} onOpenChange={value => { if (!value) close(); }}>
  {#if $open}
    <Popover.Content
      customAnchor={$open.anchor}
      side="bottom"
      collisionPadding={8}
      trapFocus={false}
      aria-label={$open.title ?? $t.common.personalComment}
      class="w-max max-w-[min(340px,calc(100vw-16px))] gap-1.5 p-2.5 px-3"
      onOpenAutoFocus={e => e.preventDefault()}
      onCloseAutoFocus={e => e.preventDefault()}
      onInteractOutside={e => { if ($open.anchor.contains(e.target as Node | null)) e.preventDefault(); }}
    >
      <div class="flex items-center justify-between gap-3">
        <span class="text-[.8rem] font-semibold text-muted-foreground">{$open.icon ?? '🤫'} {$open.title ?? $t.common.personalComment}</span>
        {#if $open.onedit}
          <IconButton icon="✏️" label={$open.editLabel ?? $t.common.edit} onclick={() => { const edit = $open?.onedit; close(); edit?.(); }} />
        {/if}
      </div>
      <p class="m-0 text-[.9rem] break-words whitespace-pre-wrap"><LinkifiedText text={$open.text} /></p>
    </Popover.Content>
  {/if}
</Popover.Root>
