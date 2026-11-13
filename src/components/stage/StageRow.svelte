<script lang="ts">
  /**
   * Presentational song row of the stage layout, shared by the stage view (StageSong) and the rehearsal page.
   * Mobile: 3-col grid [meta spans all rows] | [title / comment / musicians] | [time]; desktop: 4-col grid [meta] [info] [comment] [musicians].
   * The parent owns state: it passes the roster cells, the comment content and every handler.
   */
  import type { Snippet } from 'svelte';
  import type { ClassValue } from 'svelte/elements';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import IconButton from '$components/shared/IconButton.svelte';
  import PctBadge from '$components/shared/PctBadge.svelte';
  import { Badge } from '$components/ui/badge';
  import * as Item from '$components/ui/item';
  import { t } from '$lib/i18n';
  import { cn, sortInstruments, INSTRUMENT_ICONS } from '$lib/utils';
  import type { Instrument, Song } from '$lib/types';

  export interface RosterCell {
    name: string;
    instruments: Instrument[];
    /** Stage view: the selected musician's cells. */
    highlight?: boolean;
    /** Colour classes of the pill (rehearsal: learning stage, see STAGE_BADGE). */
    tone?: string;
    /** Not coming (rehearsal): greyed out and inert. */
    off?: boolean;
    guest?: boolean;
    label?: string;
    onclick?: (anchor: HTMLElement) => void;
  }

  let {
    song, position, startTime, played = false, interactive = false, onclick: ontoggle, onlyrics,
    cells, pct, pctTitle, hasComment = false, comment, lead, rowClass, rowProps, actions, endActions, titleLabel, leadActive = true,
  }: {
    song: Song;
    position: number;
    startTime?: string;
    played?: boolean;
    /** The row is a toggle button (stage: mark played). */
    interactive?: boolean;
    onclick?: () => void;
    onlyrics?: () => void;
    cells: RosterCell[];
    /** Readiness percent (rehearsal); undefined = no badge, null = dash. */
    pct?: number | null;
    pctTitle?: string;
    /** Whether `comment` has content (so the mobile row does not reserve space). */
    hasComment?: boolean;
    /** Comment content: one element, placed under the title on small screens and in its own column from mid up. */
    comment?: Snippet;
    /** The leftmost element of the row (drag handle). */
    lead?: Snippet;
    /** Whether `lead` is shown (the column is only reserved while it is). */
    leadActive?: boolean;
    rowClass?: ClassValue;
    rowProps?: Record<string, unknown>;
    /** Extra buttons (note, row menu): stacked under the lyrics button on small screens, left of it in the comment column from mid up. */
    actions?: Snippet;
    titleLabel?: string;
    /** Desktop: buttons in their own column at the far right, after the musicians (rehearsal: remove). On small screens they stack with `actions`. */
    endActions?: Snippet;
  } = $props();
  const hasLead = $derived(!!lead && leadActive);
</script>

<Item.Root
  class={cn(
    'stage-song group/song grid w-full grid-cols-[44px_1fr_auto] grid-rows-[auto_auto_auto] items-stretch gap-0 overflow-hidden rounded-none border-x-0 border-t-0 border-b border-border bg-stage-item-bg p-0 text-left transition-[background,opacity]',
    'min-mid:min-h-12 min-mid:grid-cols-[64px_1.66fr_1.49fr_1.75fr] min-mid:grid-rows-[1fr]',
    hasLead && 'max-mid:grid-cols-[64px_1fr_auto]',
    hasLead && !endActions && 'min-mid:grid-cols-[84px_1.66fr_1.49fr_1.75fr]',
    endActions && (hasLead ? 'min-mid:grid-cols-[84px_1.66fr_1.49fr_1.75fr_auto]' : 'min-mid:grid-cols-[64px_1.66fr_1.49fr_1.75fr_auto]'),
    played && 'opacity-45',
    interactive ? 'cursor-pointer min-mid:hover:bg-(--row-hover)' : 'cursor-default',
    rowClass,
  )}
  data-played={played ? 'true' : undefined}
  role={interactive ? 'button' : undefined}
  tabindex={interactive ? 0 : undefined}
  aria-pressed={interactive ? played : undefined}
  aria-label={interactive ? titleLabel : undefined}
  onclick={() => ontoggle?.()}
  onkeydown={(e) => { if (interactive && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ontoggle?.(); } }}
  {...rowProps}
