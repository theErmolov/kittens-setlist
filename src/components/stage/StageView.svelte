<script lang="ts">
  import { currentUser } from '$lib/auth';
  import LinkifiedText from '$components/shared/LinkifiedText.svelte';
  import { onMount } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import type { Song, Category, SetlistEntry } from '$lib/types';
  import { Button } from '$components/ui/button';
  import IconButton from '$components/shared/IconButton.svelte';
  import { Toggle } from '$components/ui/toggle';
  import { Badge } from '$components/ui/badge';
  import { Separator } from '$components/ui/separator';
  import * as ToggleGroup from '$components/ui/toggle-group';
  import * as Drawer from '$components/ui/drawer';
  import * as Item from '$components/ui/item';
  import * as Empty from '$components/ui/empty';
  import { noteStore } from '$lib/store/shell';
  import { chip, pressedOn } from '../setlist/classes';
  import StageSong from './StageSong.svelte';
  import LyricsOverlay from './LyricsOverlay.svelte';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import { lang, t } from '$lib/i18n';
  import { PresenceController, setlistRoom } from '$lib/presence';
  import { clockEmoji, formatDuration, addMinutes, cn } from '$lib/utils';
  import { base } from '$app/paths';
  import { musiciansQuery } from '$lib/query/queries';
  import { stageSetlistQuery, setStagePresence, useStageMark, useSaveEntryTranspose } from '$lib/query/stage';
  import { useStore } from '$lib/store/bridge';
  import { stageStore, stageCanMark, stageIsApproved } from '$lib/store/stage';

  let { setlistId }: { setlistId: string } = $props();

  stageStore.getState().reset();
  stageStore.getState().setSetlistId(setlistId);
  $effect(() => { stageStore.getState().setSetlistId(setlistId); });

  const canMark = stageCanMark;
  const stageChip = chip;
  // admin/writer: 2s, reader: 10s, anonymous: 30s
  let pollInterval = $derived($canMark ? 2000 : $currentUser?.status === 'approved' ? 10000 : 30000);

  const setlistQ = createQuery(() => stageSetlistQuery(setlistId, pollInterval));
  const musiciansQ = createQuery(() => ({ ...musiciansQuery(), enabled: $stageIsApproved }));
  const markMut = useStageMark(() => setlistId);
  const saveEntryTranspose = useSaveEntryTranspose(() => setlistId);

  let setlist = $derived(setlistQ.data!);
  let musicians = $derived(musiciansQ.data ?? []);
  let localComment = $derived(setlist.comment ?? '');
  let localEntries = $derived(setlist.entries);
  let localSubsets = $derived(setlist.subsets ?? []);

  const categoryFilter = useStore(stageStore, s => s.categoryFilter);
  const sortKey = useStore(stageStore, s => s.sortKey);
  const onlyWithComment = useStore(stageStore, s => s.onlyWithComment);
  const selectedMusician = useStore(stageStore, s => s.selectedMusician);
  const filterOpen = useStore(stageStore, s => s.filterOpen);
  const mobile = useStore(noteStore, s => s.mobile);
  const unplayedToBottom = useStore(stageStore, s => s.unplayedToBottom);
  const lyricsSongId = useStore(stageStore, s => s.lyricsSongId);
  const lyricsEntry = $derived($lyricsSongId ? localEntries.find(e => e.songId === $lyricsSongId) ?? null : null);
  const now = useStore(stageStore, s => s.now);
  const { setCategoryFilter, setSelectedMusician, toggleFilterOpen, toggleUnplayedToBottom, setLyricsSong } = stageStore.getState();

  onMount(() => {
    const presence = new PresenceController(setlistRoom(setlistId), 'setlist');
    presence.start();
    setStagePresence(presence);
    const clockTimer = setInterval(() => stageStore.getState().tick(), 1000);
    return () => { setStagePresence(null); presence.stop(); clearInterval(clockTimer); };
  });

  let permanentNames = $derived(new Set(musicians.map(m => m.name)));
  let guestNames = $derived((): string[] => {
    const guests = new Set<string>();
    for (const entry of localEntries) {
      if (!entry.song) continue;
      for (const [name, role] of Object.entries(entry.song.musicians)) {
        if (!permanentNames.has(name) && role.instruments.length > 0) guests.add(name);
      }
    }
    return [...guests].sort();
  });

  // Original position numbers (unfiltered, by setlist order)
  let songPositions = $derived((): Map<number, number> => {
    const map = new Map<number, number>();
    let pos = 1;
    for (const e of [...localEntries].sort((a, b) => a.order - b.order)) {
      if (e.songId) map.set(e.order, pos++);
    }
    return map;
  });

  let categoryCounts = $derived((): Record<Category, number> => {
    const counts: Record<Category, number> = { top: 0, mid: 0, low: 0 };
    for (const e of localEntries) {
      if (e.song && e.song.category in counts) counts[e.song.category]++;
    }
    return counts;
  });

  let musicianCounts = $derived((): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const name of [...musicians.map(m => m.name), ...guestNames()]) {
      counts[name] = localEntries.filter(e => {
        if (!e.song) return false;
        const role = e.song.musicians[name];
        return role && role.instruments.length > 0;
      }).length;
    }
    return counts;
  });


  type DisplayItem =
    | { kind: 'song'; entry: SetlistEntry; song: Song }
    | { kind: 'break'; entry: SetlistEntry };

  let sortedEntries = $derived((): DisplayItem[] => {
    const sorted = [...localEntries].sort((a, b) => a.order - b.order);

    if ($sortKey !== 'default') {
      // When sorting by name, only show songs (no breaks)
      return sorted
        .filter(e => e.songId && e.song)
        .map(e => ({ kind: 'song' as const, entry: e, song: e.song! }))
        .filter(({ song, entry }) => {
          if ($categoryFilter.size > 0 && !$categoryFilter.has(song.category)) return false;
          if ($onlyWithComment && !entry.comment && !entry.personalComment) return false;
          return true;
        })
        .sort((a, b) => $sortKey === 'artist'
          ? a.song.artist.localeCompare(b.song.artist)
          : a.song.title.localeCompare(b.song.title));
    }

    const items = sorted.flatMap((e): DisplayItem[] => {
      if (e.breakMinutes) return [{ kind: 'break', entry: e }];
      if (!e.song) return [];
      if ($categoryFilter.size > 0 && !$categoryFilter.has(e.song.category)) return [];
      if ($onlyWithComment && !e.comment && !e.personalComment) return [];
      return [{ kind: 'song', entry: e, song: e.song }];
    });

    if ($unplayedToBottom && setlist.vibe) {
      const played = items.filter(item => item.entry.played);
      const unplayed = items.filter(item => !item.entry.played);
      return [...played, ...unplayed];
    }

    return items;
  });

  function handleBreakToggle(order: number) {
    if (!$canMark) return;
    markMut.mark({ kind: 'break', order });
  }

  let playedCount = $derived(localEntries.filter(e => e.songId && e.played).length);
  let totalCount = $derived(localEntries.filter(e => e.songId).length);
  let totalMinutes = $derived(localEntries.reduce((s, e) => s + (e.breakMinutes ?? (e.song?.lengthMinutes ?? 5)), 0));
  let visibleCount = $derived(sortedEntries().length);

  let isFiltered = $derived($categoryFilter.size > 0 || $selectedMusician !== '' || $unplayedToBottom);

  const saveSetlistOnlyTranspose = (entry: SetlistEntry, song: Song) => saveEntryTranspose(entry.order, entry.songId, song);

  // Per-entry start times keyed by entry order, only when startTime is set
  let entryTimes = $derived((): Map<number, string> => {
    if (!setlist.startTime) return new Map();
    const sorted = [...localEntries].sort((a, b) => a.order - b.order);
    const map = new Map<number, string>();

    if (!setlist.vibe) {
      const playedWithTs = sorted.filter(e => e.played && e.playedAt);
      const lastPlayed = playedWithTs.at(-1);
      if (lastPlayed?.playedAt) {
        let offset = 0;
        for (const e of sorted) {
          map.set(e.order, addMinutes(setlist.startTime!, offset));
          offset += e.breakMinutes ?? (e.song?.lengthMinutes ?? 5);
          if (e.order === lastPlayed.order) break;
        }
        const d = new Date(lastPlayed.playedAt);
        let recalcBase = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        for (const e of sorted.filter(e => e.order > lastPlayed.order)) {
          map.set(e.order, recalcBase);
          recalcBase = addMinutes(recalcBase, e.breakMinutes ?? (e.song?.lengthMinutes ?? 5));
        }
        return map;
      }
    }

    let offset = 0;
    for (const e of sorted) {
      map.set(e.order, addMinutes(setlist.startTime!, offset));
      offset += e.breakMinutes ?? (e.song?.lengthMinutes ?? 5);
    }
    return map;
  });

  let timingInfo = $derived((): { currentTime: string; finishTime: string; pace?: number } | null => {
    if (!setlist.startTime) return null;
    const hh = String($now.getHours()).padStart(2, '0');
    const mm = String($now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    const sorted = [...localEntries].sort((a, b) => a.order - b.order);
    const playedWithTs = sorted.filter(e => e.played && e.playedAt);
    const lastPlayed = playedWithTs.at(-1);

    let baseTime = setlist.startTime ?? currentTime;
    if (lastPlayed?.playedAt) {
      const d = new Date(lastPlayed.playedAt);
      baseTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    const remainingMinutes = sorted
      .filter(e => !e.played)
      .reduce((s, e) => s + (e.breakMinutes ?? (e.song?.lengthMinutes ?? 5)), 0);
    const finishTime = addMinutes(baseTime, remainingMinutes);

    let pace: number | undefined;
    if (!setlist.vibe && lastPlayed?.playedAt) {
      const scheduledStart = entryTimes().get(lastPlayed.order) ?? setlist.startTime;
      const entryDuration = lastPlayed.breakMinutes ?? (lastPlayed.song?.lengthMinutes ?? 5);
      const scheduledEnd = addMinutes(scheduledStart, entryDuration);
      const d = new Date(lastPlayed.playedAt);
      const actualEnd = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const [sh, sm] = scheduledEnd.split(':').map(Number);
      const [ah, am] = actualEnd.split(':').map(Number);
      pace = (ah * 60 + am) - (sh * 60 + sm);
    }

    return { currentTime, finishTime, pace };
  });
</script>

{#snippet musicianGroup(names: string[], guest: boolean, withCount: boolean)}
  {#if names.length > 0}
    <ToggleGroup.Root
      type="single"
      spacing={1}
      class="flex-wrap gap-1.5"
      value={names.includes($selectedMusician) ? $selectedMusician : ''}
      onValueChange={(v) => setSelectedMusician(v)}
    >
      {#each names as name}
        <ToggleGroup.Item value={name} class="{stageChip} {guest ? 'border-dashed' : ''}">{name}{withCount ? ` (${musicianCounts()[name] ?? 0})` : ''}</ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>
  {/if}
{/snippet}

<div class="stage flex min-h-screen max-w-full flex-col overflow-x-clip bg-background">
  <div class="stage-header sticky top-14 z-10 flex flex-col gap-1.5 border-b bg-card px-3 py-2 shadow-sm">
    <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <IconButton icon="←" label={$t.notFound.backToSetlists} href="{base}/setlists/{setlist.id}" />
      <span class="shrink-0 text-[1.05rem] font-bold">{setlist.name}</span>
      <!-- The setlist comment sits to the right of the title (no label); links show as «domain.tld». -->
      <span class="min-w-0 flex-1 truncate text-[0.9rem] text-muted-foreground" title={localComment}><LinkifiedText text={localComment} /></span>
      {#if timingInfo()}
        <span class="mx-0.5 text-[0.85rem] text-muted-foreground">·</span>
        <!-- Clock with the schedule delta right below it (like the gap in Formula 1 timing). -->
        <span class="flex shrink-0 flex-col items-end gap-0.5">
          <span class="font-semibold tabular-nums">{#key clockEmoji($now)}<span aria-hidden="true">{clockEmoji($now)}</span>{/key} {timingInfo()!.currentTime}</span>
          {#if timingInfo()!.pace !== undefined}
            {@const pace = timingInfo()!.pace!}
            <!-- Formula 1 style gap in clock format right under the time: red +h:mm when behind schedule, green −h:mm when ahead, ±0:00 on time. -->
            {@const onTime = Math.abs(pace) <= 2}
            {@const gap = `${Math.floor(Math.abs(pace) / 60)}:${String(Math.abs(pace) % 60).padStart(2, '0')}`}
            <span
              class="text-[0.95rem] leading-none font-semibold whitespace-nowrap tabular-nums {onTime || pace < 0 ? 'text-success-ink' : 'text-danger-solid'}"
              title={onTime ? $t.stage.onTime : pace > 0 ? $t.stage.behind(pace) : $t.stage.ahead(-pace)}
            >{onTime ? '±0:00' : pace > 0 ? `+${gap}` : `−${gap}`}</span>
          {/if}
        </span>
      {/if}
      <Badge variant="secondary" class="h-auto min-h-5 max-w-full flex-wrap gap-x-1 gap-y-0.5 py-0.5 whitespace-normal px-2 text-[0.88rem] font-normal text-muted-foreground max-[700px]:order-last max-[700px]:w-full max-[700px]:justify-center">
        {playedCount}/{totalCount} ({formatDuration(totalMinutes, $lang)})
        {#if timingInfo()}
          {@const info = timingInfo()!}
          <span class="mx-0.5 opacity-60">·</span>{$t.stage.finish}: {info.finishTime}
        {/if}
        {#if visibleCount !== totalCount}<span class="text-[0.78rem] opacity-75">{$t.stage.shown(visibleCount)}</span>{/if}
      </Badge>
      <IconButton icon="🎛️" label={$t.stage.filters} class="hidden shrink-0 min-[701px]:inline-flex {pressedOn}" pressed={$filterOpen || isFiltered} onpressedchange={() => toggleFilterOpen()} />
    </div>
    {#if !$canMark && !$currentUser}
      <a href="{base}/login" class="text-center text-[0.8rem] text-muted-foreground no-underline hover:text-primary-ink">{$t.login.stageHint}</a>
    {/if}
    {#if $filterOpen}
    <div class="flex flex-col gap-1.5 max-[700px]:hidden">
      <FilterChips selected={$categoryFilter} onchange={setCategoryFilter} counts={categoryCounts()} />
      {#if musicians.length > 0 || guestNames().length > 0}
        <div class="flex flex-wrap gap-1.5">
          {@render musicianGroup(musicians.map(m => m.name), false, true)}
          {@render musicianGroup(guestNames(), true, true)}
        </div>
      {/if}
      {#if setlist.vibe}
        <Toggle class="{stageChip} w-fit" pressed={$unplayedToBottom} onPressedChange={() => toggleUnplayedToBottom()}>{$t.stage.unplayedToBottom}</Toggle>
      {/if}
    </div>
    {/if}
  </div>

  <div class="song-list flex flex-col gap-2 py-2.5 max-[700px]:gap-0 max-[700px]:pt-0 max-[700px]:pb-16">
    {#each sortedEntries() as item, i (item.entry.songId ?? `break-${item.entry.order}`)}
      {@const subsetId = $sortKey === 'default' && item.kind === 'song' ? item.entry.subsetId : undefined}
      {@const prevItem = i > 0 ? sortedEntries()[i - 1] : undefined}
      {@const prevSubsetId = $sortKey === 'default' && prevItem?.kind === 'song' ? prevItem.entry.subsetId : undefined}
      {#if subsetId && subsetId !== prevSubsetId}
        {@const subset = localSubsets.find(s => s.id === subsetId)}
        {#if subset}
          <Item.Title class="mt-1 px-2 py-1 text-[0.8rem] font-bold text-primary-ink">⏭ {subset.name}</Item.Title>
        {/if}
      {/if}
      <div class={subsetId ? 'border-l-[3px] border-primary-ink pl-1' : ''}>
        {#if item.kind === 'song'}
          <StageSong song={item.song} entry={item.entry} position={songPositions().get(item.entry.order) ?? 0}
            startTime={entryTimes().get(item.entry.order)} />
        {:else}
          <Item.Root
            variant="outline"
            class={cn(
              'min-h-12 flex-nowrap gap-2 border-dashed bg-info px-3.5 py-3 text-[0.82rem] tracking-[0.03em] text-muted-foreground transition-opacity min-[701px]:px-3 min-[701px]:py-2 min-[701px]:text-base',
              'max-[700px]:rounded-none max-[700px]:border-x-0',
              item.entry.played && 'opacity-45',
              $canMark && 'cursor-pointer touch-manipulation select-none hover:bg-info/70',
            )}
            role={$canMark ? 'button' : undefined}
            tabindex={$canMark ? 0 : undefined}
            aria-pressed={$canMark ? !!item.entry.played : undefined}
            onclick={() => handleBreakToggle(item.entry.order)}
            onkeydown={(e) => { if ($canMark && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleBreakToggle(item.entry.order); } }}
          >
            <Item.Media>⏸</Item.Media>
            <Item.Content class={cn('flex-row items-baseline gap-1.5', item.entry.played && 'line-through')}>
              <span>{$t.stage.breakMinutes(item.entry.breakMinutes!)}</span>{#if item.entry.comment}<span>—</span><span class="italic opacity-85">{item.entry.comment}</span>{/if}
            </Item.Content>
            {#if setlist.startTime}<Item.Actions class="text-[0.82rem] font-semibold whitespace-nowrap text-primary-ink min-[701px]:text-[0.9rem] min-[701px]:font-bold">{entryTimes().get(item.entry.order)}</Item.Actions>{/if}
          </Item.Root>
        {/if}
      </div>
    {/each}
    {#if sortedEntries().length === 0}
      <Empty.Root class="mx-4 my-10 flex-none">
        <Empty.Header><Empty.Title class="text-base font-normal text-muted-foreground">{$t.stage.noSongs}</Empty.Title></Empty.Header>
      </Empty.Root>
    {/if}
  </div>

  <!-- Mobile filter panel: bottom drawer -->
  <Drawer.Root open={$filterOpen && $mobile} onOpenChange={(o) => { if (!o && stageStore.getState().filterOpen) toggleFilterOpen(); }} shouldScaleBackground={false}>
    <Drawer.Content onOpenAutoFocus={(e) => e.preventDefault()}>
      <Drawer.Header class="pb-0 text-left">
        <Drawer.Title>🎛️ {$t.stage.filters}</Drawer.Title>
      </Drawer.Header>
      <div class="flex max-h-[65dvh] flex-col gap-2.5 overflow-y-auto p-3">
        <div class="flex flex-wrap gap-2">
          <FilterChips selected={$categoryFilter} onchange={setCategoryFilter} />
        </div>
        {#if musicians.length > 0 || guestNames().length > 0}
          <Separator />
          <div class="flex flex-wrap gap-[5px]">
            {@render musicianGroup(musicians.map(m => m.name), false, false)}
            {@render musicianGroup(guestNames(), true, false)}
          </div>
        {/if}
        {#if setlist.vibe}
          <Separator />
          <div class="flex flex-wrap gap-[5px]">
            <Toggle class={stageChip} pressed={$unplayedToBottom} onPressedChange={() => toggleUnplayedToBottom()}>{$t.stage.unplayedToBottom}</Toggle>
          </div>
        {/if}
      </div>
    </Drawer.Content>
  </Drawer.Root>

  {#if lyricsEntry?.song}
    <LyricsOverlay
      song={lyricsEntry.song}
      onclose={() => setLyricsSong(null)}
      onsavetranspose={lyricsEntry.setlistOnly
        ? (song) => saveSetlistOnlyTranspose(lyricsEntry!, song)
        : undefined}
    />
  {/if}

  <!-- Mobile bottom bar -->
  <div class="fixed right-0 bottom-0 left-0 z-[21] hidden h-16 items-center gap-2 border-t bg-card px-3 max-[700px]:flex">
    <IconButton icon="🎛️" label={$t.stage.filters} class={pressedOn} pressed={$filterOpen || isFiltered} onpressedchange={() => toggleFilterOpen()} />
    {#if setlist.vibe}
      <IconButton icon="🔁" label={$t.stage.unplayedToBottom} class={pressedOn} pressed={$unplayedToBottom} onpressedchange={() => toggleUnplayedToBottom()} />
    {/if}
  </div>
</div>
