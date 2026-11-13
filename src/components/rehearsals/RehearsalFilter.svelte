<script lang="ts">
  /**
   * Song filter of the rehearsal detail page, laid out like the setlist editor's (EditorFilters): on mid/big an expanding bar under the
   * top navigation (people, then search + sorting), on small a compact bottom drawer. Participants are an AND filter of the song rows.
   */
  import { Toggle } from '$components/ui/toggle';
  import MusicianFilter from '$components/shared/MusicianFilter.svelte';
  import SongFilterPanel from '$components/shared/SongFilterPanel.svelte';
  import { chip } from '$components/setlist/classes';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { useStore } from '$lib/store/bridge';
  import { noteStore } from '$lib/store/shell';
  import { rehearsalDetailStore as detail } from '$lib/store/rehearsals';

  let { names, guests, counts }: { names: string[]; guests: string[]; counts: Record<string, number> } = $props();
  const participantFilter = useStore(detail, s => s.participantFilter);
  const readinessFirst = useStore(detail, s => s.readinessFirst);
  const filterText = useStore(detail, s => s.filterText);
  const filterOpen = useStore(detail, s => s.filterOpen);
  const mobile = useStore(noteStore, s => s.mobile);
  const actions = detail.getState();
</script>

{#snippet people(layout: 'inline' | 'stacked')}
  <MusicianFilter {names} {guests} {counts} selected={new Set($participantFilter)} onToggle={actions.toggleParticipant} {layout} itemClass="h-7 px-2 text-caption" />
{/snippet}

{#snippet extras()}
  <Toggle class="{chip} h-7 px-2 text-caption" pressed={$readinessFirst} onPressedChange={() => actions.patch({ readinessFirst: !$readinessFirst })}><span aria-hidden="true">📉</span> {$rt.leastReadyFirst}</Toggle>
{/snippet}

<SongFilterPanel
  open={$filterOpen}
  mobile={$mobile}
  onopenchange={o => actions.patch({ filterOpen: o })}
  search={$filterText}
  onsearch={filterText => actions.patch({ filterText })}
  {people}
  {extras}
  class="gap-1.5 border-t pt-1.5 pb-0.5"
/>
