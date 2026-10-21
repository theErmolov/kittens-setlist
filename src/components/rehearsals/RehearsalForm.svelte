<script lang="ts">
  import RehearsalSelection from './RehearsalSelection.svelte';
  import { mergeRehearsalSongs } from '$lib/rehearsals';
  import { untrack } from 'svelte';
  import { lang } from '$lib/i18n';
  import { formatDate } from '$lib/utils';
  import { modalDialog } from '$lib/modalDialog';
  import type { RehearsalDraft, Setlist, BandMusician, Song, RehearsalSong } from '$lib/types';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { localDate, setlistParticipants, closestUpcomingSetlist, upcomingSetlists } from '$lib/rehearsals';
  let { initial = {}, title, setlists, musicians, catalog, onsubmit, onclose }: {
    initial?: Partial<RehearsalDraft>; title?: string; setlists: Setlist[]; musicians: BandMusician[]; catalog: Song[];
    onsubmit: (draft: RehearsalDraft) => Promise<void>; onclose: () => void;
  } = $props();
  const seed = untrack(() => initial);
  const formatInputDate = (iso: string) => iso.split('-').reverse().join('.');
  let dateText = $state(formatInputDate(seed.date ?? localDate()));
  const date = $derived(dateText.split('.').reverse().join('-'));
  let startTime = $state(seed.startTime ?? '19:00');
  const timeZone = seed.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  let location = $state(seed.location ?? '');
  let note = $state(seed.note ?? '');
  let autoSelect = $state(seed.setlistId === undefined && seed.attendees === undefined && seed.songs === undefined);
  let attendanceTouched = $state(false);
  let setlistId = $state(seed.setlistId ?? untrack(() => autoSelect ? closestUpcomingSetlist(upcomingSetlists(setlists), date, startTime)?.id ?? '' : ''));
  const sortedSetlists = $derived(upcomingSetlists(setlists));
  const defaults = (id: string) => {
    const setlist = setlists.find(s => s.id === id);
    return setlist ? setlistParticipants(setlist) : musicians.filter(m => !m.guest).map(m => m.name);
  };
  let attendees = $state<string[]>(seed.attendees ? [...seed.attendees] : untrack(() => defaults(setlistId)));
  let songs = $state<RehearsalSong[]>(seed.songs ? [...seed.songs] : []);
  let busy = $state(false);
  let error = $state('');
  $effect(() => {
    if (!autoSelect || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const next = closestUpcomingSetlist(upcomingSetlists(setlists), date, startTime)?.id ?? '';
    untrack(() => {
      if (setlistId === next) return;
      setlistId = next;
      if (!attendanceTouched) attendees = defaults(next);
    });
  });
  async function save(event: SubmitEvent) {
    event.preventDefault(); if (busy) return;
    error = '';
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) { error = $rt.invalidDate; return; }
    busy = true;
    try {
      await onsubmit({ date, startTime, endTime: undefined, timeZone, location: location.trim() || undefined, note: note.trim() || undefined, setlistId: setlistId || undefined, attendees, songs: mergeRehearsalSongs(seed.songs ?? [], songs), cancelled: seed.cancelled ?? false });
    } catch (e) { error = String(e).includes('409') ? $rt.conflict : $rt.saveError; }
    finally { busy = false; }
  }
</script>

