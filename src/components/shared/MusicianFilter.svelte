<script lang="ts">
  /**
   * Musician filter chips shared by the catalog, setlist editor, stage and rehearsal filters: band musicians, then guests
   * (dashed). `single` renders an exclusive ToggleGroup (`onToggle` gets the clicked name, or the group's selected name when
   * it is clicked again); otherwise every chip toggles on its own. `variant="filter"` uses the catalog's FilterChip look.
   */
  import { Toggle } from '$components/ui/toggle';
  import { Separator } from '$components/ui/separator';
  import * as ToggleGroup from '$components/ui/toggle-group';
  import FilterChip from '$components/shared/FilterChip.svelte';
  import { chip } from '$components/setlist/classes';

  let { names, guests = [], counts, selected, onToggle, single = false, variant = 'chip', layout = 'plain', itemClass = '', groupClass }: {
    names: string[];
    guests?: string[];
    /** Songs per musician, shown as "Name (n)"; omit to show names only. */
    counts?: Record<string, number>;
    selected: ReadonlySet<string>;
    onToggle: (name: string) => void;
    single?: boolean;
    variant?: 'chip' | 'filter';
    /** `inline`: one wrapping row with a vertical separator before the guests. `stacked`: groups separated by horizontal rules, closed by a rule. `plain`: groups side by side, no separators. */
    layout?: 'plain' | 'inline' | 'stacked';
    /** Extra classes of every chip (e.g. a denser size). */
    itemClass?: string;
    /** Wrapper classes of a group (not used by `single`). */
    groupClass?: string;
  } = $props();

  const labelOf = (name: string) => counts ? `${name} (${counts[name] ?? 0})` : name;
  const hasAny = $derived(names.length > 0 || guests.length > 0);
</script>

{#snippet group(list: string[], guest: boolean)}
  {#if list.length > 0}
    {#if single}
      {@const current = list.find(name => selected.has(name)) ?? ''}
      <ToggleGroup.Root type="single" spacing={1} class="flex-wrap gap-1.5" value={current} onValueChange={v => { const next = v || current; if (next) onToggle(next); }}>
        {#each list as name (name)}
          <ToggleGroup.Item value={name} class="{chip} {itemClass} {guest ? 'border-dashed' : ''}">{labelOf(name)}</ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    {:else}
      <div class={groupClass ?? 'flex flex-wrap gap-1.5'}>
        {#each list as name (name)}
          {#if variant === 'filter'}
            <FilterChip class="{itemClass} {guest ? 'border-dashed' : ''}" label={labelOf(name)} active={selected.has(name)} onclick={() => onToggle(name)} />
          {:else}
            <Toggle class="{chip} {itemClass} {guest ? 'border-dashed' : ''}" pressed={selected.has(name)} onPressedChange={() => onToggle(name)}>{labelOf(name)}</Toggle>
          {/if}
        {/each}
      </div>
    {/if}
  {/if}
{/snippet}

{#if layout === 'inline'}
  {#if hasAny}
    <div class="flex flex-wrap items-center gap-1.5">
      {@render group(names, false)}
      {#if guests.length > 0}
        <Separator orientation="vertical" class="h-6 self-center" />
        {@render group(guests, true)}
      {/if}
    </div>
  {/if}
{:else if layout === 'stacked'}
  {@render group(names, false)}
  {#if guests.length > 0}
    <Separator class="my-0.5" />
    {@render group(guests, true)}
  {/if}
  {#if hasAny}<Separator class="my-0.5" />{/if}
{:else}
  {@render group(names, false)}
  {@render group(guests, true)}
{/if}
