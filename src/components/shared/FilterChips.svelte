<script lang="ts">
  import type { Category } from '$lib/types';
  import { t } from '$lib/i18n';
  import { Toggle } from '$components/ui/toggle';

  let {
    selected,
    onchange,
    counts
  }: {
    selected: Set<Category>;
    onchange: (v: Set<Category>) => void;
    counts?: Record<Category, number>;
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

  const chipClass = 'chip px-3.5 text-[0.82rem] font-medium text-muted-foreground hover:border-primary hover:bg-transparent hover:text-primary-ink max-md:px-2.5 ';
  const activeColors: Record<Category, string> = {
    top: 'data-[state=on]:border-warning-ink data-[state=on]:bg-warning data-[state=on]:text-warning-ink data-[state=on]:hover:bg-warning/80 data-[state=on]:hover:text-warning-ink',
    mid: 'data-[state=on]:border-info-ink data-[state=on]:bg-info data-[state=on]:text-info-ink data-[state=on]:hover:bg-info/80 data-[state=on]:hover:text-info-ink',
    low: 'data-[state=on]:border-success-ink data-[state=on]:bg-success data-[state=on]:text-success-ink data-[state=on]:hover:bg-success/80 data-[state=on]:hover:text-success-ink',
  };
</script>

<div class="flex flex-wrap gap-2">
  <Toggle
    type="button"
    variant="outline"
    class="{chipClass} chip-all data-[state=on]:border-primary-ink data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:text-primary-foreground data-[state=on]:hover:bg-primary/90"
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
      class="{chipClass} chip-{cat} {activeColors[cat]}"
      pressed={selected.has(cat)}
      onPressedChange={() => toggle(cat)}
    >
      {icon}<span class="cat-label max-md:hidden">{label}</span>{countStr}
    </Toggle>
  {/each}
</div>
