<script lang="ts">
  /** Compact bottom drawer of the setlist editor / rehearsal song filters (small screens). */
  import type { Snippet } from 'svelte';
  import * as Drawer from '$components/ui/drawer';

  let { open, onOpenChange, title, children }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    children: Snippet;
  } = $props();
</script>

<Drawer.Root {open} {onOpenChange} shouldScaleBackground={false}>
  <Drawer.Content onOpenAutoFocus={e => e.preventDefault()}>
    <Drawer.Header class="p-2">
      <Drawer.Title class="text-sm">{title}</Drawer.Title>
    </Drawer.Header>
    <div class="mx-auto flex max-h-[70dvh] w-full max-w-2xl flex-col gap-2 overflow-y-auto px-3 pb-3">
      {@render children()}
    </div>
  </Drawer.Content>
</Drawer.Root>
