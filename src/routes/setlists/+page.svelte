<script lang="ts">
  import { browser } from '$app/environment';
  import VibeBadge from '$components/shared/VibeBadge.svelte';
  import LinkifiedText from '$components/shared/LinkifiedText.svelte';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import PageControlsDivider from '$components/shared/PageControlsDivider.svelte';
  import PageControls from '$components/shared/PageControls.svelte';
  import * as NavigationMenu from '$components/ui/navigation-menu';
  import * as Breadcrumb from '$components/ui/breadcrumb';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import VibeSwitch from '$components/shared/VibeSwitch.svelte';
  import * as Dialog from '$components/ui/dialog';
  import { mobileFullscreen } from '$components/setlist/dialogClasses';
  import * as Empty from '$components/ui/empty';
  import IconButton from '$components/shared/IconButton.svelte';
  import { base } from '$app/paths';
  import type { Setlist } from '$lib/types';
  import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { goto } from '$app/navigation';
  import { t, lang } from '$lib/i18n';
  import { formatDuration, formatDate, cn } from '$lib/utils';
  import EventCalendar from '$components/shared/EventCalendar.svelte';
  import { localDate } from '$lib/rehearsals';
  import { setlistEmojis } from '$lib/setlistEmoji';
  import { calendarStore } from '$lib/store/calendar';
  import * as Card from '$components/ui/card';
  import { canWrite } from '$lib/auth';
  import { setlistsQuery } from '$lib/query/queries';
  import { prefetchSetlists } from '$lib/query/prefetch';
  import { useCreateSetlist, useDeleteSetlist } from '$lib/query/setlistMutations';
  import { useStore } from '$lib/store/bridge';
  import { setlistListStore } from '$lib/store/setlistList';

  const setlistsQ = createQuery(() => setlistsQuery());
  const createMut = useCreateSetlist();
  const deleteMut = useDeleteSetlist();

  const showNew = useStore(setlistListStore, s => s.showNew);
  const newName = useStore(setlistListStore, s => s.name);
  const newDate = useStore(setlistListStore, s => s.date);
  const newStartTime = useStore(setlistListStore, s => s.startTime);
  const newVibe = useStore(setlistListStore, s => s.vibe);
  const deleteId = useStore(setlistListStore, s => s.deleteId);
  const { setShowNew, setField, resetForm, setDeleteId } = setlistListStore.getState();

  const songCount = (sl: Setlist) => sl.entries.filter(e => e.songId).length;
  const totalMinutes = (sl: Setlist) => sl.entries.reduce((n, e) => n + (e.breakMinutes ?? (e.songId ? (e.song?.lengthMinutes ?? 5) : 0)), 0);
  // Default order: date, newest first; undated last.
  // Info-only calendar: setlists by date (undated ones are not shown there).
  const today = localDate();
  const byDate = $derived((setlistsQ.data ?? []).reduce((acc, sl) => { if (sl.date) (acc[sl.date] ??= []).push(sl); return acc; }, {} as Record<string, Setlist[]>));
  // Hover link between list items and calendar days: the hovered item's date or the hovered day's date.
  const hoverIso = useStore(calendarStore, s => s.hoverIso);
  const { setHoverIso } = calendarStore.getState();
  // Day picked by clicking an empty calendar day; prefills the date of a new setlist (today when nothing is picked).
  const selectedIso = useStore(setlistListStore, s => s.selectedIso);
  const monthIso = useStore(setlistListStore, s => s.monthIso);
  const { setSelectedIso, setMonthIso } = setlistListStore.getState();
  function toggleNew() {
    const open = !setlistListStore.getState().showNew;
    if (open) setField({ date: $selectedIso ?? today });
    setShowNew(open);
  }
  function openNew() {
    setField({ date: $selectedIso ?? today });
    setShowNew(true);
  }
  const emojiOf = $derived(setlistEmojis(setlistsQ.data ?? []));
  const sorted = $derived([...(setlistsQ.data ?? [])].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  }));

  async function handleCreate() {
    const { name, date, startTime, vibe } = setlistListStore.getState();
    if (!name.trim()) return;
    const sl = await createMut.mutateAsync({ name: name.trim(), date: date.trim() || undefined, startTime: startTime.trim() || undefined, vibe: vibe || undefined });
    resetForm();
    goto(`/setlists/${sl.id}`);
  }

  function confirmDelete() {
    const id = setlistListStore.getState().deleteId;
    setDeleteId(null);
    if (id) deleteMut.mutate(id);
  }

  const primaryBtn = 'font-semibold';

  // Once the list is shown, warm the first rows (in the current sort order) for instant opening.
  $effect(() => {
    if (browser && !setlistsQ.isPending) prefetchSetlists(sorted.map(sl => sl.id));
  });
