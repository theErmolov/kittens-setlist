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
    class="flex-wrap gap-[5px]"
    value={$selectedMusician && names.includes($selectedMusician) ? $selectedMusician : ''}
    onValueChange={(v) => { const next = v || $selectedMusician; if (next) actions.toggleMusician(next); }}
  >
    {#each names as name}
      <ToggleGroup.Item value={name} class="{chip} {guest ? 'border-dashed' : ''}">{name} ({data.musicianCounts[name] ?? 0})</ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
{/snippet}

<div id="desktop-setlist-filters" class="shrink-0 flex-wrap items-center gap-[5px] border-b px-4 py-2 max-[700px]:hidden {$filterOpen ? 'flex' : 'hidden'}">
  <Input class="w-[140px] rounded-full bg-transparent" type="search" placeholder={$t.editor.search} aria-label={$t.editor.search} value={$filterText} oninput={(e) => actions.patch({ filterText: e.currentTarget.value })} />
  {@render musicianGroup(data.allMusicians, false)}
  {#if data.guestNames.length > 0}
    <Separator orientation="vertical" class="h-6 self-center" />
    {@render musicianGroup(data.guestNames, true)}
  {/if}
  {#if data.allMusicians.length > 0 || data.guestNames.length > 0}
    <Separator orientation="vertical" class="h-6 self-center" />
  {/if}
  <Toggle class={chip} pressed={$filterNotReady} onPressedChange={() => actions.toggleFilterNotReady()}>{$t.editor.notReady(data.songCount - data.readyCount)}</Toggle>
</div>

<!-- Mobile filter panel: bottom drawer above the bottom bar -->
<Drawer.Root open={$filterOpen && $mobile} onOpenChange={(o) => actions.patch({ filterOpen: o })} shouldScaleBackground={false}>
  <Drawer.Content onOpenAutoFocus={(e) => e.preventDefault()}>
    <Drawer.Header class="pb-0 text-left">
      <Drawer.Title>🎛️ {$t.editor.filter}</Drawer.Title>
    </Drawer.Header>
    <div class="flex max-h-[65dvh] flex-col gap-2.5 overflow-y-auto p-3">
      <Input class="w-full bg-transparent" type="search" placeholder={$t.editor.searchFull} aria-label={$t.editor.searchFull} value={$filterText} oninput={(e) => actions.patch({ filterText: e.currentTarget.value })} />
      <Separator />
      {#if data.allMusicians.length > 0}
        {@render musicianGroup(data.allMusicians, false)}
      {/if}
      {#if data.guestNames.length > 0}
        <Separator />
        {@render musicianGroup(data.guestNames, true)}
      {/if}
      {#if data.allMusicians.length > 0 || data.guestNames.length > 0}
        <Separator />
      {/if}
      <div class="flex flex-wrap gap-2">
        <Toggle class={chip} pressed={$filterNotReady} onPressedChange={() => actions.toggleFilterNotReady()}>{$t.editor.notReady(data.songCount - data.readyCount)}</Toggle>
      </div>
    </div>
  </Drawer.Content>
</Drawer.Root>

<!-- Mobile bottom bar -->
<div class="fixed right-0 bottom-0 left-0 z-[21] hidden h-16 items-center gap-2 border-t bg-card px-2 max-[700px]:flex">
  <IconButton icon="🎛️" label={$t.editor.filter} class={pressedOn} pressed={$filterOpen || data.isFiltered} onpressedchange={() => actions.toggleFilterOpen()} />
  {#if $canWrite}
    <IconButton icon="⠿" label={$t.common.dragMode} class={pressedOn} pressed={$dragEnabled} onpressedchange={() => dragModeStore.getState().toggle()} />
  {/if}
  <IconButton class="ml-auto" icon="🎤" label={$t.editor.stageView} href="{base}/setlists/{$setlistId}/stage" />
  {#if $canWrite}
    <EditorActionsMenu />
  {:else}
    <EditorMetaButtons edit={false} />
  {/if}
</div>
