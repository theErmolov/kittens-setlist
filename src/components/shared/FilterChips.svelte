<script lang="ts">
  import type { Category } from '$lib/types';
  import { t } from '$lib/i18n';
  import { Toggle } from '$components/ui/toggle';
  import { cn } from '$lib/utils';

  let {
    selected,
    onchange,
    counts,
    chipClass: extra = '',
    iconOnlyOnMid = false
  }: {
    selected: Set<Category>;
    onchange: (v: Set<Category>) => void;
    counts?: Record<Category, number>;
    /** Extra classes for every chip (e.g. a denser size). */
    chipClass?: string;
    /** Hide the category names on mid-size screens too (below that they are always hidden), leaving icon and count. */
    iconOnlyOnMid?: boolean;
  } = $props();

  function toggle(cat: Category) {
    const next = new Set(selected);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    onchange(next);
  }

  function selectAll() {
    onchange(new Set());
  }

  // Split "💩 Top" → { icon: "💩", label: " Top" }
  function splitLabel(text: string) {
    const i = text.indexOf(' ');
    return i === -1 ? { icon: text, label: '' } : { icon: text.slice(0, i), label: text.slice(i) };
  }

  const chipClass = 'px-3.5 text-small font-medium text-muted-foreground hover:border-primary hover:bg-transparent hover:text-primary-ink max-mid:px-2.5 ';
  /** The selected chip of each category: solid category colour, white text (hover keeps it). */
  const activeColors: Record<Category, string> = {
    top: 'on:border-transparent on:bg-category-top-active-bg on:text-category-top-active-ink on:hover:border-transparent on:hover:bg-category-top-active-bg on:hover:text-category-top-active-ink',
    mid: 'on:border-transparent on:bg-category-mid-active-bg on:text-category-mid-active-ink on:hover:border-transparent on:hover:bg-category-mid-active-bg on:hover:text-category-mid-active-ink',
    low: 'on:border-transparent on:bg-category-low-active-bg on:text-category-low-active-ink on:hover:border-transparent on:hover:bg-category-low-active-bg on:hover:text-category-low-active-ink',
  };
</script>

<div class="flex flex-wrap gap-2">
  <Toggle
    type="button"
    variant="outline"
    class="{chipClass} {extra} on:border-transparent on:bg-primary on:text-primary-foreground on:hover:text-primary-foreground on:hover:bg-primary/90"
    pressed={selected.size === 0}
    onPressedChange={selectAll}
  >
    {$t.filter.all}{counts ? ` (${Object.values(counts).reduce((a, b) => a + b, 0)})` : ''}
  </Toggle>
  {#each (['top', 'mid', 'low'] as Category[]) as cat}
    {@const { icon, label } = splitLabel($t.filter[cat])}
    {@const countStr = counts ? ` (${counts[cat] ?? 0})` : ''}
    <Toggle
      type="button"
      variant="outline"
      class="{chipClass} {extra} {activeColors[cat]}"
      pressed={selected.has(cat)}
      onPressedChange={() => toggle(cat)}
    >
      {icon}<span class={cn('max-mid:hidden', iconOnlyOnMid && 'mid:max-big:hidden')}>{label}</span>{countStr}
    </Toggle>
  {/each}
</div>
