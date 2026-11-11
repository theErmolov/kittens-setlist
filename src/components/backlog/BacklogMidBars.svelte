<script lang="ts">
  /**
   * Catalog controls for the mid tier (iPads in landscape): two sticky bars under the top navigation.
   * Bar 1: search, category chips, result summary, add button. Bar 2 (two lines): musician chips, then instrument chips with the archive / progress view toggles.
   */
  import type { Category, Instrument } from '$lib/types';
  import { t } from '$lib/i18n';
  import { canWrite } from '$lib/auth';
  import { INSTRUMENT_ICONS, INSTRUMENT_ORDER } from '$lib/utils';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import PageControls from '$components/shared/PageControls.svelte';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import FilterChip from '$components/shared/FilterChip.svelte';
  import IconButton from '$components/shared/IconButton.svelte';
  import { Input } from '$components/ui/input';
  import { Toggle } from '$components/ui/toggle';
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
      <Input class="w-[230px]" type="search" placeholder={$t.backlog.search} aria-label={$t.backlog.search} value={$search} oninput={e => actions.setSearch(e.currentTarget.value)} />
    </NavigationMenu.Item>
    {#if $barOpen}<NavigationMenu.Item class="min-w-0">
      <FilterChips selected={$categoryFilter} onchange={actions.setCategoryFilter} counts={categoryCounts} />
    </NavigationMenu.Item>{/if}
    <NavigationMenu.Item class="min-w-0"><span class="truncate text-[0.82rem] text-muted-foreground" aria-live="polite">{result}</span></NavigationMenu.Item>
  {/snippet}
  {#snippet end()}
    <NavigationMenu.Item><IconButton icon="🎛️" label={$t.backlog.filterBtn} class={$barOpen ? 'data-[state=on]:bg-transparent data-[state=on]:text-foreground' : 'border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:text-secondary-foreground'} pressed={$barOpen} expanded={$barOpen} onpressedchange={() => actions.toggleBarOpen()} /></NavigationMenu.Item>
    {#if $canWrite}<NavigationMenu.Item><IconButton variant="default" icon="➕" label={$t.backlog.addSong} onclick={() => actions.setShowAddModal(true)} /></NavigationMenu.Item>{/if}
  {/snippet}
</PageControls>

<!-- Fixed height (105px): SongTable sizes its scroll area from it. -->
{#if $barOpen}
<div class="sticky top-28 z-10 flex h-[105px] items-stretch gap-4 overflow-hidden border-b bg-card px-4 py-2">
 <div class="flex min-w-0 flex-1 flex-col gap-2">
  <div class="flex flex-wrap items-center gap-2">
    {#each names as name (name)}
      <FilterChip label="{name} ({musicianCounts[name] ?? 0})" active={$selectedMusicians.has(name)} onclick={() => actions.toggleMusician(name)} />
    {/each}
  </div>
  <div class="flex flex-wrap items-center gap-2">
    {#each INSTRUMENT_ORDER as inst (inst)}
      <Toggle
        type="button"
        variant="outline"
        size="sm"
        class="px-2.5 text-base hover:border-primary hover:bg-transparent data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        pressed={$selectedInstruments.has(inst as Instrument)}
        onPressedChange={() => actions.toggleInstrument(inst as Instrument)}
        aria-label={$t.instrument[inst as Instrument]}
        title={$t.instrument[inst as Instrument]}
      ><span aria-hidden="true">{INSTRUMENT_ICONS[inst]}</span></Toggle>
    {/each}
  </div>
 </div>
 <!-- View modes (not filters): progress above archive, in the primary colour. -->
 <div class="flex shrink-0 flex-col justify-center gap-2">
  <FilterChip class="text-primary-ink" label="📊 {$t.backlog.progress}" active={$showProgress} onclick={() => actions.toggleShowProgress()} />
  <FilterChip class="text-primary-ink" label="📦 {$t.backlog.showArchive}" active={$showArchived} onclick={() => actions.toggleShowArchived()} />
 </div>
</div>
{/if}
