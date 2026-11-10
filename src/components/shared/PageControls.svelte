<script lang="ts">
  /**
   * Sticky controls bar for pages (setlist editor, rehearsals, setlists): a shadcn NavigationMenu pinned directly
   * below the top navigation tabs. LEFT (`start`): breadcrumbs, back/nav buttons, filters and mode toggles.
   * RIGHT (`end`): action buttons (add, edit, delete, ...), always flush right. Put each control in a
   * `<NavigationMenu.Item>`.
   * Height: every page's bar is exactly the same height (h-14) from 640px up — the left side shrinks/truncates
   * and the right side never wraps. Below 640px the bar may wrap onto extra rows so nothing is cut off.
   */
  import type { Snippet } from 'svelte';
  import * as NavigationMenu from '$components/ui/navigation-menu';

  /** `children` (legacy) renders on the left like `start`. */
  let { start, end, children, label }: { start?: Snippet; end?: Snippet; children?: Snippet; label?: string } = $props();
</script>

<div class="sticky top-14 z-10 border-b bg-card shadow-[0_2px_6px_rgba(0,0,0,0.06)] sm:h-14">
  <NavigationMenu.Root viewport={false} aria-label={label} class="w-full max-w-none justify-start px-3 py-2 sm:h-full sm:py-0 [&>div]:w-full sm:[&>div]:h-full">
    <NavigationMenu.List class="w-full flex-wrap justify-between gap-x-3 gap-y-1.5 sm:h-full sm:flex-nowrap">
      <li class="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:overflow-hidden">
        <ul class="contents">
          {@render start?.()}
          {@render children?.()}
        </ul>
      </li>
      <li class="ml-auto flex flex-wrap items-center justify-end gap-2 sm:shrink-0 sm:flex-nowrap">
        <ul class="contents">
          {@render end?.()}
        </ul>
      </li>
    </NavigationMenu.List>
  </NavigationMenu.Root>
</div>
