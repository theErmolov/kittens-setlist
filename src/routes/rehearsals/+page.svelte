<script lang="ts">
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
  import { parseDate, type DateValue } from '@internationalized/date';
  import { rehearsalsQuery, setlistsQuery, musiciansQuery, songsQuery } from '$lib/query/queries';
  import { useCreateRehearsal } from '$lib/query/rehearsals';
  import { useStore } from '$lib/store/bridge';
  import { rehearsalListStore as list } from '$lib/store/rehearsals';
  import { Button } from '$components/ui/button';
  import { Card } from '$components/ui/card';
  import { Alert, AlertDescription } from '$components/ui/alert';
  import { Calendar, Day as CalendarDay } from '$components/ui/calendar';
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
  const loading = $derived(queries.some(q => q.isPending));
  const error = $derived(!loading && queries.some(q => q.isError) ? $rt.error : '');
  const upcoming = $derived(rehearsals.filter(r => isUpcoming(r)).sort((a,b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)));
  const daySessions = $derived(rehearsals.filter(r => r.date === $selectedDate).sort((a,b) => a.startTime.localeCompare(b.startTime)));
  const monthLabel = $derived(new Intl.DateTimeFormat($lang === 'ru' ? 'ru-RU' : 'en-GB', { month: 'long', year: 'numeric' }).format($month));
  // Calendar <-> store bridge: the selected day and the visible month live in the Zustand list store.
  const countByDate = $derived(rehearsals.toSorted((a, b) => a.startTime.localeCompare(b.startTime)).reduce((acc, r) => { (acc[r.date] ??= []).push(r); return acc; }, {} as Record<string, typeof rehearsals>));
  const today = localDate();
  const calendarValue = $derived($selectedDate ? parseDate($selectedDate) : undefined);
  // Keep the calendar on the month shown by the store, even when the selected day lives in another month.
  const monthIso = $derived(localDate($month));
  const placeholderValue = $derived(parseDate($selectedDate && $selectedDate.slice(0, 7) === monthIso.slice(0, 7) ? $selectedDate : monthIso));
  const toIso = (d: DateValue) => `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
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
  function load() { queries.filter(q => q.isError).forEach(q => q.refetch()); }
  function plan() { openNew({ date: $selectedDate ?? undefined }); }
  async function save(draft: RehearsalDraft) { const rehearsal = await createMut.mutateAsync({ draft }); await goto(`${base}/rehearsals/${rehearsal.id}`); }
  function closeForm() { closeNew(); if (page.url.searchParams.has('new')) goto(`${base}/rehearsals`, { replaceState: true, noScroll: true }); }
</script>

{#if $canAccessRehearsals}
<div class="contents max-[1101px]:hidden">
<PageControls label={$rt.title}>
  {#snippet start()}
    <NavigationMenu.Item class="min-w-0"><Breadcrumb.Root><Breadcrumb.List class="flex-nowrap"><Breadcrumb.Item><Breadcrumb.Page class="inline-flex min-h-10 items-center whitespace-nowrap">{$rt.title}</Breadcrumb.Page></Breadcrumb.Item></Breadcrumb.List></Breadcrumb.Root></NavigationMenu.Item>
  {/snippet}
  {#snippet end()}
    <PageControlsDivider />
    <NavigationMenu.Item class="min-w-0"><ReminderPreferences /></NavigationMenu.Item><NavigationMenu.Item><IconButton icon="➕" variant="default" label={$rt.new} onclick={plan} disabled={loading || !!error} /></NavigationMenu.Item>{/snippet}
</PageControls>
</div>
<div class="fixed inset-x-0 bottom-0 z-40 hidden h-[52px] items-center gap-2 border-t bg-card px-3 max-[1101px]:flex">
  <ReminderPreferences />
  <IconButton class="ml-auto" variant="default" icon="➕" label={$rt.new} onclick={plan} disabled={loading || !!error} />
</div>
<div class="page-shell pt-3! max-[1101px]:pb-[52px]!">
  {#if loading}<LoadingCat />
  {:else if error}
    <Alert variant="destructive" class="flex items-center justify-between gap-3"><AlertDescription>{error}</AlertDescription><Button variant="outline" size="sm" onclick={load}>{$rt.retry}</Button></Alert>
  {:else}
    <div class="grid grid-cols-[minmax(300px,380px)_minmax(0,1fr)] items-start gap-6 max-[1101px]:grid-cols-1 max-[1101px]:gap-4">
      <Card class="min-w-0 gap-3 p-4 max-[600px]:p-2" aria-label={monthLabel} role="region">
        <div class="relative [--cell-size:--spacing(12)] max-[600px]:[--cell-size:--spacing(11)]">
          <ButtonRow class="absolute top-[calc((var(--cell-size)-40px)/2)] right-[calc(var(--cell-size)+8px)] z-10">
            <IconButton icon="↩️" label={$rt.clearDay} onclick={clearDay} class={$selectedDate ? '' : 'invisible'} disabled={!$selectedDate} />
            <IconButton icon="📆" label={$rt.today} onclick={goToday} />
          </ButtonRow>
        <Calendar
          type="single"
          bind:value={() => calendarValue, v => { if (v) selectDay(new Date(v.year, v.month - 1, v.day)); else clearDay(); }}
          bind:placeholder={() => placeholderValue, v => { if (v) setMonth(new Date(v.year, v.month - 1, 1)); }}
          fixedWeeks
          prevLabel={$rt.previous}
          nextLabel={$rt.next}
          weekStartsOn={1}
          locale={$lang === 'ru' ? 'ru-RU' : 'en-GB'}
          class="w-full bg-transparent p-0 [--cell-size:--spacing(12)] max-[600px]:[--cell-size:--spacing(11)] [&_[data-calendar-header]]:justify-start [&_[data-calendar-header]]:pl-[calc(var(--cell-size)+8px)] [&_[data-calendar-header]]:capitalize [&_[role=gridcell]]:flex [&_[role=gridcell]]:h-auto [&_[role=gridcell]]:w-auto [&_[role=gridcell]]:flex-1 [&_th]:w-auto [&_th]:flex-1"
        >
          {#snippet day({ day: date })}
            {@const iso = toIso(date)}
            {@const sessions = countByDate[iso] ?? []}
            {@const past = iso < today}
            {@const isToday = iso === today}
            <CalendarDay
              class={cn('group/day mx-auto h-auto min-h-(--cell-size) w-[calc(100%-4px)] justify-start gap-1 py-1.5 data-outside-month:opacity-45',
                past ? 'bg-neutral/70 text-neutral-ink' : 'bg-card text-foreground ring-1 ring-border ring-inset',
                isToday && 'bg-primary/40 font-bold text-primary-ink ring-2 ring-primary-ink')}
              aria-label={`${formatDate(iso, $lang)} · ${sessions.length}`}
            >
              <span class="leading-none">{date.day}</span>
              {#if sessions.length}
                <span class="flex w-full flex-col items-center gap-0.5">
                  {#each sessions.slice(0, 3) as session (session.id)}
                    <span class={cn('inline-flex w-full max-w-[52px] items-center justify-center rounded border px-0.5 text-[.62rem] leading-[1.35] tabular-nums', timeChip(isPastRehearsal(session), session.cancelled), 'group-data-[selected]/day:border-primary-foreground/60 group-data-[selected]/day:text-primary-foreground')}>{session.startTime.slice(0, 5)}</span>
                  {/each}
                  {#if sessions.length > 3}<span class="text-[.62rem] leading-none text-muted-foreground group-data-[selected]/day:text-primary-foreground">+{sessions.length - 3}</span>{/if}
                </span>
              {/if}
            </CalendarDay>
          {/snippet}
        </Calendar>
        </div>
      </Card>
      <section class="min-w-0" aria-live="polite">
        {#if $selectedDate}
          <h2 class="mb-3 text-base font-bold">{formatDate($selectedDate, $lang)}</h2>
          {#if daySessions.length}<RehearsalList rehearsals={daySessions} />
          {:else}<Empty class="border"><EmptyHeader><EmptyTitle class="text-[.9rem] font-normal text-muted-foreground">{$rt.noSessions}</EmptyTitle></EmptyHeader><EmptyContent><Button variant="outline" size="sm" onclick={plan}>{$rt.new}</Button></EmptyContent></Empty>{/if}
        {:else}
          <h2 class="mb-3 text-base font-bold">{$rt.upcoming}</h2>
          {#if upcoming.length}<RehearsalList rehearsals={upcoming} />
          {:else}<Empty class="border py-4"><EmptyHeader><EmptyTitle class="text-[.9rem] font-normal text-muted-foreground">{$rt.noUpcoming}</EmptyTitle></EmptyHeader></Empty>{/if}
        {/if}
      </section>
    </div>
  {/if}
</div>
{#if $showNew && !loading}<RehearsalForm initial={$initial} onsubmit={save} onclose={closeForm} />{/if}
{/if}
