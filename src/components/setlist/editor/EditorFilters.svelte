<script lang="ts">
  import { base } from '$app/paths';
  import { Button } from '$components/ui/button';
  import { Toggle } from '$components/ui/toggle';
  import MusicianFilter from '$components/shared/MusicianFilter.svelte';
  import SongFilterPanel from '$components/shared/SongFilterPanel.svelte';
  import IconButton from '$components/shared/IconButton.svelte';
  import EditorMetaButtons from './EditorMetaButtons.svelte';
  import EditorActionsMenu from './EditorActionsMenu.svelte';
  import { noteStore } from '$lib/store/shell';
  import { chip, pressedOn } from '../classes';
  import { t } from '$lib/i18n';
  import { canWrite } from '$lib/auth';
  import { useStore } from '$lib/store/bridge';
  import { setlistEditorStore } from '$lib/store/setlistEditor';
  import { useEditorData } from './editorData.svelte';
  import { dragModeStore } from '$lib/store/drag';
  const dragEnabled = useStore(dragModeStore, s => s.enabled);

  const data = useEditorData();
  const actions = setlistEditorStore.getState();
  const setlistId = useStore(setlistEditorStore, s => s.setlistId);
  const selectedMusician = useStore(setlistEditorStore, s => s.selectedMusician);
  const filterNotReady = useStore(setlistEditorStore, s => s.filterNotReady);
  const filterText = useStore(setlistEditorStore, s => s.filterText);
  const filterOpen = useStore(setlistEditorStore, s => s.filterOpen);
  const mobile = useStore(noteStore, s => s.mobile);


</script>

{#snippet people(layout: 'inline' | 'stacked')}
  <MusicianFilter names={data.allMusicians} guests={data.guestNames} counts={data.musicianCounts} selected={new Set($selectedMusician ? [$selectedMusician] : [])} onToggle={actions.toggleMusician} single {layout} itemClass="h-7 px-2 text-caption" />
{/snippet}

{#snippet extras()}
  <Toggle class="{chip} h-7 px-2 text-caption" pressed={$filterNotReady} onPressedChange={() => actions.toggleFilterNotReady()}>{$t.editor.notReady(data.songCount - data.readyCount)}</Toggle>
{/snippet}

<SongFilterPanel
  id="desktop-setlist-filters"
  open={$filterOpen}
  mobile={$mobile}
  onopenchange={o => actions.patch({ filterOpen: o })}
  search={$filterText}
  onsearch={filterText => actions.patch({ filterText })}
  {people}
  {extras}
  class="gap-2 border-b bg-bar-bg px-4 py-2"
/>

<!-- Mobile bottom bar: filter + drag | ➕ (centre) | comment, edit + stage. -->
<div class="fixed right-0 bottom-0 left-0 z-21 hidden safe-bar-lg grid-cols-[1fr_auto_1fr] items-center gap-2 border-t bg-card px-2 max-mid:grid">
  <div class="flex justify-end gap-2">
    <IconButton icon="🎛️" label={$t.editor.filter} class={pressedOn} pressed={$filterOpen || data.isFiltered} onpressedchange={() => actions.toggleFilterOpen()} />
    {#if $canWrite}
      <IconButton icon="⠿" label={$t.common.dragMode} class={pressedOn} pressed={$dragEnabled} onpressedchange={() => dragModeStore.getState().toggle()} />
    {/if}
  </div>
  <div>{#if $canWrite}<EditorActionsMenu />{/if}</div>
  <div class="flex justify-start gap-2">
    <EditorMetaButtons />
    <IconButton icon="🎤" label={$t.editor.stageView} variant="secondary" class="no-tint size-10 border-0 bg-clip-border" href="{base}/setlists/{$setlistId}/stage" />
  </div>
</div>
