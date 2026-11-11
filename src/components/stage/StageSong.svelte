<script lang="ts">
  import LinkifiedText from '$components/shared/LinkifiedText.svelte';
  import Note from '$components/shared/Note.svelte';
  import type { Song, SetlistEntry } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { sortInstruments, cn } from '$lib/utils';
  import * as Item from '$components/ui/item';
  import { Badge } from '$components/ui/badge';
  import IconButton from '$components/shared/IconButton.svelte';
  import { t } from '$lib/i18n';
  import { createQuery } from '@tanstack/svelte-query';
  import { musiciansQuery } from '$lib/query/queries';
  import { useStageMark } from '$lib/query/stage';
  import { useStore } from '$lib/store/bridge';
  import { stageStore, stageCanMark, stageIsApproved } from '$lib/store/stage';

  const instrumentIcons: Record<string, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', saxophone: '🎷', trumpet: '🎺', percussion: '🪇', vocals: '🎤'
  };

  let {
    song,
    entry,
    position,
    startTime,
  }: {
    song: Song;
    entry: SetlistEntry;
    position: number;
    startTime?: string;
  } = $props();

  const musiciansQ = createQuery(() => ({ ...musiciansQuery(), enabled: $stageIsApproved }));
  const markMut = useStageMark(() => stageStore.getState().setlistId);
  const selectedMusicianStore = useStore(stageStore, s => s.selectedMusician);
  const canMark = stageCanMark;

  let musicians = $derived(musiciansQ.data ?? []);
  let selectedMusician = $derived($selectedMusicianStore);

  function ontoggle() {
    if (!$canMark || !entry.songId) return;
    markMut.mark({ kind: 'song', songId: entry.songId });
  }
  function onlyricsclick() { stageStore.getState().setLyricsSong(entry.songId ?? null); }

  let permanentNames = $derived(new Set(musicians.map(m => m.name)));

  let rosterCells = $derived.by(() => {
    const cells = musicians.map(m => {
      const role = song.musicians[m.name];
      const active = (role?.instruments?.length ?? 0) > 0;
      const highlight = !!selectedMusician && m.name === selectedMusician && !!active;
      return { name: m.name, role: role ?? null, active, highlight };
    });
    // append ad-hoc guests
    for (const [name, role] of Object.entries(song.musicians)) {
      if (!permanentNames.has(name) && role.instruments.length > 0) {
        cells.push({ name, role, active: true, highlight: !!selectedMusician && name === selectedMusician });
      }
    }
    return cells;
  });
</script>

<!-- Mobile: 3-col grid [meta spans 2 rows] | [info / musicians] | [time]; desktop: 4-col grid [meta] [info] [comment] [musicians]. -->
<Item.Root
  class={cn(
    'stage-song group/song grid w-full grid-cols-[44px_1fr_auto] grid-rows-[auto_auto] items-stretch gap-0 overflow-hidden rounded-lg bg-(--item-bg) p-0 text-left transition-[background,opacity]',
    'max-mid:rounded-none max-mid:border-x-0',
    'min-mid:min-h-[56px] min-mid:rounded-none min-mid:border-x-0 min-mid:border-t-0 min-mid:border-b min-mid:border-border min-mid:grid-cols-[64px_1.66fr_1.49fr_1.75fr] min-mid:grid-rows-[1fr]',
    entry.played && 'opacity-45',
    $canMark ? 'cursor-pointer min-mid:hover:bg-(--row-hover)' : 'cursor-default',
  )}
  data-played={entry.played ? 'true' : undefined}
  role={$canMark ? 'button' : undefined}
  tabindex={$canMark ? 0 : undefined}
  aria-pressed={$canMark ? !!entry.played : undefined}
  onclick={ontoggle}
  onkeydown={(e) => { if ($canMark && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ontoggle(); } }}
