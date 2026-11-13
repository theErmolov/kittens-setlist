<script lang="ts">
  /**
   * A row of buttons with the app's standard 8px spacing. Use it for every group of adjacent buttons
   * (row actions, toolbars, nav controls, form actions) instead of ad-hoc flex/gap/whitespace.
   */
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  let { justify = 'start', wrap = false, class: className, children, ...rest }: {
    justify?: 'start' | 'center' | 'end';
    wrap?: boolean;
    class?: string;
    children?: Snippet;
  } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
  class={cn('flex items-center gap-2', justify === 'end' && 'justify-end', justify === 'center' && 'justify-center', wrap && 'flex-wrap', className)}
  {...rest}
>{@render children?.()}</div>
