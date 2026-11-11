<script lang="ts">
  /** Catalog filters laid out for the small-screen drawer: search, category chips + summary, musicians, instruments, then the archive / progress view toggles. */
  import type { Category, Instrument } from '$lib/types';
  import { t } from '$lib/i18n';
  import { INSTRUMENT_ICONS, INSTRUMENT_ORDER } from '$lib/utils';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import FilterChip from '$components/shared/FilterChip.svelte';
  import { Input } from '$components/ui/input';
  import { Toggle } from '$components/ui/toggle';
  import { Separator } from '$components/ui/separator';

  let { names, categoryCounts, musicianCounts, result }: {
    names: string[];
    categoryCounts: Record<Category, number>;
    musicianCounts: Record<string, number>;
    /** Result summary, e.g. "147 songs (12 h 13 min)". */
    result: string;
  } = $props();

  const search = useStore(backlogStore, s => s.search);
  const categoryFilter = useStore(backlogStore, s => s.categoryFilter);
  const selectedMusicians = useStore(backlogStore, s => s.selectedMusicians);
  const selectedInstruments = useStore(backlogStore, s => s.selectedInstruments);
  const showArchived = useStore(backlogStore, s => s.showArchived);
  const showProgress = useStore(backlogStore, s => s.showProgress);
  const actions = backlogStore.getState();
</script>

<div class="flex flex-col gap-2">
  <Input type="search" placeholder={$t.backlog.search} aria-label={$t.backlog.search} value={$search} oninput={e => actions.setSearch(e.currentTarget.value)} />
  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
    <FilterChips selected={$categoryFilter} onchange={actions.setCategoryFilter} counts={categoryCounts} chipClass="h-7 min-w-0 px-2 text-[0.75rem]" />
    <span class="text-[0.75rem] text-muted-foreground" aria-live="polite">{result}</span>
  </div>
  <div class="flex flex-wrap gap-1.5">
    {#each names as name (name)}
      <FilterChip class="h-7 px-2 text-[0.75rem]" label="{name} ({musicianCounts[name] ?? 0})" active={$selectedMusicians.has(name)} onclick={() => actions.toggleMusician(name)} />
    {/each}
  </div>
  <Separator class="my-0.5" />
  <!-- One line: the ten chips share the width equally. -->
  <div class="flex gap-1">
    {#each INSTRUMENT_ORDER as inst (inst)}
      <Toggle
        type="button"
        variant="outline"
        size="sm"
        class="h-7 min-w-0 flex-1 px-0 text-sm hover:border-primary hover:bg-transparent data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        pressed={$selectedInstruments.has(inst as Instrument)}
        onPressedChange={() => actions.toggleInstrument(inst as Instrument)}
        aria-label={$t.instrument[inst as Instrument]}
        title={$t.instrument[inst as Instrument]}
      ><span aria-hidden="true">{INSTRUMENT_ICONS[inst]}</span></Toggle>
    {/each}
  </div>
  <Separator class="my-0.5" />
  <div class="flex flex-wrap gap-1.5">
    <FilterChip class="h-7 px-2 text-[0.75rem] text-primary-ink" label="📦 {$t.backlog.showArchive}" active={$showArchived} onclick={() => actions.toggleShowArchived()} />
    <FilterChip class="h-7 px-2 text-[0.75rem] text-primary-ink" label="📊 {$t.backlog.progress}" active={$showProgress} onclick={() => actions.toggleShowProgress()} />
  </div>
</div>
