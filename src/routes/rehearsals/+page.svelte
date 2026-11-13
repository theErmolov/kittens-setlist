<script lang="ts">
  import { browser } from '$app/environment';
  import ReminderPreferences from '$components/shared/ReminderPreferences.svelte';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { createQuery } from '@tanstack/svelte-query';
  import { authLoading, canAccessRehearsals } from '$lib/auth';
  import { lang } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import type { RehearsalDraft } from '$lib/types';
  import { isUpcoming, localDate } from '$lib/rehearsals';
  import { cn } from '$lib/utils';
  import { formatDate } from '$lib/utils';
  import { rehearsalsQuery, setlistsQuery, musiciansQuery, songsQuery } from '$lib/query/queries';
  import { prefetchRehearsals } from '$lib/query/prefetch';
  import { useCreateRehearsal } from '$lib/query/rehearsals';
  import { useStore } from '$lib/store/bridge';
  import { rehearsalListStore as list } from '$lib/store/rehearsals';
  import { Button } from '$components/ui/button';
  import { Alert, AlertDescription } from '$components/ui/alert';
  import EventCalendar from '$components/shared/EventCalendar.svelte';
  import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '$components/ui/empty';
  import { isPastRehearsal, rehearsalTime, timeChip } from '$components/rehearsals/classes';
  import IconButton from '$components/shared/IconButton.svelte';
  import ButtonRow from '$components/shared/ButtonRow.svelte';
  import PageControlsDivider from '$components/shared/PageControlsDivider.svelte';
  import PageControls from '$components/shared/PageControls.svelte';
  import * as Breadcrumb from '$components/ui/breadcrumb';
  import * as NavigationMenu from '$components/ui/navigation-menu';
  import RehearsalList from '$components/rehearsals/RehearsalList.svelte';
  import RehearsalForm from '$components/rehearsals/RehearsalForm.svelte';

  list.getState().reset();
  const { setMonth, selectDay, clearDay, goToday, openNew, closeNew } = list.getState();
  const selectedDate = useStore(list, s => s.selectedDate);
  const month = useStore(list, s => s.month);
  const showNew = useStore(list, s => s.showNew);
  const initial = useStore(list, s => s.initial);
  const enabled = $derived(!$authLoading && $canAccessRehearsals);
  const rehearsalsQ = createQuery(() => ({ ...rehearsalsQuery(), enabled }));
  const setlistsQ = createQuery(() => ({ ...setlistsQuery(), enabled }));
  const musiciansQ = createQuery(() => ({ ...musiciansQuery(), enabled }));
  const songsQ = createQuery(() => ({ ...songsQuery(), enabled }));
  const createMut = useCreateRehearsal();
  const queries = [rehearsalsQ, setlistsQ, musiciansQ, songsQ];
  const rehearsals = $derived(rehearsalsQ.data ?? []);
  const loading = $derived(!browser || queries.some(q => q.isPending));
  const error = $derived(!loading && queries.some(q => q.isError) ? $rt.error : '');
  const upcoming = $derived(rehearsals.filter(r => isUpcoming(r)).sort((a,b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)));
  const daySessions = $derived(rehearsals.filter(r => r.date === $selectedDate).sort((a,b) => a.startTime.localeCompare(b.startTime)));
  const monthLabel = $derived(new Intl.DateTimeFormat($lang === 'ru' ? 'ru-RU' : 'en-GB', { month: 'long', year: 'numeric' }).format($month));
  // Calendar <-> store bridge: the selected day and the visible month live in the Zustand list store.
  const countByDate = $derived(rehearsals.toSorted((a, b) => a.startTime.localeCompare(b.startTime)).reduce((acc, r) => { (acc[r.date] ??= []).push(r); return acc; }, {} as Record<string, typeof rehearsals>));
  // Keep the calendar on the month shown by the store, even when the selected day lives in another month.
  const monthIso = $derived(localDate($month));
  const placeholderIso = $derived($selectedDate && $selectedDate.slice(0, 7) === monthIso.slice(0, 7) ? $selectedDate : monthIso);
  let handledNew = false;
  $effect(() => {
    if ($authLoading) return;
    if (!$canAccessRehearsals) goto(`${base}/backlog`);
  });
  $effect(() => {
    if (loading || error || handledNew || !enabled) return;
    handledNew = true;
    if (page.url.searchParams.get('new') === '1') openNew({ date: $selectedDate ?? undefined, setlistId: page.url.searchParams.get('setlist') ?? undefined });
  });
  // Once the page is shown, warm the upcoming rehearsals, and the most recent past ones.
  $effect(() => {
    if (loading || error) return;
    const past = rehearsals.filter(r => !isUpcoming(r)).sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
    prefetchRehearsals(upcoming.map(r => r.id), past.map(r => r.id));
  });
  function load() { queries.filter(q => q.isError).forEach(q => q.refetch()); }
  function plan() { openNew({ date: $selectedDate ?? undefined }); }
  async function save(draft: RehearsalDraft) { const rehearsal = await createMut.mutateAsync({ draft }); await goto(`${base}/rehearsals/${rehearsal.id}`); }
  function closeForm() { closeNew(); if (page.url.searchParams.has('new')) goto(`${base}/rehearsals`, { replaceState: true, noScroll: true }); }