>
  <!-- position + category (+ lyrics button on mobile) -->
  <Item.Media class="col-start-1 row-span-2 flex-col items-stretch justify-start gap-0 self-stretch! min-mid:row-span-1">
    <div class="flex flex-col items-center gap-1 px-1 py-1.5 min-mid:flex-1 min-mid:justify-center min-mid:px-2 min-mid:py-1">
      <span class="text-[0.85rem] font-bold text-muted-foreground min-mid:text-[1.05rem]">{position}</span>
      <CategoryBadge category={song.category} iconOnly />
    </div>
    {#if song.lyrics}
      <IconButton variant="secondary" icon="📝" label={$t.common.lyrics} class="no-tint h-auto min-h-10 w-full flex-1 rounded-none text-2xl min-mid:hidden" onclick={(e) => { e.stopPropagation(); onlyricsclick(); }} />
    {/if}
  </Item.Media>

  <!-- title + artist (+ mobile comments) -->
  <Item.Content class="col-start-2 row-start-1 min-w-0 flex-row flex-wrap content-start items-baseline gap-x-1 gap-y-0 px-2 py-1.5 min-mid:flex-col min-mid:flex-nowrap min-mid:justify-center min-mid:gap-0 min-mid:px-3 min-mid:py-1">
    <Item.Title class={cn('line-clamp-none w-auto text-base leading-snug font-bold min-mid:text-[1.6rem] min-mid:leading-[1.15]', entry.played && 'line-through decoration-2')}>{song.title}</Item.Title>
    <Item.Description class={cn("line-clamp-none text-[0.85rem] before:mr-0.5 before:content-['·'] min-mid:text-[0.88rem]", entry.played && 'line-through decoration-2')}>{song.artist}</Item.Description>
    {#if entry.comment || entry.personalComment}
      <div class="mt-0.5 basis-full text-[0.78rem] font-medium text-foreground min-mid:hidden">
        {#if entry.comment}<div><LinkifiedText text={entry.comment} /></div>{/if}
        <Note value={entry.personalComment} label={$t.common.personalComment} icon="🤫" compact />
      </div>
    {/if}
  </Item.Content>

  <!-- start time (mobile) -->
  <Item.Actions class="col-start-3 row-start-1 py-1.5 pr-2 pl-1 min-mid:hidden">
    {#if startTime}<span class="text-[0.82rem] font-semibold whitespace-nowrap text-primary-ink">{startTime}</span>{/if}
  </Item.Actions>

  <!-- musicians (+ desktop start time) -->
  <div class="col-span-2 col-start-2 row-start-2 flex min-mid:col-span-1 min-mid:col-start-4 min-mid:row-start-1 min-mid:items-center min-mid:gap-2 min-mid:px-3 min-mid:py-1">
    <div class="grid min-w-0 flex-1 grid-cols-3 gap-x-1 gap-y-[3px] px-2 pt-[5px] pb-2 text-[0.82rem] text-muted-foreground min-mid:gap-y-0.5 min-mid:p-0">
      {#each rosterCells as cell}
        <Badge
          variant="secondary"
          class={cn(
            'w-full min-w-0 justify-start gap-1 border-0 bg-transparent px-1.5 py-px pl-[3px] text-[0.82rem] font-normal',
            cell.active && (cell.highlight ? 'bg-(--person-hi) font-semibold text-[#1f1d3a]' : 'bg-(--person-bg) text-muted-foreground'),
          )}
        >
          {#if cell.active}
            <span class="flex shrink-0 flex-row flex-nowrap items-center gap-px text-[1.17rem] leading-[1.1]">
              {#each sortInstruments(cell.role?.instruments ?? []) as inst (inst)}
                <span>{instrumentIcons[inst]}</span>
              {/each}
            </span>
            <span class="min-w-0 flex-1 overflow-hidden whitespace-nowrap [mask-image:linear-gradient(to_right,black_calc(100%-16px),transparent_100%)]">{cell.name}</span>
          {/if}
        </Badge>
      {/each}
    </div>
    {#if startTime}<span class="hidden shrink-0 text-[0.9rem] font-bold text-primary-ink min-mid:inline">{startTime}</span>{/if}
  </div>

  <!-- comment + lyrics (desktop) -->
  <div class="col-start-3 row-start-1 hidden min-w-0 items-stretch min-mid:col-start-3 min-mid:flex">
    <div class="min-w-0 flex-1 self-center px-3 py-1">
      {#if entry.comment}<div class="min-w-0 self-center text-[0.82rem] leading-snug font-normal break-words whitespace-normal text-foreground"><LinkifiedText text={entry.comment} /></div>{/if}
      <Note value={entry.personalComment} label={$t.common.personalComment} />
    </div>
    {#if song.lyrics}
      <IconButton variant="secondary" icon="📝" label={$t.common.lyrics} class="no-tint ml-3 h-auto min-h-full w-20 shrink-0 text-[2rem] self-stretch rounded-none" onclick={(e) => { e.stopPropagation(); onlyricsclick(); }} />
    {/if}
  </div>
</Item.Root>
