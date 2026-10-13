<script lang="ts">
  import { untrack } from 'svelte';
  import { modalDialog } from '$lib/modalDialog';
  import type { RehearsalDraft, Setlist, BandMusician } from '$lib/types';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { localDate, setlistParticipants } from '$lib/rehearsals';
  let { initial = {}, title, setlists, musicians, onsubmit, onclose }: {
    initial?: Partial<RehearsalDraft>; title?: string; setlists: Setlist[]; musicians: BandMusician[];
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
  let setlistId = $state(seed.setlistId ?? '');
  const defaults = (id: string) => {
    const setlist = setlists.find(s => s.id === id);
    return setlist ? setlistParticipants(setlist) : musicians.filter(m => !m.guest).map(m => m.name);
  };
  let attendees = $state<string[]>(seed.attendees ? [...seed.attendees] : untrack(() => defaults(setlistId)));
  let guests = $state<string[]>(seed.attendees ? [...seed.attendees] : []);
  let guest = $state('');
  let busy = $state(false);
  let error = $state('');
  const names = $derived([...new Set([...defaults(setlistId), ...attendees, ...guests])]);
  function toggle(name: string) { attendees = attendees.includes(name) ? attendees.filter(n => n !== name) : [...attendees, name]; }
  function addGuest() {
    const name = guest.trim();
    if (!name) return;
    guests = [...new Set([...guests, name])]; attendees = [...new Set([...attendees, name])]; guest = '';
  }
  async function save(event: SubmitEvent) {
    event.preventDefault(); if (busy) return;
    error = '';
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) { error = $rt.invalidDate; return; }
    busy = true;
    try {
      await onsubmit({ date, startTime, endTime: undefined, timeZone, location: location.trim() || undefined, note: note.trim() || undefined, setlistId: setlistId || undefined, attendees, songs: seed.songs ?? [], cancelled: seed.cancelled ?? false });
    } catch (e) { error = String(e).includes('409') ? $rt.conflict : $rt.saveError; }
    finally { busy = false; }
  }
</script>

<div class="overlay">
  <dialog class="modal" aria-labelledby="rehearsal-form-title" use:modalDialog={() => { if (!busy) onclose(); }}>
    <h2 id="rehearsal-form-title">{title ?? $rt.new}</h2>
    <form onsubmit={save}>
      <fieldset disabled={busy}>
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
          <select bind:value={setlistId} onchange={() => { attendees = defaults(setlistId); }}>
            <option value="">{$rt.noSetlist}</option>
            {#if setlistId && !setlists.some(s => s.id === setlistId)}<option value={setlistId}>{$rt.unavailableSetlist}</option>{/if}
            {#each setlists as setlist}<option value={setlist.id}>{setlist.name}</option>{/each}
          </select>
        </label>
        <div class="attendees-header"><strong>{$rt.attendees}</strong><button type="button" onclick={() => { attendees = [...names]; }}>{$rt.all}</button><button type="button" onclick={() => { attendees = []; }}>{$rt.none}</button></div>
        <p class="hint">{$rt.attendeesHint}</p>
        <div class="chips">
          {#each names as name}<button type="button" class:chosen={attendees.includes(name)} aria-pressed={attendees.includes(name)} onclick={() => toggle(name)}>{name}{attendees.includes(name) ? ' ✓' : ''}</button>{/each}
        </div>
        <div class="guest"><input bind:value={guest} placeholder={$rt.guest} maxlength="100" onkeydown={e => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }} /><button type="button" onclick={addGuest}>{$rt.add}</button></div>
        <label>{$rt.note}<textarea bind:value={note} rows="3" maxlength="4000"></textarea></label>
      </fieldset>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="actions"><button type="button" onclick={onclose} disabled={busy}>{$rt.cancel}</button><button class="primary" disabled={busy}>{busy ? $rt.pending : $rt.save}</button></div>
    </form>
  </dialog>
</div>
<style>
  .overlay { position: fixed; inset: 0; z-index: 150; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .modal { width: min(560px, 100%); max-height: 90dvh; overflow-y: auto; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 22px; }
  .modal::backdrop { background: #0008; }
  h2 { font-size: 1.2rem; margin: 0 0 20px; }
  fieldset { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  label { display: flex; flex-direction: column; gap: 6px; font-size: .85rem; color: var(--text-muted); }
  input, select, textarea { box-sizing: border-box; width: 100%; min-width: 0; border: 1px solid var(--border); border-radius: 7px; padding: 9px; background: var(--bg); color: var(--text); font: inherit; }
  .times { display: grid; grid-template-columns: 1.3fr 1fr; gap: 10px; }
  .date-control { display: flex; flex-direction: column; gap: 6px; }
  .date-input { position: relative; }
  .date-input > input { padding-right: 44px; }
  .calendar-picker { position: absolute; right: 0; top: 0; bottom: 0; width: 40px; display: grid; place-items: center; color: var(--text-muted); }
  .calendar-picker:focus-within { outline: 2px solid var(--accent); border-radius: 7px; }
  .native-date { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; padding: 0; cursor: pointer; }
  .native-date::-webkit-calendar-picker-indicator { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; cursor: pointer; }
  button { border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; background: var(--bg); color: var(--text); cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  .attendees-header { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .attendees-header strong { margin-right: auto; }
  .attendees-header button { font-size: .75rem; padding: 5px 8px; }
  .chips { display: flex; gap: 7px; flex-wrap: wrap; }
  .chosen, .primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .hint { margin: -5px 0 0; font-size: .78rem; color: var(--text-muted); }
  .guest { display: flex; gap: 8px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
  .error { color: #dc2626; font-size: .85rem; }
  @media(max-width: 600px) { input, select, textarea { font-size: 16px; } .times { grid-template-columns: 1fr 1fr; } .times label:first-child { grid-column: 1 / -1; } .modal { padding: 16px; } }
</style>
