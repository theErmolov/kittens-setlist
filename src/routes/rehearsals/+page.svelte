<script lang="ts">
  import ReminderPreferences from '$components/shared/ReminderPreferences.svelte';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authLoading, canAccessRehearsals } from '$lib/auth';
  import { lang } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { getRehearsals, getSetlists, getMusicians, createRehearsal } from '$lib/api';
  import type { Rehearsal, RehearsalDraft, Setlist, BandMusician } from '$lib/types';
  import { calendarDays, localDate, isUpcoming } from '$lib/rehearsals';
  import { formatDate } from '$lib/utils';
  import RehearsalCard from '$components/rehearsals/RehearsalCard.svelte';
  import RehearsalForm from '$components/rehearsals/RehearsalForm.svelte';

  let rehearsals = $state<Rehearsal[]>([]);
  let setlists = $state<Setlist[]>([]);
  let musicians = $state<BandMusician[]>([]);
  let started = $state(false);
  let loading = $state(true);
  let error = $state('');
  let selectedDate = $state(localDate());
  let month = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  let showNew = $state(false);
  let initial = $state<Partial<RehearsalDraft>>({});
  const upcoming = $derived(rehearsals.filter(r => isUpcoming(r)).sort((a,b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)));
  const days = $derived(calendarDays(month));
  const daySessions = $derived(rehearsals.filter(r => r.date === selectedDate).sort((a,b) => a.startTime.localeCompare(b.startTime)));
  const monthLabel = $derived(new Intl.DateTimeFormat($lang === 'ru' ? 'ru-RU' : 'en-GB', { month: 'long', year: 'numeric' }).format(month));
  const setlistName = (id?: string) => setlists.find(s => s.id === id)?.name;
  $effect(() => {
    if ($authLoading) return;
    if (!$canAccessRehearsals) { goto(`${base}/backlog`); return; }
    if (started) return;
    started = true;
    load();
  });
  async function load() {
    loading = true; error = '';
    try {
      [rehearsals, setlists, musicians] = await Promise.all([getRehearsals(), getSetlists(), getMusicians()]);
      if (page.url.searchParams.get('new') === '1') {
        initial = { date: selectedDate, setlistId: page.url.searchParams.get('setlist') ?? undefined };
        showNew = true;
      }
    } catch { error = $rt.error; }
    finally { loading = false; }
  }
  function moveMonth(delta: number) {
    month = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    const day = Math.min(Number(selectedDate.slice(-2)), new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
    selectedDate = localDate(new Date(month.getFullYear(), month.getMonth(), day));
  }
  function selectDay(date: Date) { selectedDate = localDate(date); if (date.getMonth() !== month.getMonth()) month = new Date(date.getFullYear(), date.getMonth(), 1); }
  function plan() { initial = { date: selectedDate }; showNew = true; }
  async function save(draft: RehearsalDraft) { const rehearsal = await createRehearsal(draft); await goto(`${base}/rehearsals/${rehearsal.id}`); }
  function closeForm() { showNew = false; if (page.url.searchParams.has('new')) goto(`${base}/rehearsals`, { replaceState: true, noScroll: true }); }
</script>

{#if $canAccessRehearsals}
<div class="page">
  <header><ReminderPreferences /><button class="primary" onclick={plan} disabled={loading || !!error}>{$rt.new}</button></header>
  {#if loading}<p class="loading"><LoadingCat /></p>
  {:else if error}<p class="error" role="alert">{error}</p><button onclick={load}>{$rt.retry}</button>
  {:else}
    <h2>{$rt.upcoming}</h2>
    {#if upcoming.length}
      <div class="upcoming" aria-label={$rt.upcoming}>
        {#each upcoming as rehearsal (rehearsal.id)}<div class="card-slot"><RehearsalCard {rehearsal} {musicians} setlistName={setlistName(rehearsal.setlistId)} /></div>{/each}
      </div>
    {:else}<p class="empty upcoming-empty">{$rt.noUpcoming}</p>{/if}
    <div class="calendar-layout">
      <section class="calendar" aria-label={monthLabel}>
        <div class="calendar-header">
          <button onclick={() => moveMonth(-1)} aria-label={$rt.previous}>‹</button><h2>{monthLabel}</h2><button onclick={() => moveMonth(1)} aria-label={$rt.next}>›</button>
          <button class="today" onclick={() => { selectedDate = localDate(); month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); }}>{$rt.today}</button>
        </div>
        <div class="grid weekdays">{#each $rt.weekdays as day}<span>{day}</span>{/each}</div>
        <div class="grid dates">
          {#each days as day}
            {@const date = localDate(day)}
            {@const sessions = rehearsals.filter(r => r.date === date)}
            <button class="day" class:outside={day.getMonth() !== month.getMonth()} class:selected={date === selectedDate} class:current={date === localDate()} aria-pressed={date === selectedDate} aria-label={`${formatDate(date, $lang)} · ${sessions.length}`} onclick={() => selectDay(day)}>
              <span class="day-number">{day.getDate()}</span>
              <span class="markers">{#each sessions.slice(0,3) as session}<span class="marker" class:cancelled={session.cancelled}>{session.startTime}</span>{/each}{#if sessions.length > 3}<span class="more">+{sessions.length - 3}</span>{/if}</span>
            </button>
          {/each}
        </div>
      </section>
      <section class="day-list">
        <div class="day-heading"><h2>{formatDate(selectedDate, $lang)}</h2></div>
        {#if daySessions.length}<div class="session-list">{#each daySessions as rehearsal (rehearsal.id)}<RehearsalCard {rehearsal} {musicians} setlistName={setlistName(rehearsal.setlistId)} />{/each}</div>
        {:else}<p class="empty">{$rt.noSessions}</p>{/if}
      </section>
    </div>
  {/if}
</div>
{#if showNew && !loading}<RehearsalForm {initial} {setlists} {musicians} onsubmit={save} onclose={closeForm} />{/if}
{/if}
<style>
  .loading { padding: 40px 20px; }
  .page { max-width: 1000px; margin: 0 auto; padding: 24px 16px 48px; }
  header, .day-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  header { flex-wrap: nowrap; margin-bottom: 24px; } header .primary { flex-shrink: 0; margin-left: auto; } h2 { font-size: 1rem; margin: 0 0 12px; }
  button { border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; background: var(--surface); color: var(--text); cursor: pointer; } button:disabled { opacity: .5; cursor: default; }
  .primary { padding: 8px 18px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.88rem; }
  .upcoming { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x proximity; padding-bottom: 12px; margin-bottom: 20px; }
  .card-slot { flex: 0 0 265px; scroll-snap-align: start; }
  .calendar-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
  .calendar { min-width: 0; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 16px; }
  .calendar-header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .calendar-header h2 { margin: 0; text-transform: capitalize; text-align: center; flex: 1; font-size: 1.15rem; }
  .calendar-header button { font-size: 1.4rem; padding: 3px 12px; }
  .calendar-header .today { font-size: .8rem; padding: 8px; }
  .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .weekdays { text-align: center; font-size: .8rem; color: var(--text-muted); margin-bottom: 10px; }
  .dates { gap: 5px; }
  .day { min-height: 70px; padding: 6px 3px; display: flex; flex-direction: column; gap: 8px; text-align: left; background: var(--bg); border-color: transparent; }
  .day:hover { border-color: var(--accent); } .day.selected { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
  .day.outside { opacity: .45; } .day-number { font-weight: 600; font-size: .85rem; } .day.current .day-number { color: var(--accent); text-decoration: underline; text-underline-offset: 4px; }
  .markers { display: flex; flex-wrap: wrap; gap: 3px; } .marker { background: var(--accent); color: #fff; border-radius: 4px; padding: 2px; font-size: .65rem; } .marker.cancelled { background: var(--border); color: var(--text-muted); text-decoration: line-through; }
  .more { font-size: .7rem; color: var(--text-muted); }
  .day-list { min-width: 0; } .day-heading { margin-bottom: 12px; } .day-heading h2 { margin: 0; }
  .session-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .empty { color: var(--text-muted); padding: 16px 0; font-size: .9rem; } .upcoming-empty { margin-bottom: 20px; } .error { color: #dc2626; }
  @media(max-width: 700px) { .calendar-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; } }
  @media(max-width: 600px) { .page { padding: 18px 10px 40px; } .calendar { padding: 10px 6px; } .dates { gap: 3px; } .day { min-height: 65px; padding: 5px 3px; } .marker { font-size: .58rem; padding: 1px 2px; } .calendar-header { gap: 5px; } .calendar-header h2 { font-size: 1rem; } .card-slot { flex-basis: 245px; } }
</style>