<div class="overlay">
  <dialog class="modal" aria-labelledby="rehearsal-form-title" use:modalDialog={() => { if (!busy) onclose(); }}>
    <h2 id="rehearsal-form-title">{title ?? $rt.new}</h2>
    <form onsubmit={save}>
      <fieldset disabled={busy}>
        <div class="details-fields">
          <div class="times">
            <div class="date-control">
              <label for="rehearsal-date">{$rt.date}</label>
              <div class="date-input">
                <input id="rehearsal-date" type="text" inputmode="decimal" bind:value={dateText} placeholder="08.10.2026" pattern={'[0-9]{2}[.][0-9]{2}[.][0-9]{4}'} maxlength="10" required />
                <span class="calendar-picker">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 11h18M8 3v4M16 3v4" /></svg>
                  <input class="native-date" type="date" value={date} aria-label={$rt.chooseDate} oninput={event => { if (event.currentTarget.value) dateText = formatInputDate(event.currentTarget.value); }} />
                </span>
              </div>
            </div>
            <label>{$rt.start}<input type="time" bind:value={startTime} required /></label>
          </div>
          <label>{$rt.location}<input bind:value={location} maxlength="500" /></label>
          <label>{$rt.setlist}
            <select bind:value={setlistId} onchange={() => { autoSelect = false; if (!attendanceTouched) attendees = defaults(setlistId); }}>
              <option value="">{$rt.noSetlist}</option>
              {#if setlistId && !sortedSetlists.some(s => s.id === setlistId)}
                {@const current = setlists.find(s => s.id === setlistId)}
                <option value={setlistId} disabled>{current ? `${current.name}${current.date ? ` · ${formatDate(current.date, $lang)}` : ''}` : $rt.unavailableSetlist}</option>
              {/if}
              {#each sortedSetlists as setlist}<option value={setlist.id}>{setlist.name}{setlist.date ? ` · ${formatDate(setlist.date, $lang)}` : ''}</option>{/each}
            </select>
          </label>
          <label>{$rt.note}<textarea bind:value={note} rows="3" maxlength="4000"></textarea></label>
        </div>
        <fieldset class="selection-fields" disabled={seed.cancelled}>
          <RehearsalSelection setlist={setlists.find(s => s.id === setlistId)} {catalog} {musicians} bind:attendees bind:selected={songs} onattendancechange={() => { attendanceTouched = true; }} />
        </fieldset>
      </fieldset>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="actions"><button type="button" onclick={onclose} disabled={busy}>{$rt.cancel}</button><button class="primary" disabled={busy}>{busy ? $rt.pending : $rt.save}</button></div>
    </form>
  </dialog>
</div>
<style>
  .overlay { position: fixed; inset: 0; z-index: 150; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .modal { margin: auto; width: min(1000px, 100%); max-height: 90dvh; overflow-y: auto; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 22px; }
  .modal::backdrop { background: #0008; }
  h2 { font-size: 1.2rem; margin: 0 0 20px; }
  fieldset { border: 0; padding: 0; margin: 0; display: grid; grid-template-columns: minmax(220px, .8fr) minmax(0, 1.6fr); gap: 24px; min-width: 0; align-items: start; }
  .selection-fields { display: block; }
  .details-fields { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  label { display: flex; flex-direction: column; gap: 6px; font-size: .85rem; color: var(--text-muted); }
  input, select, textarea { box-sizing: border-box; width: 100%; min-width: 0; border: 1px solid var(--border); border-radius: 7px; padding: 9px; background: var(--bg); color: var(--text); font: inherit; }
  .times { display: flex; flex-wrap: wrap; gap: 10px; }
  .times > label { flex: 1 1 110px; }
  .date-control { flex: 1 1 160px; display: flex; flex-direction: column; gap: 6px; }
  .date-input { position: relative; }
  .date-input > input { padding-right: 44px; }
  .calendar-picker { position: absolute; right: 0; top: 0; bottom: 0; width: 40px; display: grid; place-items: center; color: var(--text-muted); }
  .calendar-picker:focus-within { outline: 2px solid var(--accent); border-radius: 7px; }
  .native-date { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; padding: 0; cursor: pointer; }
  .native-date::-webkit-calendar-picker-indicator { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; cursor: pointer; }
  button { font: inherit; border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; background: var(--bg); color: var(--text); cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  .primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
  .error { color: #dc2626; font-size: .85rem; }
  @media(max-width: 700px) { fieldset { grid-template-columns: minmax(0, 1fr); gap: 20px; } }
  @media(max-width: 600px) { input, select, textarea { font-size: 16px; } .modal { padding: 16px; } }
</style>