>
  <!-- position + category (+ readiness, drag handle, lyrics button on mobile) -->
  <Item.Media class="col-start-1 row-span-3 flex-row items-stretch justify-start gap-0 self-stretch group-has-data-[slot=item-description]/item:self-stretch min-mid:row-span-1">
    <!-- the drag handle (rehearsal) is the leftmost element -->
    {#if hasLead}<div class="flex w-6 shrink-0 items-center justify-center self-stretch">{@render lead?.()}</div>{/if}
    <div class="flex min-w-0 flex-1 flex-col items-stretch justify-start">
      <div class="flex flex-col items-center gap-0.5 px-0.5 py-1 min-mid:flex-1 min-mid:justify-center min-mid:px-1 min-mid:py-0.5">
        <span class="text-body leading-none font-bold text-muted-foreground min-mid:text-lead">{position}</span>
        <CategoryBadge category={song.category} iconOnly />
        <!-- song readiness (rehearsal) sits right below the type -->
        {#if pct !== undefined}<PctBadge value={pct} class="h-4 text-micro" title={pctTitle} />{/if}
      </div>
      {#if song.lyrics && onlyrics}
        <IconButton variant="secondary" icon="📝" label={$t.common.lyrics} class="no-tint h-auto min-h-10 w-full flex-1 rounded-none text-2xl min-mid:hidden" onclick={(e) => { e.stopPropagation(); onlyrics?.(); }} />
      {/if}
      {#if actions || endActions}<div class="flex flex-col items-stretch min-mid:hidden">{@render actions?.()}{@render endActions?.()}</div>{/if}
    </div>
  </Item.Media>

  <!-- title + artist -->
  <Item.Content class="col-start-2 row-start-1 min-w-0 flex-row flex-wrap content-start items-baseline gap-x-1 gap-y-0 px-1.5 py-1 min-mid:flex-col min-mid:flex-nowrap min-mid:justify-center min-mid:gap-0 min-mid:px-3 min-mid:py-0.5">
    <Item.Title class={cn('line-clamp-none w-auto text-base leading-snug font-bold min-mid:text-[1.8rem] min-mid:leading-compact', played && 'line-through decoration-2')}>{song.title}</Item.Title>
    <div class="contents min-mid:flex min-mid:items-center min-mid:gap-2">
      <Item.Description class={cn("line-clamp-none text-body before:mr-0.5 before:content-['·'] min-mid:text-body", played && 'line-through decoration-2')}>{song.artist}</Item.Description>
    </div>
  </Item.Content>

  <!-- start time (mobile) -->
  <Item.Actions class="col-start-3 row-start-1 py-1 pr-1.5 pl-1 min-mid:hidden">
    {#if startTime}<span class="text-small font-semibold whitespace-nowrap text-primary-ink">{startTime}</span>{/if}
  </Item.Actions>

  <!-- comment (mobile: under the title) + lyrics and extra buttons (desktop) -->
  <div class={cn('col-span-2 col-start-2 row-start-2 flex min-w-0 items-stretch min-mid:col-span-1 min-mid:col-start-3 min-mid:row-start-1', !hasComment && 'max-mid:hidden')}>
    <div class="min-w-0 flex-1 self-center px-1.5 pb-0.5 text-small leading-snug font-medium break-words whitespace-normal text-foreground min-mid:px-3 min-mid:py-0.5 min-mid:text-body-lg min-mid:font-medium">{@render comment?.()}</div>
    <div class="flex items-stretch max-mid:hidden">
      {#if actions}<div class="flex items-stretch">{@render actions()}</div>{/if}
      {#if song.lyrics && onlyrics}
        <IconButton variant="secondary" icon="📝" label={$t.common.lyrics} class={cn('no-tint h-auto min-h-full w-16 shrink-0 self-stretch rounded-none text-glyph', !actions && 'ml-2')} onclick={(e) => { e.stopPropagation(); onlyrics?.(); }} />
      {/if}
    </div>
  </div>

  <!-- musicians (+ desktop start time) -->
  <div class="col-span-2 col-start-2 row-start-3 flex min-mid:col-span-1 min-mid:col-start-4 min-mid:row-start-1 min-mid:items-center min-mid:gap-2 min-mid:px-3 min-mid:py-0.5">
    <div class="grid min-w-0 flex-1 grid-cols-3 gap-x-1 gap-y-px px-1.5 pt-0 pb-1 text-small text-muted-foreground min-mid:p-0">
      {#each cells as cell (cell.name)}
        {@const cls = cn(
          'w-full min-w-0 justify-start gap-1 border-0 bg-transparent px-1.5 py-px pl-0.75 text-small font-normal',
          !cell.tone && cell.instruments.length > 0 && (cell.highlight ? 'bg-stage-person-hi font-semibold text-stage-person-hi-ink' : 'bg-stage-person-bg text-stage-person-ink'),
          cell.tone && cn(cell.tone, 'dark:text-stage-cell-ink'),
          cell.guest && 'border border-dashed border-border',
          cell.onclick && 'min-h-7 cursor-pointer hover:brightness-95',
          cell.off && 'pointer-events-none opacity-40 grayscale',
        )}
        {#snippet body()}
          {#if cell.instruments.length}<span class="flex shrink-0 flex-row flex-nowrap items-center gap-px text-[1.17rem] leading-[1.1]">
            {#each sortInstruments(cell.instruments) as inst (inst)}<span>{INSTRUMENT_ICONS[inst]}</span>{/each}
          </span>
          <span class="min-w-0 flex-1 overflow-hidden whitespace-nowrap [mask-image:linear-gradient(to_right,black_calc(100%-16px),transparent_100%)]">{cell.name}</span>{/if}
        {/snippet}
        {#if cell.onclick}
          <Badge
            variant="secondary"
            role="button"
            tabindex={cell.off ? -1 : 0}
            aria-disabled={cell.off}
            aria-label={cell.label}
            class={cls}
            onclick={(e: MouseEvent) => { e.stopPropagation(); if (!cell.off) cell.onclick?.(e.currentTarget as HTMLElement); }}
            onkeydown={(e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && !cell.off) { e.preventDefault(); e.stopPropagation(); cell.onclick?.(e.currentTarget as HTMLElement); } }}
          >{@render body()}</Badge>
        {:else}
          <Badge variant="secondary" class={cls}>{@render body()}</Badge>
        {/if}
      {/each}
    </div>
    {#if startTime}<span class="hidden shrink-0 text-body-lg font-bold text-primary-ink min-mid:inline">{startTime}</span>{/if}
  </div>

  <!-- far-right control buttons (desktop) -->
  {#if endActions}
    <div class="hidden items-stretch min-mid:col-start-5 min-mid:row-start-1 min-mid:flex">{@render endActions()}</div>
  {/if}
</Item.Root>
