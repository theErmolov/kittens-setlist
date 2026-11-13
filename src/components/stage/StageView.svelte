<script lang="ts" generics="T">
  /**
   * The one stage layout, used by the setlist stage (SetlistStage) and the rehearsal page: an edge-to-edge column whose compact
   * header sticks under the global nav, a list of rows (optionally grouped into coloured sets) and the lyrics overlay.
   * It owns the look only; the caller owns the data and plugs in the header content, the filter panel and the rows through snippets.
   * `overflow-x: clip` (never hidden) keeps the sticky header working.
   */
  import type { Snippet } from 'svelte';
  import type { Song } from '$lib/types';
  import { base } from '$app/paths';
  import { t } from '$lib/i18n';
  import { pressedOn } from '../setlist/classes';
  import IconButton from '$components/shared/IconButton.svelte';
  import { Badge } from '$components/ui/badge';
  import * as Item from '$components/ui/item';
  import * as Empty from '$components/ui/empty';
  import LyricsOverlay from './LyricsOverlay.svelte';

  let {
    backHref, backLabel, title, meta, actions, headerExtra, filterPanel, banner, footer,
    items, itemKey, groupOf, row, emptyText,
    filterOpen, filterActive, filterCount = 0, ontogglefilter, mobileBar = false, lyrics = null,
  }: {
    backHref: string;
    backLabel: string;
    /** Header content right of the back button (grows). */
    title: Snippet;
    /** Header content between the title and the buttons (clock, progress badge). */
    meta?: Snippet;
    /** Extra header buttons after the filter button. */
    actions?: Snippet;
    /** Header content under the button row. */
    headerExtra?: Snippet;
    /** Expanding filter panel under the header row (the caller decides when it is shown). */
    filterPanel?: Snippet;
    /** Content between the header and the list (alerts, info strip). */
    banner?: Snippet;
    /** Fixed/portal parts after the list (filter drawer, bottom bar). */
    footer?: Snippet;
    items: T[];
    itemKey: (item: T) => string;
    /** Items with the same group id sit under one heading with a coloured stripe. */
    groupOf?: (item: T) => { id: string; name?: string } | undefined;
    row: Snippet<[T, number]>;
    /** Shown when there are no items. */
    emptyText?: string;
    filterOpen: boolean;
    /** A filter is applied (the button looks pressed). */
    filterActive: boolean;
    /** Number of applied filters (badge on the button). */
    filterCount?: number;
    ontogglefilter: () => void;
    /** Small screens use a fixed bottom bar and drawer for the filters instead of the header button. */
    mobileBar?: boolean;
    lyrics?: { song: Song; onclose: () => void; onsavetranspose?: (song: Song) => Promise<Song> } | null;
  } = $props();
</script>

<div class="stage flex min-h-screen max-w-full flex-col overflow-x-clip bg-background">
  <div class="stage-header sticky top-14 z-10 flex flex-col gap-0.5 border-b bg-card px-2 py-1 shadow-sm">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <IconButton icon="←" label={backLabel} href={backHref} />
      {@render title()}
      {@render meta?.()}
      <IconButton icon="🎛️" label={$t.stage.filters} text={$t.stage.filters} class="no-tint relative shrink-0 {mobileBar ? 'hidden min-mid:inline-flex' : 'inline-flex'} {pressedOn}" pressed={filterOpen || filterActive} expanded={filterOpen} onpressedchange={() => ontogglefilter()}>
        {#if filterCount > 0}<Badge class="absolute top-0 right-0 h-4 min-w-4 justify-center px-1 text-micro">{filterCount}</Badge>{/if}
      </IconButton>
      {@render actions?.()}
    </div>
    {@render headerExtra?.()}
    {@render filterPanel?.()}
  </div>

  {@render banner?.()}

  <div class="song-list flex flex-col {mobileBar ? 'max-mid:pb-[calc(4rem+env(safe-area-inset-bottom))]' : ''}">
    {#each items as item, i (itemKey(item))}
      {@const group = groupOf?.(item)}
      {@const prevGroup = i > 0 ? groupOf?.(items[i - 1]) : undefined}
      {#if group?.name && group.id !== prevGroup?.id}
        <Item.Title class="px-2 py-0.5 text-small font-bold text-set-accent"><span class="no-tint" aria-hidden="true">⏭</span> {group.name}</Item.Title>
      {/if}
      <div class={group ? 'border-l-[3px] border-set-accent' : ''}>
        {@render row(item, i)}
      </div>
    {/each}
    {#if items.length === 0 && emptyText}
      <Empty.Root class="mx-2 my-6 flex-none">
        <Empty.Header><Empty.Title class="text-base font-normal text-muted-foreground">{emptyText}</Empty.Title></Empty.Header>
      </Empty.Root>
    {/if}
  </div>

  {@render footer?.()}

  {#if lyrics}
    <LyricsOverlay song={lyrics.song} onclose={lyrics.onclose} onsavetranspose={lyrics.onsavetranspose} />
  {/if}
</div>