</script>

{#if $canAccessRehearsals}
{#if !loading}
<div class="contents max-mid:hidden">
<PageControls label={$rt.title}>
  {#snippet start()}
    <NavigationMenu.Item class="min-w-0"><Breadcrumb.Root><Breadcrumb.List class="flex-nowrap"><Breadcrumb.Item><Breadcrumb.Page class="inline-flex min-h-10 items-center whitespace-nowrap">{$rt.title}</Breadcrumb.Page></Breadcrumb.Item></Breadcrumb.List></Breadcrumb.Root></NavigationMenu.Item>
  {/snippet}
  {#snippet end()}
    <PageControlsDivider />
    <NavigationMenu.Item class="min-w-0"><ReminderPreferences /></NavigationMenu.Item><NavigationMenu.Item><IconButton text={$rt.new.replace(/^\+\s*/, '')} icon="➕" variant="default" label={$rt.new}  onclick={plan} disabled={loading || !!error} /></NavigationMenu.Item>{/snippet}
</PageControls>
</div>
<div class="fixed inset-x-0 bottom-0 z-40 hidden safe-bar grid-cols-[1fr_auto_1fr] items-center gap-2 border-t bg-card px-3 max-mid:grid">
  <span></span>
  <IconButton variant="default" icon="➕" label={$rt.new} onclick={plan} disabled={loading || !!error} />
  <div class="flex justify-start"><ReminderPreferences /></div>
</div>
{/if}
<div class="w-full px-3 pt-3 pb-4 max-mid:px-2.5 max-mid:pb-[calc(52px+env(safe-area-inset-bottom))]">
  {#if loading}<LoadingCat />
  {:else if error}
    <Alert variant="destructive" class="flex items-center justify-between gap-3"><AlertDescription>{error}</AlertDescription><Button variant="outline" size="sm" onclick={load}>{$rt.retry}</Button></Alert>
  {:else}
    <div class="grid grid-cols-[minmax(300px,380px)_minmax(0,1fr)] items-start gap-6 max-mid:grid-cols-1 max-mid:gap-4">
      <EventCalendar
        items={countByDate}
        selected={$selectedDate}
        onselect={iso => { if (iso) { const [y, m, d] = iso.split('-').map(Number); selectDay(new Date(y, m - 1, d)); } else clearDay(); }}
        placeholder={placeholderIso}
        onplaceholderchange={iso => { const [y, m] = iso.split('-').map(Number); setMonth(new Date(y, m - 1, 1)); }}
        lang={$lang}
        label={monthLabel}
        prevLabel={$rt.previous}
        nextLabel={$rt.next}
        dayLabel={(iso, sessions) => `${formatDate(iso, $lang)} · ${sessions.length}`}
      >
        {#snippet toolbar()}
          <ButtonRow>
            <IconButton icon="↩️" label={$rt.clearDay} onclick={clearDay} class={$selectedDate ? '' : 'invisible'} disabled={!$selectedDate} />
            <IconButton icon="📆" label={$rt.today} onclick={goToday} />
          </ButtonRow>
        {/snippet}
        {#snippet dayContent({ items: sessions })}
          {#if sessions.length}
            <span class="flex w-full flex-col items-center gap-0.5">
              {#each sessions.slice(0, 3) as session (session.id)}
                <span class={cn('inline-flex w-full max-w-13 items-center justify-center rounded border px-0.5 text-micro leading-[1.35] tabular-nums', timeChip(isPastRehearsal(session), session.cancelled), 'group-data-selected/day:border-primary-foreground/60 group-data-selected/day:text-primary-foreground')}>{session.startTime.slice(0, 5)}</span>
              {/each}
              {#if sessions.length > 3}<span class="text-micro leading-none text-muted-foreground group-data-selected/day:text-primary-foreground">+{sessions.length - 3}</span>{/if}
            </span>
          {/if}
        {/snippet}
      </EventCalendar>
      <section class="min-w-0" aria-live="polite">
        {#if $selectedDate}
          <h2 class="mb-3 text-base font-bold">{formatDate($selectedDate, $lang)}</h2>
          {#if daySessions.length}<RehearsalList rehearsals={daySessions} />
          {:else}<Empty class="border"><EmptyHeader><EmptyTitle class="text-body-lg font-normal text-muted-foreground">{$rt.noSessions}</EmptyTitle></EmptyHeader><EmptyContent><Button variant="outline" size="sm" onclick={plan}>{$rt.new}</Button></EmptyContent></Empty>{/if}
        {:else}
          <h2 class="mb-3 text-base font-bold">{$rt.upcoming}</h2>
          {#if upcoming.length}<RehearsalList rehearsals={upcoming} />
          {:else}<Empty class="border py-4"><EmptyHeader><EmptyTitle class="text-body-lg font-normal text-muted-foreground">{$rt.noUpcoming}</EmptyTitle></EmptyHeader></Empty>{/if}
        {/if}
      </section>
    </div>
  {/if}
</div>
{#if $showNew && !loading}<RehearsalForm initial={$initial} onsubmit={save} onclose={closeForm} />{/if}
{/if}
