<script lang="ts">
  import { base } from '$app/paths';
  import { Button } from '$components/ui/button';
  import { Toggle } from '$components/ui/toggle';
  import { Input } from '$components/ui/input';
  import IconButton from '$components/shared/IconButton.svelte';
  import EditorMetaButtons from './EditorMetaButtons.svelte';
  import EditorActionsMenu from './EditorActionsMenu.svelte';
  import { Separator } from '$components/ui/separator';
  import * as ToggleGroup from '$components/ui/toggle-group';
  import * as Drawer from '$components/ui/drawer';
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

{#snippet musicianGroup(names: string[], guest: boolean)}
  <ToggleGroup.Root
    type="single"
    spacing={1}
    class="flex-wrap gap-1.5"
    value={$selectedMusician && names.includes($selectedMusician) ? $selectedMusician : ''}
    onValueChange={(v) => { const next = v || $selectedMusician; if (next) actions.toggleMusician(next); }}
  >
    {#each names as name}
      <ToggleGroup.Item value={name} class="{chip} h-7 px-2 text-[0.75rem] {guest ? 'border-dashed' : ''}">{name} ({data.musicianCounts[name] ?? 0})</ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
{/snippet}

<!-- Mid and big: the filters expand the bar under the top navigation (as in the stage view): search, musicians, guests, "not ready". -->
<div id="desktop-setlist-filters" class="shrink-0 flex-col gap-2 border-b bg-card px-4 py-2 max-mid:hidden {$filterOpen ? 'flex' : 'hidden'}">
  <!-- Line 1: the people (musicians, then guests). Line 2: search + "not ready". -->
  {#if data.allMusicians.length > 0 || data.guestNames.length > 0}
    <div class="flex flex-wrap items-center gap-1.5">
      {@render musicianGroup(data.allMusicians, false)}
      {#if data.guestNames.length > 0}
        <Separator orientation="vertical" class="h-6 self-center" />
        {@render musicianGroup(data.guestNames, true)}
      {/if}
    </div>
  {/if}
  <div class="flex flex-wrap items-center gap-1.5">
    <Input class="w-[220px] bg-transparent" type="search" placeholder={$t.editor.search} aria-label={$t.editor.search} value={$filterText} oninput={(e) => actions.patch({ filterText: e.currentTarget.value })} />
    <Toggle class="{chip} h-7 px-2 text-[0.75rem]" pressed={$filterNotReady} onPressedChange={() => actions.toggleFilterNotReady()}>{$t.editor.notReady(data.songCount - data.readyCount)}</Toggle>
  </div>
</div>

<!-- Small screens: a compact bottom drawer with the same filters. -->
<Drawer.Root open={$filterOpen && $mobile} onOpenChange={(o) => actions.patch({ filterOpen: o })} shouldScaleBackground={false}>
  <Drawer.Content onOpenAutoFocus={(e) => e.preventDefault()}>
    <Drawer.Header class="p-2">
      <Drawer.Title class="text-sm">{$t.editor.filter}</Drawer.Title>
    </Drawer.Header>
    <div class="mx-auto flex max-h-[70dvh] w-full max-w-2xl flex-col gap-2 overflow-y-auto px-3 pb-3">
      <Input class="w-full bg-transparent" type="search" placeholder={$t.editor.searchFull} aria-label={$t.editor.searchFull} value={$filterText} oninput={(e) => actions.patch({ filterText: e.currentTarget.value })} />
      <Separator class="my-0.5" />
      {#if data.allMusicians.length > 0}
        {@render musicianGroup(data.allMusicians, false)}
      {/if}
      {#if data.guestNames.length > 0}
        <Separator class="my-0.5" />
        {@render musicianGroup(data.guestNames, true)}
      {/if}
      {#if data.allMusicians.length > 0 || data.guestNames.length > 0}
        <Separator class="my-0.5" />
      {/if}
      <div class="flex flex-wrap gap-1.5">
        <Toggle class="{chip} h-7 px-2 text-[0.75rem]" pressed={$filterNotReady} onPressedChange={() => actions.toggleFilterNotReady()}>{$t.editor.notReady(data.songCount - data.readyCount)}</Toggle>
      </div>
    </div>
  </Drawer.Content>
</Drawer.Root>

<!-- Mobile bottom bar: filter + drag | ➕ (centre) | comment, edit + stage. -->
<div class="fixed right-0 bottom-0 left-0 z-[21] hidden h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t bg-card px-2 max-mid:grid">
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
