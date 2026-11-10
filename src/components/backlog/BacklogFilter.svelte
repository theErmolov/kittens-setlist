<script lang="ts">
  /**
   * Catalog filter palette (shadcn Command): its input is the song search (title / artist, live-filters the table); the option groups are always listed. Multi-select groups for categories, musicians and
   * instruments. Selecting toggles the filter and keeps the palette open. State lives in backlogStore.
   */
  import type { Category, Instrument } from '$lib/types';
  import { t } from '$lib/i18n';
  import { INSTRUMENT_ICONS, INSTRUMENT_ORDER } from '$lib/utils';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import * as Command from '$components/ui/command';

  let { names, categoryCounts, musicianCounts, result, autofocus = false }: {
    /** Focus the search input on mount (used inside the mobile drawer). */
    autofocus?: boolean;
    names: string[];
    categoryCounts: Record<Category, number>;
    musicianCounts: Record<string, number>;
    /** Result summary, e.g. "3 songs (12 min)". */
    result: string;
  } = $props();

  const search = useStore(backlogStore, s => s.search);
  const showArchived = useStore(backlogStore, s => s.showArchived);
  const showProgress = useStore(backlogStore, s => s.showProgress);
  const categoryFilter = useStore(backlogStore, s => s.categoryFilter);
  const selectedMusicians = useStore(backlogStore, s => s.selectedMusicians);
  const selectedInstruments = useStore(backlogStore, s => s.selectedInstruments);
  const actions = backlogStore.getState();
  // Progress is a view mode, not a filter: it is not counted and not cleared by Reset.
  let activeCount = $derived(($search.trim() ? 1 : 0) + ($showArchived ? 1 : 0) + $categoryFilter.size + $selectedMusicians.size + $selectedInstruments.size);
  const categories: Category[] = ['top', 'mid', 'low'];
</script>

<Command.Root shouldFilter={false} class="h-auto min-h-0 p-0">
  <Command.Input {autofocus} placeholder={$t.backlog.search} aria-label={$t.backlog.search} value={$search} oninput={e => actions.setSearch(e.currentTarget.value)} />
  <Command.List class="max-h-[min(360px,36dvh)]">
    <Command.Group heading={$t.backlog.filterCategories}>
      {#each categories as cat}
        <Command.Item value={$t.filter[cat]} data-checked={$categoryFilter.has(cat)} onSelect={() => actions.toggleCategory(cat)}>
          <span>{$t.filter[cat]}</span>
          <span class="text-xs text-muted-foreground">{categoryCounts[cat] ?? 0}</span>
        </Command.Item>
      {/each}
    </Command.Group>
    <Command.Group heading={$t.backlog.filterMusicians}>
      {#each names as name}
        <Command.Item value={name} data-checked={$selectedMusicians.has(name)} onSelect={() => actions.toggleMusician(name)}>
          <span>{name}</span>
          <span class="text-xs text-muted-foreground">{musicianCounts[name] ?? 0}</span>
        </Command.Item>
      {/each}
    </Command.Group>
    <Command.Group heading={$t.backlog.filterInstruments}>
      {#each INSTRUMENT_ORDER as inst (inst)}
        <Command.Item value={$t.instrument[inst]} data-checked={$selectedInstruments.has(inst)} onSelect={() => actions.toggleInstrument(inst)}>
          <span aria-hidden="true">{INSTRUMENT_ICONS[inst]}</span>
          <span>{$t.instrument[inst]}</span>
        </Command.Item>
      {/each}
    </Command.Group>
    <Command.Group heading={$t.backlog.filterView}>
      <Command.Item value="archive" data-checked={$showArchived} onSelect={() => actions.toggleShowArchived()}>
        <span aria-hidden="true">📦</span><span>{$t.backlog.showArchive}</span>
      </Command.Item>
      <Command.Item value="progress" data-checked={$showProgress} onSelect={() => actions.toggleShowProgress()}>
        <span aria-hidden="true">📊</span><span>{$t.backlog.progress}</span>
      </Command.Item>
    </Command.Group>
  </Command.List>
  <Command.Separator />
  <Command.Group forceMount>
    <Command.Item value="__reset" forceMount disabled={activeCount === 0} onSelect={() => actions.resetFilters()}>{$t.backlog.filterReset}</Command.Item>
  </Command.Group>
  <p class="px-3 pb-2 text-xs text-muted-foreground" aria-live="polite">{result}</p>
</Command.Root>
