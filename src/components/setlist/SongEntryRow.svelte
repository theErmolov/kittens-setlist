<script lang="ts">
  /**
   * One song row of the shared song table (setlist editor + rehearsal page).
   * Presentational: the parent owns state, drag handling and mutations and plugs
   * them in through `rowProps` / snippets. Must live inside a shadcn `Table.Root`
   * (see ./classes.ts for the shared table / header classes).
   */
  import type { Snippet } from 'svelte';
  import SongName from '$components/shared/SongName.svelte';
  import type { ClassValue, HTMLAttributes } from 'svelte/elements';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { Badge } from '$components/ui/badge';
  import { colMeta } from './songColumns';
  import { FlexRender } from '$components/ui/data-table';
  import type { Row } from '@tanstack/table-core';
  import PctBadge from '$components/shared/PctBadge.svelte';
  import RowActions, { type RowAction } from '$components/shared/RowActions.svelte';
  import GuestBadge from '$components/shared/GuestBadge.svelte';
  import IconButton from '$components/shared/IconButton.svelte';
  import * as Table from '$components/ui/table';
  import * as Tooltip from '$components/ui/tooltip';
  import type { Song, Instrument, LearningStage } from '$lib/types';
  import { t } from '$lib/i18n';
  import { cn, sortInstruments, INSTRUMENT_ICONS } from '$lib/utils';
  import { STAGE_BADGE, stageCellClass } from '$lib/palette';

  const tone = (stage: LearningStage) => STAGE_BADGE[stage] ?? STAGE_BADGE.queue;

  let {
    row, song, number, pct, pctTitle, played = false, stageOf, permanentNames, bubbleMusicians,
    time, rowClass, rowProps, dragCell, dragCellProps, onlyrics, titleFirst = false, ontitle, titleLabel, titleDisabled = false,
    extras, comment, rowActions = [], below, colspan, disabledMusicians = [], oncell, cellLabel, personalNote, onpersonal,
  }: {
    /** The TanStack row of the song table (its visible cells render through the column defs). */
    row: Row<any>;
    song: Song;
    /** Ordinal shown in the number column. */
    number: number;
    /** Readiness bubble value; null renders a muted dash. */
    pct: number | null;
    pctTitle?: string;
    /** Strike-through + dim (rehearsal: song already played). */
    played?: boolean;
    /** Learning stage of a musician for this row (song snapshot + entry progress, or rehearsal progress). */
    stageOf: (name: string) => LearningStage;
    /** Registered musicians; any other musician on the song is shown as a guest tag. */
    permanentNames: string[];
    /** Registered musicians shown as mobile bubbles (defaults to permanentNames). */
    bubbleMusicians?: string[];
    /** Start time text; undefined = no time column. */
    time?: string;
    /**
     * State markers of the row. Understood: `dragging`, `drag-over`, `subset-member`, `subset-active-member`,
     * `subset-block-dragging`, `subset-block-over` (they drive the cell colours / opacity / outline).
     */
    rowClass?: ClassValue;
    /** Extra attributes/handlers for the <tr> (draggable, data-*, onclick, ondragstart...). */
    rowProps?: HTMLAttributes<HTMLTableRowElement> & Record<string, unknown>;
    /** Content of the drag cell (handle, quick-set indicator...). */
    dragCell?: Snippet;
    dragCellProps?: HTMLAttributes<HTMLTableCellElement>;
    /** Shows the lyrics button when the song has lyrics. */
    onlyrics?: () => void;
    /** Stage-view layout of the title cell: bold title, the artist below it (all tiers), instead of «artist – title». */
    titleFirst?: boolean;
    /** When set, the song name becomes a button (rehearsal: toggle played). */
    ontitle?: () => void;
    titleLabel?: string;
    titleDisabled?: boolean;
    /** Rendered inline to the right of the title (wraps under it on mobile): the entry comment. */
    comment?: Snippet;
    /** Rendered below the name and the mobile bubbles (comment input, notes, hints). */
    extras?: Snippet;
    /** Items of the row's «⋯» actions menu. */
    rowActions?: RowAction[];
    /** Rendered in an extra full-width row right after this one (rehearsal details). */
    below?: Snippet;
    /** Column count of the table, needed for `below`. */
    colspan?: number;
    /** Musicians greyed out (rehearsal: not coming). */
    disabledMusicians?: string[];
    /** When set, a musician's cell / bubble / guest tag is clickable (rehearsal: pick readiness level). */
    oncell?: (name: string, anchor: HTMLElement) => void;
    /** Personal (private) note; with `onpersonal` it gets a 🤫 button next to the lyrics button. */
    personalNote?: string;
    onpersonal?: (anchor: HTMLElement) => void;
    cellLabel?: (name: string) => string;
  } = $props();

  const permanent = $derived(new Set(permanentNames));
  const off = $derived(new Set(disabledMusicians));

  // ── Row state → cell classes (every colour/opacity lives on the cells so the rows can be rounded cards) ──
  const flags = $derived(new Set(cn(rowClass).split(/\s+/).filter(Boolean)));
  const blockOver = $derived(flags.has('subset-block-over'));
  const cellBg = $derived(
    blockOver ? 'tint-set-header-bg'
    : flags.has('subset-active-member') ? 'tint-set-member-hover-bg'
    : flags.has('subset-member') ? 'tint-set-member-bg min-mid:group-hover/row:tint-set-member-hover-bg'
        : 'bg-card min-mid:group-hover/row:bg-(--row-hover)',
  );
  const cellFade = $derived(flags.has('dragging') || flags.has('subset-block-dragging') ? 'opacity-35' : played ? 'opacity-45' : '');
  const cellBase = 'border-t border-border py-0 max-mid:px-2 max-mid:py-1.75 [&:has(+td:last-child)]:border-r-0';
  const cell = $derived(cn(cellBase, cellBg, cellFade, flags.has('drag-over') && 'bg-muted ring-1 ring-inset ring-border'));
  /** A musician cell coloured by learning stage: the stage tint always wins (no zebra / hover / drag-over fill), only the ring shows. */
  const stageCell = $derived(cn(cellBase, cellFade, flags.has('drag-over') && 'ring-1 ring-inset ring-border'));
  const strike = $derived(played ? 'line-through' : '');

  const guestTags = $derived(
    Object.entries(song.musicians)
      .filter(([name, role]) => !permanent.has(name) && role.instruments.length > 0)
      .map(([name, role]) => ({ name, instruments: sortInstruments(role.instruments) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  const bubbles = $derived.by(() => {
    const out: { name: string; instruments: Instrument[]; tone: string; isGuest: boolean }[] = [];
    for (const name of bubbleMusicians ?? permanentNames) {
      const role = song.musicians[name];
      if (!role?.instruments?.length) continue;
      const stage = stageOf(name);
      out.push({ name, instruments: sortInstruments(role.instruments), tone: tone(stage), isGuest: false });
    }
    for (const [name, role] of Object.entries(song.musicians)) {
      if (!permanent.has(name) && role.instruments.length > 0) {
        const stage = stageOf(name);
        out.push({ name, instruments: sortInstruments(role.instruments), tone: tone(stage), isGuest: true });
      }
    }
    return out;
  });

  const snippets = { drag: cDrag, num: cNum, time: cTime, song: cSong, m: cMusician, actions: cActions } as const;
  /** Index of a musician column among the visible musician columns (striped background). */
  const mIndex = (id: string) => row.getVisibleCells().filter(x => x.column.id.startsWith('m:')).findIndex(x => x.column.id === id);

  /** Row buttons that stretch to the cell: share its height when stacked, full height in a row. */
  const cellBtn = 'h-auto min-h-10 w-10 flex-1 basis-0 rounded-none border-0 border-primary/30 bg-clip-border min-mid:flex-none min-mid:basis-auto';
  const offCls = 'opacity-40 grayscale disabled:opacity-40';
  const tagCls = 'px-2 text-small font-medium';
  const bubbleCls = 'min-w-0 gap-0.75 pr-1.5 pl-0.75 text-small font-normal text-muted-foreground max-mid:flex max-mid:w-full';
</script>

{#snippet icons(insts: Instrument[])}{#each insts as inst (inst)}<span>{INSTRUMENT_ICONS[inst]}</span>{/each}{/snippet}

{#snippet nameText()}
  {#if titleFirst}
    <span class="flex min-w-0 flex-col text-left leading-tight" title="{song.artist} – {song.title}">
      <span class={cn('title truncate text-base leading-snug font-bold', strike)}>{song.title}</span>
      <span class={cn('truncate text-body text-muted-foreground', strike)}>{song.artist}</span>
    </span>
  {:else}
  <!-- The app-wide song format on every tier: "Artist – Title" on one line (wrapping on the small tier), then the comment. -->
  <SongName artist={song.artist} title={song.title} {strike} titleClass="title" class="truncate text-left max-mid:overflow-visible max-mid:whitespace-normal" />
  {/if}
{/snippet}

{#snippet guestTagsList()}
  <!-- Guests (not in the roster) sit as tags right of the title, highlighted by learning stage (background only); the small view shows them as bubbles instead. -->
  {#each guestTags as g (g.name)}
    <GuestBadge name={g.name} instruments={g.instruments} stage={stageOf(g.name)} disabled={off.has(g.name)} label={cellLabel?.(g.name)} onclick={oncell ? (el) => oncell(g.name, el) : undefined} />
  {/each}
{/snippet}

{#snippet rowButton(label: string, icon: string, run: (el: HTMLElement) => void)}
  <IconButton {icon} {label} variant="secondary" class={cn(cellBtn, 'no-tint border-b last:border-b-0 min-mid:hidden')} onclick={(e) => { e.stopPropagation(); run(e.currentTarget as HTMLElement); }} />
{/snippet}


{#snippet cDrag()}{@render dragCell?.()}{/snippet}
{#snippet cNum()}
  <!-- The small view's cell has no padding of its own so that the lyrics button (titleFirst, as in the stage view) can fill the bottom of the column. -->
  <div class="flex h-full flex-col">
    <div class="max-mid:py-1.75 {titleFirst ? 'max-mid:px-1' : 'max-mid:px-2'} {titleFirst ? 'max-mid:flex max-mid:flex-col max-mid:items-center max-mid:gap-1' : ''}">
      <div class="flex w-full items-center justify-center gap-1 min-mid:justify-start {titleFirst ? 'max-mid:contents' : ''}">
        <span class="max-mid:order-1">{number}</span>
        <PctBadge value={pct} class="h-5 min-w-[3.4em] max-w-none flex-1 px-0 text-micro whitespace-nowrap min-mid:w-auto {titleFirst ? 'max-mid:order-3' : ''}" title={pctTitle} />
      </div>
      <!-- In the small view the time column is hidden and the type badge leaves the title: both sit here, inline under the number. -->
      <div class="mt-1.5 flex items-center justify-center gap-1.5 min-mid:justify-start min-mid:hidden {titleFirst ? 'max-mid:order-2 max-mid:mt-0' : ''}">
        {#if time !== undefined}<span class="text-body whitespace-nowrap text-muted-foreground">{time}</span>{/if}
        <span class="[&_[data-slot=badge]]:size-6 [&_[data-slot=badge]]:text-body-lg"><CategoryBadge category={song.category} iconOnly /></span>
      </div>
    </div>
    {#if titleFirst && song.lyrics && onlyrics}
      <IconButton variant="secondary" icon="📝" label={$t.common.lyrics} class={cn(cellBtn, 'no-tint w-full border-t min-mid:hidden')} onclick={(e) => { e.stopPropagation(); onlyrics(); }} />
    {/if}
  </div>
{/snippet}
{#snippet cTime()}<span class="block w-full text-center">{time}</span>{/snippet}
{#snippet cSong()}
  {@const nBtn = (personalNote && onpersonal ? 1 : 0) + (song.lyrics && onlyrics ? 1 : 0)}
  <div class="relative pt-1 min-mid:pr-(--btn-pad)" style:--btn-pad={nBtn ? `${nBtn * 48}px` : undefined}>
    <!-- Mid and up: the personal-note and lyrics buttons sit at the right of the title cell, vertically centred (as in the catalog). In the small view they stack in the actions column. -->
    {#if nBtn}
      <div class="absolute top-1/2 right-0 flex -translate-y-1/2 items-center gap-2 max-mid:hidden">
        {#if personalNote && onpersonal}<IconButton class="no-tint" variant="secondary" icon="🤫" label={$t.common.personalComment} onclick={(e) => { e.stopPropagation(); onpersonal(e.currentTarget as HTMLElement); }} />{/if}
        {#if song.lyrics && onlyrics}<IconButton class="no-tint" variant="secondary" icon="📝" label={$t.common.lyrics} onclick={(e) => { e.stopPropagation(); onlyrics(); }} />{/if}
      </div>
    {/if}
    <!-- Wide view: the type badge is vertically centred beside the artist / title lines; the comment starts right below the badge. -->
    <div class="flex items-center leading-tight">
      <span class="mx-1.5 inline-block shrink-0 text-[0.98em] max-mid:hidden [&_[data-slot=badge]]:h-6"><CategoryBadge category={song.category} iconOnly /></span>
      {#if ontitle}
        <button type="button" class="group/title contents" aria-pressed={played} aria-label={titleLabel} disabled={titleDisabled} onclick={ontitle}>{@render nameText()}</button>
      {:else}
        {@render nameText()}
      {/if}
      {#if guestTags.length > 0}<div class="ml-2 flex max-w-[45%] shrink-0 flex-wrap items-center gap-1 max-mid:hidden">{@render guestTagsList()}</div>{/if}
    </div>
    {#if comment}<div class="min-w-0">{@render comment()}</div>{/if}
    {#if bubbles.length > 0}
      <div class="mt-1.5 hidden gap-1 max-mid:grid max-mid:grid-cols-3">
        {#each bubbles as b}
          {#snippet bubbleBody()}
            <span class="shrink-0 text-base">{@render icons(b.instruments)}</span>
            <span class="min-w-0 flex-1 overflow-hidden whitespace-nowrap [mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent_100%)]">{b.name}</span>
          {/snippet}
          {@const bCls = cn(bubbleCls, b.isGuest && 'border-dashed border-border', b.tone)}
          {#if oncell}
            <Badge role="button" tabindex={off.has(b.name) ? -1 : 0} aria-disabled={off.has(b.name)} class={cn(bCls, 'cursor-pointer justify-start', off.has(b.name) && offCls)} aria-label={cellLabel?.(b.name)} onclick={e => !off.has(b.name) && oncell(b.name, e.currentTarget)} onkeydown={e => { if ((e.key === 'Enter' || e.key === ' ') && !off.has(b.name)) { e.preventDefault(); oncell(b.name, e.currentTarget); } }}>{@render bubbleBody()}</Badge>
          {:else}
            <Badge class={bCls}>{@render bubbleBody()}</Badge>
          {/if}
        {/each}
      </div>
    {/if}
    {@render extras?.()}
  </div>
{/snippet}
{#snippet cMusician(name: string)}
    {@const role = song.musicians[name]}
      {#if role?.instruments?.length}
        {@const insts = sortInstruments(role.instruments)}
        {@const slot = '@container flex w-full items-center justify-center leading-none [&>span]:whitespace-nowrap [&>span]:text-[min(1.17rem,calc(92cqw/var(--n,1)/1.25))]'}
        {#if oncell}
          <div role="button" tabindex={off.has(name) ? -1 : 0} aria-disabled={off.has(name)} class="flex min-h-9 w-full cursor-pointer items-center justify-center hover:bg-foreground/5" aria-label={cellLabel?.(name)} onclick={e => !off.has(name) && oncell(name, e.currentTarget)} onkeydown={e => { if ((e.key === 'Enter' || e.key === ' ') && !off.has(name)) { e.preventDefault(); oncell(name, e.currentTarget); } }}><span class={slot} style="--n: {insts.length}">{@render icons(insts)}</span></div>
        {:else}
          <span class={slot} style="--n: {insts.length}">{@render icons(insts)}</span>
        {/if}
      {/if}
{/snippet}
{#snippet cActions()}
  <!-- Closed at the bottom only when it is the last row (the next row or header always brings its own top border). The buttons fill the whole cell, all the same size, with a thin border between them: stacked (⋯, note, lyrics) in the small view; from the mid tier up only the ⋯ is here (note and lyrics sit in the title cell). -->
  <div class="flex h-full flex-col border-t border-border max-mid:border-primary/30 min-mid:flex-row min-mid:items-center min-mid:justify-end min-mid:gap-2">
    <RowActions inline="bare" class={cn(cellBtn, 'border-b last:border-b-0 min-mid:order-last min-mid:border-b-0')} actions={rowActions} />
    {#if personalNote && onpersonal}{@render rowButton($t.common.personalComment, '🤫', onpersonal)}{/if}
    {#if song.lyrics && onlyrics && !titleFirst}{@render rowButton($t.common.lyrics, '📝', () => onlyrics())}{/if}
  </div>
{/snippet}

<Table.Row
  class={cn('song-row group/row cursor-default border-0 select-none hover:bg-transparent draggable:cursor-grab [&[draggable=true]:active]:cursor-grabbing', rowClass, { played })}
  {...rowProps}
>
  {#each row.getVisibleCells() as c (c.id)}
    {@const id = c.column.id}
    {#if id.startsWith('m:')}
      {@const name = id.slice(2)}
      {@const role = song.musicians[name]}
      {@const progBg = (role?.instruments?.length ?? 0) > 0 ? stageCellClass(stageOf(name)) : null}
      <Table.Cell
        class={progBg
          ? cn(stageCell, progBg, colMeta(c.column).cls, off.has(name) && 'opacity-40 grayscale')
          : cn(cell, !blockOver && !flags.has('subset-member') && !flags.has('subset-active-member') && c.getContext().table.getVisibleLeafColumns().filter(x => x.id.startsWith('m:')).findIndex(x => x.id === id) % 2 === 0 && 'bg-table-zebra-bg', colMeta(c.column).cls, off.has(name) && 'opacity-40 grayscale')}
      ><FlexRender content={c.column.columnDef.cell} context={{ ...c.getContext(), snippets }} /></Table.Cell>
    {:else}
      <!-- The buttons column has no line between rows (the buttons have their own borders); every other column does. -->
      <Table.Cell class={cn(cell, colMeta(c.column).cls, id === 'actions' && 'border-t-0')} {...(id === 'drag' ? dragCellProps : {})}><FlexRender content={c.column.columnDef.cell} context={{ ...c.getContext(), snippets }} /></Table.Cell>
    {/if}
  {/each}
</Table.Row>
{#if below}
  <Table.Row class="border-0 hover:bg-transparent"><Table.Cell class="bg-card px-2 py-1.75 whitespace-normal" {colspan}>{@render below()}</Table.Cell></Table.Row>
{/if}
