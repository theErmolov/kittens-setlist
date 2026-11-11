<script lang="ts">
  /**
   * Song filter of the rehearsal detail page, laid out like the setlist editor's (EditorFilters): on mid/big an expanding bar under the
   * top navigation (people, then search + sorting), on small a compact bottom drawer. Participants are an AND filter of the song rows.
   */
  import { Toggle } from '$components/ui/toggle';
  import { Input } from '$components/ui/input';
  import { Separator } from '$components/ui/separator';
  import * as Drawer from '$components/ui/drawer';
  import { chip } from '$components/setlist/classes';
  import { t } from '$lib/i18n';
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

{#snippet group(list: string[], guest: boolean)}
  <div class="flex flex-wrap gap-1.5">
    {#each list as name (name)}
      <Toggle class="{chip} h-7 px-2 text-[0.75rem] {guest ? 'border-dashed' : ''}" pressed={$participantFilter.includes(name)} onPressedChange={() => actions.toggleParticipant(name)}>{name} ({counts[name] ?? 0})</Toggle>
    {/each}
  </div>
{/snippet}

{#snippet sorting()}
  <Toggle class="{chip} h-7 px-2 text-[0.75rem]" pressed={$readinessFirst} onPressedChange={() => actions.patch({ readinessFirst: !$readinessFirst })}><span aria-hidden="true">📉</span> {$rt.leastReadyFirst}</Toggle>
{/snippet}

<!-- Mid and big: the filter expands the bar under the top navigation. -->
<div class="shrink-0 flex-col gap-2 border-b bg-card px-4 py-2 max-mid:hidden {$filterOpen ? 'flex' : 'hidden'}">
  {#if names.length > 0 || guests.length > 0}
    <div class="flex flex-wrap items-center gap-1.5">
      {@render group(names, false)}
      {#if guests.length > 0}
        <Separator orientation="vertical" class="h-6 self-center" />
        {@render group(guests, true)}
      {/if}
    </div>
  {/if}
  <div class="flex flex-wrap items-center gap-1.5">
    <Input class="w-[220px] bg-transparent" type="search" placeholder={$t.editor.search} aria-label={$t.editor.search} value={$filterText} oninput={e => actions.patch({ filterText: e.currentTarget.value })} />
    {@render sorting()}
  </div>
</div>

<!-- Small screens: a compact bottom drawer with the same filters. -->
<Drawer.Root open={$filterOpen && $mobile} onOpenChange={o => actions.patch({ filterOpen: o })} shouldScaleBackground={false}>
  <Drawer.Content onOpenAutoFocus={e => e.preventDefault()}>
    <Drawer.Header class="p-2">
      <Drawer.Title class="text-sm">{$t.editor.filter}</Drawer.Title>
    </Drawer.Header>
    <div class="mx-auto flex max-h-[70dvh] w-full max-w-2xl flex-col gap-2 overflow-y-auto px-3 pb-3">
      <Input class="w-full bg-transparent" type="search" placeholder={$t.editor.searchFull} aria-label={$t.editor.searchFull} value={$filterText} oninput={e => actions.patch({ filterText: e.currentTarget.value })} />
      <Separator class="my-0.5" />
      {#if names.length > 0}{@render group(names, false)}{/if}
      {#if guests.length > 0}
        <Separator class="my-0.5" />
        {@render group(guests, true)}
      {/if}
      {#if names.length > 0 || guests.length > 0}<Separator class="my-0.5" />{/if}
      <div class="flex flex-wrap gap-1.5">{@render sorting()}</div>
    </div>
  </Drawer.Content>
</Drawer.Root>
