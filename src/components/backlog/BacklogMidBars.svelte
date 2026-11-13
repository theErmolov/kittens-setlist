<script lang="ts">
  /**
   * Catalog controls for the mid tier (iPads in landscape): two sticky bars under the top navigation.
   * Bar 1: search, category chips, result summary, add button. Bar 2 (two lines): musician chips, then instrument chips with the archive / progress view toggles.
   */
  import type { Category } from '$lib/types';
  import { t } from '$lib/i18n';
  import { canWrite } from '$lib/auth';
  import { cn } from '$lib/utils';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import PageControls from '$components/shared/PageControls.svelte';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import FilterChip from '$components/shared/FilterChip.svelte';
  import IconButton from '$components/shared/IconButton.svelte';
  import MusicianFilter from '$components/shared/MusicianFilter.svelte';
  import InstrumentToggleGroup from '$components/shared/InstrumentToggleGroup.svelte';
  import SearchInput from '$components/shared/SearchInput.svelte';
  import * as NavigationMenu from '$components/ui/navigation-menu';

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
  const barOpen = useStore(backlogStore, s => s.barOpen);
  const actions = backlogStore.getState();
</script>

<PageControls label={$t.nav.backlog}>
  {#snippet start()}
    <NavigationMenu.Item class="shrink-0">
      <SearchInput class="w-57.5" label={$t.backlog.search} value={$search} onchange={actions.setSearch} />
    </NavigationMenu.Item>
    {#if $barOpen}<NavigationMenu.Item class="min-w-0">
      <FilterChips selected={$categoryFilter} onchange={actions.setCategoryFilter} counts={categoryCounts} iconOnlyOnMid />
    </NavigationMenu.Item>{/if}
    <NavigationMenu.Item class="min-w-0"><span class="truncate text-small text-muted-foreground" aria-live="polite">{result}</span></NavigationMenu.Item>
  {/snippet}
  {#snippet end()}
    <NavigationMenu.Item><IconButton text={$t.backlog.filterBtn} icon="🎛️" label={$t.backlog.filterBtn} class={cn('', $barOpen ? 'on:bg-transparent on:text-foreground' : 'border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:text-secondary-foreground')} pressed={$barOpen} expanded={$barOpen} onpressedchange={() => actions.toggleBarOpen()} /></NavigationMenu.Item>
    {#if $canWrite}<NavigationMenu.Item><IconButton text={$t.backlog.addSong.replace(/^\+\s*/, '')} variant="default" icon="➕" label={$t.backlog.addSong}  onclick={() => actions.setShowAddModal(true)} /></NavigationMenu.Item>{/if}
  {/snippet}
</PageControls>

<!-- Fixed height (105px): SongTable sizes its scroll area from it. -->
{#if $barOpen}
<div class="sticky top-28 z-10 flex h-26.25 items-stretch gap-4 overflow-hidden border-b bg-bar-bg px-4 py-2">
 <div class="flex min-w-0 flex-1 flex-col gap-2">
  <MusicianFilter {names} counts={musicianCounts} selected={$selectedMusicians} onToggle={actions.toggleMusician} variant="filter" groupClass="flex flex-wrap items-center gap-2" />
  <InstrumentToggleGroup class="flex flex-wrap items-center gap-2" itemClass="px-2.5 text-base" selected={$selectedInstruments} onToggle={actions.toggleInstrument} />
 </div>
 <!-- View modes (not filters): progress above archive, in the primary colour. -->
 <div class="flex shrink-0 flex-col justify-center gap-2">
  <FilterChip class="text-primary-ink" icon="📊" iconOnlyOnMid label={$t.backlog.progress} active={$showProgress} onclick={() => actions.toggleShowProgress()} />
  <FilterChip class="text-primary-ink" icon="📦" iconOnlyOnMid label={$t.backlog.showArchive} active={$showArchived} onclick={() => actions.toggleShowArchived()} />
 </div>
</div>
{/if}
