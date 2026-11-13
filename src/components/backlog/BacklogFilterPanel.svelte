<script lang="ts">
  /** Catalog filters laid out for the small-screen drawer: search, category chips + summary, musicians, instruments, then the archive / progress view toggles. */
  import type { Category } from '$lib/types';
  import { t } from '$lib/i18n';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import FilterChip from '$components/shared/FilterChip.svelte';
  import MusicianFilter from '$components/shared/MusicianFilter.svelte';
  import InstrumentToggleGroup from '$components/shared/InstrumentToggleGroup.svelte';
  import SearchInput from '$components/shared/SearchInput.svelte';
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
  <SearchInput label={$t.backlog.search} value={$search} onchange={actions.setSearch} />
  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
    <FilterChips selected={$categoryFilter} onchange={actions.setCategoryFilter} counts={categoryCounts} chipClass="h-7 min-w-0 px-2 text-caption" />
    <span class="text-caption text-muted-foreground" aria-live="polite">{result}</span>
  </div>
  <MusicianFilter {names} counts={musicianCounts} selected={$selectedMusicians} onToggle={actions.toggleMusician} variant="filter" itemClass="h-7 px-2 text-caption" />
  <Separator class="my-0.5" />
  <!-- One line: the ten chips share the width equally. -->
  <InstrumentToggleGroup class="flex gap-1" itemClass="h-7 min-w-0 flex-1 px-0 text-sm" selected={$selectedInstruments} onToggle={actions.toggleInstrument} />
  <Separator class="my-0.5" />
  <div class="flex flex-wrap gap-1.5">
    <FilterChip class="h-7 px-2 text-caption text-primary-ink" label="📦 {$t.backlog.showArchive}" active={$showArchived} onclick={() => actions.toggleShowArchived()} />
    <FilterChip class="h-7 px-2 text-caption text-primary-ink" label="📊 {$t.backlog.progress}" active={$showProgress} onclick={() => actions.toggleShowProgress()} />
  </div>
</div>
