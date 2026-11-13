<script lang="ts">
  /**
   * A catalog song in the small view, laid out like a setlist row: type badge and "Artist – Title" on top, then the
   * musician chips in the middle, the lyrics button (when there is a text) in the top right corner.
   */
  import { fade } from 'svelte/transition';
  import SongName from '$components/shared/SongName.svelte';
  import type { Song, LearningStage } from '$lib/types';
  import { t } from '$lib/i18n';
  import { cn, sortInstruments, INSTRUMENT_ICONS } from '$lib/utils';
  import { STAGE_BADGE } from '$lib/palette';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import { Badge } from '$components/ui/badge';
  import IconButton from '$components/shared/IconButton.svelte';
  import CatCell from './cells/CatCell.svelte';
  import { guestTags } from './songView';

  let { song, names, onrowclick }: { song: Song; names: string[]; onrowclick: () => void } = $props();

  const flashing = useStore(backlogStore, s => s.flashing);
  const flashAdded = $derived($flashing.has(song.id));
  const chips = $derived([
    ...names.filter(name => song.musicians[name]?.instruments?.length).map(name => ({ name, instruments: sortInstruments(song.musicians[name].instruments), guest: false })),
    ...guestTags(song, names).map(g => ({ ...g, guest: true })),
  ].map(c => ({ ...c, tone: STAGE_BADGE[(song.progress?.[c.name] ?? 'queue') as LearningStage] ?? STAGE_BADGE.queue })));
</script>

<div
  role="button"
  tabindex="0"
  class="relative flex cursor-pointer border-b bg-card"
  onclick={onrowclick}
  onkeydown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onrowclick(); } }}
>
  {#if flashAdded}
    <span transition:fade={{ duration: 250 }} class="pointer-events-none absolute inset-0 z-5 flex items-center justify-center bg-add-flash-bg text-glyph font-extrabold text-add-flash-ink" aria-hidden="true">✓</span>
  {/if}
  <div class="relative min-w-0 flex-1 overflow-hidden px-2 py-2">
    <!-- No ⋯ menu: tapping the card opens the editor. The lyrics button sits in the top right corner; the title line makes room for it, so the chips below always get the full width. Comments are intentionally not shown in this view. -->
    {#if song.lyrics}
      <div class="absolute top-1 right-2 z-10">
        <IconButton class="no-tint" variant="secondary" icon="📝" label={$t.common.lyrics} onclick={e => { e.stopPropagation(); backlogStore.getState().setLyricsViewSong(song.id); }} />
      </div>
    {/if}
    <!-- The type badge sits left of the title (not in its own column), leaving the whole width to the names. -->
    <div class={cn('flex items-center gap-2 leading-tight', song.lyrics && 'min-h-10 pr-11')}>
      <span class="shrink-0"><CatCell {song} {names} /></span>
      <SongName artist={song.artist} title={song.title} />
    </div>
    {#if chips.length > 0}
      <div class="mt-1.5 grid grid-cols-3 gap-1">
        {#each chips as c (c.name)}
          <Badge class={cn('flex w-full min-w-0 gap-0.75 pr-1.5 pl-0.75 text-small font-normal', c.guest && 'border-dashed border-border', c.tone)}>
            <span class="shrink-0 text-base">{#each c.instruments as inst (inst)}<span>{INSTRUMENT_ICONS[inst]}</span>{/each}</span>
            <span class="min-w-0 flex-1 overflow-hidden whitespace-nowrap [mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent_100%)]">{c.name}</span>
          </Badge>
        {/each}
      </div>
    {/if}
  </div>
</div>
