<script lang="ts">
  /**
   * One song row of the shared song table (setlist editor + rehearsal page).
   * Presentational: the parent owns state, drag handling and mutations and plugs
   * them in through `rowProps` / snippets. Must live inside a shadcn `Table.Root`
   * (see ./classes.ts for the shared table / header classes).
   */
  import type { Snippet } from 'svelte';
  import type { ClassValue, HTMLAttributes } from 'svelte/elements';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { Badge } from '$components/ui/badge';
  import { colMeta } from './songColumns';
  import { FlexRender } from '$components/ui/data-table';
  import type { Row } from '@tanstack/table-core';
  import PctBadge from '$components/shared/PctBadge.svelte';
  import RowActions, { type RowAction } from '$components/shared/RowActions.svelte';
  import IconButton from '$components/shared/IconButton.svelte';
  import * as Table from '$components/ui/table';
  import * as Tooltip from '$components/ui/tooltip';
  import type { Song, Instrument, LearningStage } from '$lib/types';
  import { t } from '$lib/i18n';
  import { cn, sortInstruments, INSTRUMENT_ICONS } from '$lib/utils';
  import { STAGE_TONE, toneStyle, toneBg } from '$lib/palette';

  const tone = (stage: LearningStage) => STAGE_TONE[stage] ?? 'neutral';

  let {
    row, song, number, pct, pctTitle, played = false, stageOf, permanentNames, bubbleMusicians,
    time, rowClass, rowProps, dragCell, dragCellProps, onlyrics, ontitle, titleLabel, titleDisabled = false,
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
    blockOver ? 'bg-muted'
    : flags.has('subset-active-member') ? 'bg-muted'
        : 'bg-card min-[1102px]:group-hover/row:bg-(--row-hover)',
  );
  const cellState = $derived(cn(
    flags.has('dragging') || flags.has('subset-block-dragging') ? 'opacity-35' : played ? 'opacity-45' : '',
    flags.has('drag-over') && 'bg-muted ring-1 ring-inset ring-border',
  ));
  const cell = $derived(cn('py-0.5 max-[1101px]:px-2 max-[1101px]:py-[7px] max-[1101px]:border-t max-[1101px]:border-border', cellBg, cellState));
  const strike = $derived(played ? 'line-through' : '');

  const guestTags = $derived(
    Object.entries(song.musicians)
      .filter(([name, role]) => !permanent.has(name) && role.instruments.length > 0)
      .map(([name, role]) => ({ name, instruments: sortInstruments(role.instruments) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  const bubbles = $derived.by(() => {
    const out: { name: string; instruments: Instrument[]; style: string; isGuest: boolean }[] = [];
    for (const name of bubbleMusicians ?? permanentNames) {
      const role = song.musicians[name];
      if (!role?.instruments?.length) continue;
      const stage = stageOf(name);
      out.push({ name, instruments: sortInstruments(role.instruments), style: toneStyle(tone(stage)), isGuest: false });
    }
    for (const [name, role] of Object.entries(song.musicians)) {
      if (!permanent.has(name) && role.instruments.length > 0) {
        const stage = stageOf(name);
        out.push({ name, instruments: sortInstruments(role.instruments), style: toneStyle(tone(stage)), isGuest: true });
      }
    }
    return out;
  });

  const snippets = { drag: cDrag, num: cNum, time: cTime, song: cSong, m: cMusician, guests: cGuests, actions: cActions } as const;
  /** Index of a musician column among the visible musician columns (striped background). */
  const mIndex = (id: string) => row.getVisibleCells().filter(x => x.column.id.startsWith('m:')).findIndex(x => x.column.id === id);

  const offCls = 'opacity-40 grayscale disabled:opacity-40';
  const tagCls = 'px-2.5 text-[0.89rem] font-medium';
  const bubbleCls = 'min-w-0 gap-[3px] pr-1.5 pl-[3px] text-[0.82rem] font-normal text-muted-foreground max-[1101px]:flex max-[1101px]:w-full';
</script>

{#snippet icons(insts: Instrument[])}{#each insts as inst (inst)}<span>{INSTRUMENT_ICONS[inst]}</span>{/each}{/snippet}

{#snippet nameText()}
  <!-- From 1102px: three lines per row (artist, title, comment below). Small view: "Artist – Title" on one wrapping line, then the comment. -->
  <span class="min-w-0 truncate text-left max-[1101px]:overflow-visible max-[1101px]:whitespace-normal" title="{song.artist} – {song.title}">
    <span class={cn('text-[1.08rem] font-normal min-[1102px]:block min-[1102px]:truncate', strike)}>{song.artist}</span>
    <span class={cn('mx-1 text-muted-foreground min-[1102px]:hidden', strike)}>–</span>
    <span class={cn('title text-[1.08rem] font-semibold min-[1102px]:block min-[1102px]:truncate', strike)}>{song.title}</span>
  </span>
{/snippet}

{#snippet rowButton(label: string, icon: string, run: (el: HTMLElement) => void)}
  <IconButton {icon} {label} onclick={(e) => { e.stopPropagation(); run(e.currentTarget as HTMLElement); }} />
{/snippet}


{#snippet cDrag()}{@render dragCell?.()}{/snippet}
{#snippet cNum()}
    <div class="flex items-center justify-center gap-1.5 min-[1102px]:justify-start">
      <span>{number}</span>
      <PctBadge value={pct} class="min-w-[4.2em] text-[0.68rem]" title={pctTitle} />
    </div>
    <!-- Below 1102px the time column is hidden and the type badge leaves the title: both sit here, inline under the number. -->
    <div class="mt-1.5 flex items-center justify-center gap-1.5 min-[1102px]:justify-start min-[1102px]:hidden">
      {#if time !== undefined}<span class="text-[0.85rem] whitespace-nowrap text-muted-foreground">{time}</span>{/if}
      <span class="[&_[data-slot=badge]]:size-6 [&_[data-slot=badge]]:text-[0.9rem]"><CategoryBadge category={song.category} iconOnly /></span>
    </div>
{/snippet}
{#snippet cTime()}{time}{/snippet}
{#snippet cSong()}
  <div class="relative">
    <!-- Wide view: the type badge is vertically centred beside the artist / title lines; the comment starts right below the badge. -->
    <div class="flex items-center leading-tight">
      <span class="mx-1.5 inline-block shrink-0 text-[0.98em] max-[1101px]:hidden [&_[data-slot=badge]]:h-6"><CategoryBadge category={song.category} iconOnly /></span>
      {#if ontitle}
        <button type="button" class="group/title contents" aria-pressed={played} aria-label={titleLabel} disabled={titleDisabled} onclick={ontitle}>{@render nameText()}</button>
      {:else}
        {@render nameText()}
      {/if}
    </div>
    {#if comment}<div class="min-w-0">{@render comment()}</div>{/if}
    {#if bubbles.length > 0}
      <div class="mt-1.5 hidden gap-1 max-[1101px]:grid max-[1101px]:grid-cols-3">
        {#each bubbles as b}
          {#snippet bubbleBody()}
            <span class="shrink-0 text-base">{@render icons(b.instruments)}</span>
            <span class="min-w-0 flex-1 overflow-hidden whitespace-nowrap [mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent_100%)]">{b.name}</span>
          {/snippet}
          {@const bCls = cn(bubbleCls, b.isGuest && 'border-dashed border-border')}
          {#if oncell}
            <Badge role="button" tabindex={off.has(b.name) ? -1 : 0} aria-disabled={off.has(b.name)} class={cn(bCls, 'cursor-pointer justify-start', off.has(b.name) && offCls)} aria-label={cellLabel?.(b.name)} onclick={e => !off.has(b.name) && oncell(b.name, e.currentTarget)} onkeydown={e => { if ((e.key === 'Enter' || e.key === ' ') && !off.has(b.name)) { e.preventDefault(); oncell(b.name, e.currentTarget); } }} style={b.style}>{@render bubbleBody()}</Badge>
          {:else}
            <Badge class={bCls} style={b.style}>{@render bubbleBody()}</Badge>
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
{#snippet cGuests()}
    <div class="flex flex-wrap items-center gap-1.5">
    {#each guestTags as g}
        {@const gStage = stageOf(g.name)}
        {@const gStyle = toneStyle(tone(gStage))}
        {#if oncell}
          <Badge role="button" tabindex={off.has(g.name) ? -1 : 0} aria-disabled={off.has(g.name)} class={cn(tagCls, 'cursor-pointer hover:brightness-95', off.has(g.name) && offCls)} aria-label={cellLabel?.(g.name)} onclick={e => !off.has(g.name) && oncell(g.name, e.currentTarget)} onkeydown={e => { if ((e.key === 'Enter' || e.key === ' ') && !off.has(g.name)) { e.preventDefault(); oncell(g.name, e.currentTarget); } }} style={gStyle}>{@render icons(g.instruments)} {g.name}</Badge>
        {:else}
          <Badge class={cn(tagCls)} style={gStyle}>{@render icons(g.instruments)} {g.name}</Badge>
        {/if}
    {/each}
    </div>
{/snippet}
{#snippet cActions()}
  <div class="flex flex-col items-end gap-2 min-[1102px]:flex-row min-[1102px]:items-center min-[1102px]:justify-end">
    <RowActions actions={rowActions} />
    <!-- Note / lyrics buttons: under the ⋯ button in the small view, left of it from 701px up. -->
    <div class="flex flex-col items-end gap-2 min-[1102px]:order-first min-[1102px]:flex-row">
      {#if personalNote && onpersonal}{@render rowButton($t.common.personalComment, '🤫', onpersonal)}{/if}
      {#if song.lyrics && onlyrics}{@render rowButton($t.common.lyrics, '📝', () => onlyrics())}{/if}
    </div>
  </div>
{/snippet}

<Table.Row
  class={cn('song-row group/row cursor-default border-0 select-none hover:bg-transparent [&[draggable=true]]:cursor-grab [&[draggable=true]:active]:cursor-grabbing', rowClass, { played })}
  {...rowProps}
>
  {#each row.getVisibleCells() as c (c.id)}
    {@const id = c.column.id}
    {#if id.startsWith('m:')}
      {@const name = id.slice(2)}
      {@const role = song.musicians[name]}
      {@const progBg = (role?.instruments?.length ?? 0) > 0 ? toneBg(tone(stageOf(name))) : null}
      <Table.Cell
        class={cn(cell, colMeta(c.column).cls, progBg && 'min-[1102px]:group-hover/row:bg-inherit', off.has(name) && 'opacity-40 grayscale')}
        style={`${colMeta(c.column).style ?? ''};${progBg ? `background: ${progBg}` : ''}`}
      ><FlexRender content={c.column.columnDef.cell} context={{ ...c.getContext(), snippets }} /></Table.Cell>
    {:else}
      <Table.Cell class={cn(cell, colMeta(c.column).cls)} {...(id === 'drag' ? dragCellProps : {})}><FlexRender content={c.column.columnDef.cell} context={{ ...c.getContext(), snippets }} /></Table.Cell>
    {/if}
  {/each}
</Table.Row>
{#if below}
  <Table.Row class="border-0 hover:bg-transparent"><Table.Cell class="bg-card px-2 py-[7px] whitespace-normal" {colspan}>{@render below()}</Table.Cell></Table.Row>
{/if}