</script>

<!-- Desktop bar; on small screens the actions live in a bottom bar (as in the catalog). -->
{#if browser && !setlistsQ.isPending}
<div class="contents max-mid:hidden">
<PageControls label={$t.nav.setlists}>
  {#snippet start()}
    <NavigationMenu.Item class="min-w-0"><Breadcrumb.Root><Breadcrumb.List class="flex-nowrap"><Breadcrumb.Item><Breadcrumb.Page class="inline-flex min-h-10 items-center whitespace-nowrap">{$t.nav.setlists}</Breadcrumb.Page></Breadcrumb.Item></Breadcrumb.List></Breadcrumb.Root></NavigationMenu.Item>
  {/snippet}
  {#snippet end()}
    {#if $canWrite}
      <PageControlsDivider />
      <NavigationMenu.Item><IconButton text={$t.setlists.newBtn.replace(/^\+\s*/, '')} icon="➕" variant="default" label={$t.setlists.newBtn.replace(/^\+\s*/, '')}  onclick={toggleNew} /></NavigationMenu.Item>
    {/if}
  {/snippet}
</PageControls>
</div>
{#if $canWrite}
  <div class="fixed inset-x-0 bottom-0 z-40 hidden safe-bar items-center justify-center gap-2 border-t bg-card px-3 max-mid:flex">
    <IconButton variant="default" icon="➕" label={$t.setlists.newBtn.replace(/^\+\s*/, '')} onclick={toggleNew} />
  </div>
{/if}

{/if}

<!-- New setlist: a dialog (same layout as the editor's «Edit» dialog). -->
<Dialog.Root open={$showNew && $canWrite} onOpenChange={o => { if (!o) setShowNew(false); }}>
  <Dialog.Content class="gap-4 max-mid:grid-rows-[auto_1fr_auto] mid:max-w-md {mobileFullscreen}">
    <Dialog.Header><Dialog.Title class="text-title-sm font-bold">{$t.setlists.newBtn.replace(/^\+\s*/, '')}</Dialog.Title></Dialog.Header>
    <div class="flex flex-col gap-3">
      <Input value={$newName} oninput={e => setField({ name: e.currentTarget.value })} placeholder={$t.setlists.namePlaceholder} aria-label={$t.setlists.namePlaceholder} />
      <div class="flex flex-wrap gap-2">
        <Input type="date" class="min-w-35 flex-1" value={$newDate} oninput={e => setField({ date: e.currentTarget.value })} />
        <Input type="time" class="min-w-30 flex-1" value={$newStartTime} oninput={e => setField({ startTime: e.currentTarget.value })} />
      </div>
      <VibeSwitch id="new-vibe" checked={$newVibe} onchange={v => setField({ vibe: v })} />
    </div>
    <Dialog.Footer class="max-mid:mt-auto">
      <Button variant="outline" onclick={() => setShowNew(false)}>{$t.setlists.cancel}</Button>
      <Button onclick={handleCreate} disabled={!$newName.trim()}>{$t.setlists.create}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<div class="w-full px-3 pt-3 pb-4 max-mid:px-2.5 max-mid:pb-[calc(68px+env(safe-area-inset-bottom))]">


  {#if !browser || setlistsQ.isPending}
    <LoadingCat />
  {:else if (setlistsQ.data ?? []).length === 0}
    <Empty.Root class="border py-15">
      <Empty.Header>
        <Empty.Title class="text-base font-normal text-muted-foreground">{$t.setlists.empty}</Empty.Title>
      </Empty.Header>
      {#if !$showNew && $canWrite}
        <Empty.Content>
          <Button class={primaryBtn} onclick={openNew}>{$t.setlists.createFirst}</Button>
        </Empty.Content>
      {/if}
    </Empty.Root>
  {:else}
    <div class="grid grid-cols-[minmax(300px,380px)_minmax(0,1fr)] items-start gap-6 max-mid:grid-cols-1 max-mid:gap-4">
    <EventCalendar
      items={byDate}
      selected={$selectedIso}
      placeholder={$monthIso}
      onplaceholderchange={setMonthIso}
      onselect={iso => { if (iso && byDate[iso]?.length) goto(`${base}/setlists/${byDate[iso][0].id}`); else setSelectedIso(iso); }}
      lang={$lang}
      label={$t.nav.setlists}
      dayLabel={(iso, lists) => lists.length ? `${formatDate(iso, $lang)} · ${lists.map(l => l.name).join(', ')}` : formatDate(iso, $lang)}
    >
      {#snippet dayContent({ items: lists, past })}
        {#if lists.length}
          <!-- One fixed-height row (the cell never grows): two emoji, or one emoji and «+N» when there are more. -->
          {@const shown = lists.length > 2 ? 1 : lists.length}
          <span class="flex h-5 w-full items-center justify-center gap-0.5">
            {#each lists.slice(0, shown) as sl (sl.id)}
              <span class={cn('no-tint inline-flex items-center justify-center text-[1.25rem] leading-none', past && 'opacity-60')} title={sl.name}>{emojiOf.get(sl.id)}</span>
            {/each}
            {#if lists.length > shown}<span class="text-micro leading-none text-muted-foreground group-data-selected/day:text-primary-foreground">+{lists.length - shown}</span>{/if}
          </span>
        {/if}
      {/snippet}
    </EventCalendar>
    <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
      {#each sorted as sl (sl.id)}
        {@const dateTime = [sl.date ? formatDate(sl.date, $lang) : '', sl.startTime ? `⏱ ${sl.startTime}` : ''].filter(Boolean).join(' · ')}
        <li>
          <!-- Stretched-link card: the name anchor covers the whole card (real link, so SvelteKit navigates client-side); the action buttons sit above it. -->
          <Card.Root
            onpointerenter={() => setHoverIso(sl.date ?? null)}
            onpointerleave={() => setHoverIso(null)}
            class={cn('relative isolate flex-row items-center gap-2 rounded-lg p-2 transition-colors focus-within:border-primary hover:border-primary', sl.date && $hoverIso === sl.date && 'border-primary')}>
            <div class="flex min-w-0 flex-1 items-center gap-3 max-mid:gap-0.5">
            <div class="flex shrink-0 flex-col items-center gap-0.5 p-1">
              <span class="no-tint text-[2rem] leading-none" aria-hidden="true">{emojiOf.get(sl.id)}</span>
              <!-- The vibe badge sits under the icon. -->
              <VibeBadge vibe={sl.vibe} class="h-4 px-1 text-micro" />
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <!-- The title and its comment run on as one text that takes at most two lines. -->
              <div class="min-w-0 block line-clamp-2 break-words">
                <a href="{base}/setlists/{sl.id}" class="text-base font-semibold text-inherit no-underline after:absolute after:inset-0 after:content-[''] inline overflow-visible whitespace-normal">{sl.name}</a>
                {#if sl.comment}<span class="relative z-10 min-w-0 text-body text-muted-foreground ml-1 inline overflow-visible whitespace-normal" title={sl.comment}><LinkifiedText text={sl.comment} /></span>{/if}
              </div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted-foreground max-mid:flex-col max-mid:items-start">
                {#if dateTime}<span>{dateTime}</span>{/if}
                <span class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{$t.setlists.songs(songCount(sl))} ({formatDuration(totalMinutes(sl), $lang)})</span>
                </span>
              </div>
            </div>
            </div>
            <!-- Two buttons: labelled and stacked (touching top/bottom) on small screens, icon-only side by side on mid, labelled side by side (touching left/right) on big. -->
            <div class="relative z-10 flex shrink-0 items-stretch max-big:self-stretch big:self-center max-mid:w-fit max-mid:flex-col mid:grid mid:auto-cols-fr mid:grid-flow-col">
              <Button variant="default" href="{base}/setlists/{sl.id}/stage" class="h-auto min-h-10 w-full gap-0.5 big:h-10 rounded-lg border-0 px-2 font-semibold mid:max-big:min-w-16 mid:max-big:px-0 mid:max-big:text-glyph max-mid:flex-1 max-mid:not-last:rounded-b-none mid:not-last:rounded-r-none" aria-label={$t.setlists.stage} title={$t.setlists.stage}><span aria-hidden="true">{$t.setlists.stage.split(' ')[0]}</span><span class="mid:max-big:hidden" aria-hidden="true">{$t.setlists.stageShort}</span></Button>
              {#if $canWrite}
                <Button variant="outline" class="h-auto min-h-10 w-full gap-0.5 big:h-10 rounded-lg border-0 px-2 font-semibold mid:max-big:min-w-16 mid:max-big:px-0 mid:max-big:text-glyph max-mid:flex-1 max-mid:rounded-t-none mid:rounded-l-none" onclick={() => setDeleteId(sl.id)}><span aria-hidden="true">🗑</span><span class="mid:max-big:hidden">{$t.song.remove}</span></Button>
              {/if}
            </div>
          </Card.Root>
        </li>
      {/each}
    </ul>
    </div>
  {/if}
</div>

<ConfirmDialog open={$deleteId !== null} title={$t.setlists.deleteConfirm} confirmLabel={$t.song.remove} cancelLabel={$t.setlists.cancel} onopenchange={o => { if (!o) setDeleteId(null); }} onconfirm={confirmDelete} />
