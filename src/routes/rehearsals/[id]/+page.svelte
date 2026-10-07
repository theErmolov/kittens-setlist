<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { authLoading, canAccessRehearsals } from '$lib/auth';
  import { lang, t } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { getRehearsal, getSetlists, getSongs, getMusicians, updateRehearsal, createRehearsal, deleteRehearsal, updateRehearsalProgress } from '$lib/api';
  import { rehearsalReadiness, rehearsalSongKey, localDate, setlistParticipants } from '$lib/rehearsals';
  import { formatDate, INSTRUMENT_ICONS, pctBubbleStyle } from '$lib/utils';
  import type { Rehearsal, RehearsalDraft, RehearsalSong, Setlist, Song, BandMusician, LearningStage } from '$lib/types';
  import RehearsalForm from '$components/rehearsals/RehearsalForm.svelte';
  import RehearsalSongPicker from '$components/rehearsals/RehearsalSongPicker.svelte';
  import LyricsOverlay from '$components/stage/LyricsOverlay.svelte';

  let rehearsal = $state<Rehearsal | null>(null);
  let setlists = $state<Setlist[]>([]), catalog = $state<Song[]>([]), musicians = $state<BandMusician[]>([]);
  let loading = $state(true), error = $state(''), busy = $state(false);
  let showForm = $state(false), repeating = $state(false), showPicker = $state(false);
  let expanded = $state<string | null>(null), lyrics = $state<Song | null>(null);
  let notes = $state<Record<string, string>>({});
  const id = $derived(page.params.id!);
  const linked = $derived(setlists.find(s => s.id === rehearsal?.setlistId));
  const attendeeOptions = $derived([...new Set([...(linked ? setlistParticipants(linked) : musicians.filter(m => !m.guest).map(m => m.name)), ...(rehearsal?.attendees ?? [])])]);
  const formInitial = $derived(rehearsal ? { ...rehearsal, ...(repeating ? { date: localDate(), cancelled: false } : {}) } : {});
  $effect(() => {
    if ($authLoading) return;
    if (!$canAccessRehearsals) { goto(`${base}/backlog`); return; }
    const target = id;
    let active = true;
    loading = true; error = ''; rehearsal = null;
    Promise.all([getRehearsal(target), getSetlists(), getSongs(), getMusicians()]).then(([r,s,c,m]) => {
      if (!active) return;
      rehearsal = r; setlists = s; catalog = c; musicians = m; resetNotes(); loading = false;
    }).catch(() => { if (active) { error = $rt.error; loading = false; } });
    return () => { active = false; };
  });
  function resetNotes() { notes = Object.fromEntries((rehearsal?.songs ?? []).map(s => [rehearsalSongKey(s), s.note ?? ''])); }
  async function reload() {
    if (!rehearsal) { location.reload(); return; }
    busy = true; error = '';
    try { rehearsal = await getRehearsal(id); resetNotes(); } catch { error = $rt.error; }
    finally { busy = false; }
  }
  async function persist(patch: Partial<Rehearsal>) {
    if (!rehearsal || busy) return;
    busy = true; error = '';
    try {
      const before = rehearsal;
      rehearsal = await updateRehearsal({ ...before, ...patch });
      notes = Object.fromEntries(rehearsal.songs.map(song => {
        const key = rehearsalSongKey(song);
        const saved = before.songs.find(s => rehearsalSongKey(s) === key)?.note ?? '';
        return [key, notes[key] !== undefined && notes[key] !== saved ? notes[key] : song.note ?? ''];
      }));
    }
    catch(e) { error = String(e).includes('409') ? $rt.conflict : $rt.saveError; throw e; }
    finally { busy = false; }
  }
  function action(patch: Partial<Rehearsal>) { return persist(patch).catch(() => {}); }
  async function saveForm(draft: RehearsalDraft) {
    if (repeating) { const created = await createRehearsal(draft, rehearsal?.id); showForm = false; await goto(`${base}/rehearsals/${created.id}`); }
    else { await persist(draft); showForm = false; }
  }
  async function chooseSongs(songs: RehearsalSong[]) { await persist({ songs }); showPicker = false; }
  function toggleAttendee(name: string) {
    if (!rehearsal) return;
    action({ attendees: rehearsal.attendees.includes(name) ? rehearsal.attendees.filter(n => n !== name) : [...rehearsal.attendees, name] });
  }
  function move(index: number, delta: number) {
    if (!rehearsal) return;
    const songs = [...rehearsal.songs]; [songs[index], songs[index + delta]] = [songs[index + delta], songs[index]]; action({ songs });
  }
  async function progress(item: RehearsalSong, name: string, stage: LearningStage) {
    if (!rehearsal || busy) return;
    busy = true; error = '';
    try {
      rehearsal = await updateRehearsalProgress(id, item, name, stage);
      // Picker readiness should also reflect this latest canonical progress.
      catalog = catalog.map(song => song.id === item.songId ? { ...song, progress: { ...(song.progress ?? {}), [name]: stage } } : song);
    } catch { error = $rt.progressError; }
    finally { busy = false; }
  }
  async function toggleCancelled() { if (rehearsal && (rehearsal.cancelled || confirm($rt.cancelConfirm))) await action({ cancelled: !rehearsal.cancelled }); }
  async function remove() {
    if (!rehearsal || !confirm($rt.deleteConfirm)) return;
    busy = true; error = '';
    try { await deleteRehearsal(rehearsal); await goto(`${base}/rehearsals`); }
    catch(e) { error = String(e).includes('409') ? $rt.conflict : $rt.saveError; }
    finally { busy = false; }
  }
</script>

{#if $canAccessRehearsals}
<div class="page">
  <a class="back" href="{base}/rehearsals">‹ {$rt.title}</a>
  {#if error}<div class="error" role="alert">{error} <button onclick={reload} disabled={busy}>{$rt.reload}</button></div>{/if}
  {#if loading}<p>{$rt.loading}</p>
  {:else if rehearsal}
    <header>
      <div><h1>{formatDate(rehearsal.date, $lang)}</h1><div class="time">{rehearsal.startTime}{rehearsal.endTime ? `–${rehearsal.endTime}` : ''} <small>{rehearsal.timeZone}</small></div></div>
      <button onclick={() => { repeating = false; showForm = true; }} disabled={busy}>{$rt.edit}</button>
    </header>
    {#if rehearsal.cancelled}<p class="cancelled">{$rt.cancelledHint}</p>{/if}
    {#if rehearsal.location}<p class="location">{rehearsal.location}</p>{/if}
    {#if linked}<a class="setlist" href="{base}/setlists/{linked.id}">{$rt.setlist}: {linked.name}</a>
    {:else if rehearsal.setlistId}<p class="muted">{$rt.unavailableSetlist}</p>{/if}
    {#if rehearsal.note}<p class="note">{rehearsal.note}</p>{/if}
    <section class="attendees"><h2>{$rt.attendees}</h2><p class="muted hint">{$rt.attendeesHint}</p><div class="chips">
      {#each attendeeOptions as name}<button class:chosen={rehearsal.attendees.includes(name)} aria-pressed={rehearsal.attendees.includes(name)} onclick={() => toggleAttendee(name)} disabled={busy || rehearsal.cancelled}>{name}{rehearsal.attendees.includes(name) ? ' ✓' : ''}</button>{/each}
    </div></section>
    <div class="song-heading"><h2>{$rt.songs} <span>{rehearsal.songs.length}</span></h2><button class="primary" onclick={() => { showPicker = true; }} disabled={busy || rehearsal.cancelled}>+ {$rt.addSongs}</button></div>
    {#if !rehearsal.songs.length}<p class="empty">{$rt.emptySongs}</p>{/if}
    <div class="song-list">
    {#each rehearsal.songs as item, index (rehearsalSongKey(item))}
      {@const songKey = rehearsalSongKey(item)}
      {@const pct = rehearsalReadiness(item.song, rehearsal.attendees)}
      {@const missing = Object.keys(item.song.musicians).filter(name => item.song.musicians[name].instruments.length && !rehearsal!.attendees.includes(name))}
      <article class="song">
        <div class="song-row">
          <button class="song-title" aria-expanded={expanded === songKey} onclick={() => { expanded = expanded === songKey ? null : songKey; }}><strong>{item.song.title}</strong><small>{item.song.artist}</small></button>
          <span class="pct" style={pct !== null ? pctBubbleStyle(pct) : ''} title={$rt.sessionReadiness}>{pct !== null ? `${pct}%` : '—'}</span>
          <div class="order"><button aria-label={$rt.up} onclick={() => move(index, -1)} disabled={busy || rehearsal.cancelled || index === 0}>↑</button><button aria-label={$rt.down} onclick={() => move(index, 1)} disabled={busy || rehearsal.cancelled || index === rehearsal!.songs.length - 1}>↓</button></div>
        </div>
        {#if pct === null}<p class="song-hint">{$rt.noPlayers}</p>{/if}
        {#if missing.length}<p class="song-hint">{$rt.missing}: {missing.join(', ')}</p>{/if}
        {#if item.note && expanded !== songKey}<p class="song-note">{item.note}</p>{/if}
        {#if expanded === songKey}
          <div class="details">
            <p class="muted">{$rt.fullReadiness}: {rehearsalReadiness(item.song) ?? '—'}{rehearsalReadiness(item.song) !== null ? '%' : ''}</p>
            {#if item.sourceMissing}<p class="muted">{$rt.sourceMissing}</p>{/if}
            {#each Object.entries(item.song.musicians).filter(([, role]) => role.instruments.length) as [name, role]}
              <label class="musician" class:absent={!rehearsal.attendees.includes(name)}><span>{name} <small>{role.instruments.map(i => INSTRUMENT_ICONS[i]).join(' ')}</small></span>
                <select value={item.song.progress?.[name] ?? 'queue'} aria-label={`${name} · ${$t.song.progress}`} onchange={event => progress(item, name, event.currentTarget.value as LearningStage)} disabled={busy || rehearsal.cancelled || !rehearsal.attendees.includes(name) || (item.sourceMissing && !catalog.some(s => s.id === item.songId))}>
                  {#each ['queue', 'structure', 'mastering', 'ready'] as stage}<option value={stage}>{$t.progress[stage as LearningStage]}</option>{/each}
                </select>
              </label>
            {/each}
            {#if item.song.comment}<p class="note muted">{item.song.comment}</p>{/if}
            <label class="note-label">{$rt.songNote}<textarea bind:value={notes[songKey]} maxlength="4000" rows="2" disabled={busy || rehearsal.cancelled}></textarea></label>
            <div class="detail-actions">
              <button onclick={() => action({ songs: rehearsal!.songs.map(s => rehearsalSongKey(s) === songKey ? { ...s, note: notes[songKey] } : s) })} disabled={busy || rehearsal.cancelled || (notes[songKey] ?? '') === (item.note ?? '')}>{$rt.save}</button>
              {#if item.song.lyrics}<button onclick={() => { lyrics = item.song; }}>{$rt.lyrics}</button>{/if}
              <button class="danger" onclick={() => action({ songs: rehearsal!.songs.filter(s => rehearsalSongKey(s) !== songKey) })} disabled={busy || rehearsal.cancelled}>{$rt.remove}</button>
            </div>
          </div>
        {/if}
      </article>
    {/each}
    </div>
    <footer><button onclick={() => { repeating = true; showForm = true; }} disabled={busy}>{$rt.repeat}</button><button onclick={toggleCancelled} disabled={busy}>{rehearsal.cancelled ? $rt.restore : $rt.cancelSession}</button><button class="danger" onclick={remove} disabled={busy}>{$rt.delete}</button></footer>
  {/if}
</div>
{#if showForm && rehearsal}<RehearsalForm title={repeating ? $rt.repeat : $rt.edit} initial={formInitial} {setlists} {musicians} onsubmit={saveForm} onclose={() => { showForm = false; }} />{/if}
{#if showPicker && rehearsal}<RehearsalSongPicker {rehearsal} setlist={linked} {catalog} onsave={chooseSongs} onclose={() => { showPicker = false; }} />{/if}
{#if lyrics}<LyricsOverlay song={lyrics} onclose={() => { lyrics = null; }} onsavetranspose={async song => { lyrics = song; return song; }} />{/if}
{/if}
<style>
  .page { max-width: 820px; margin: 0 auto; padding: 22px 16px 48px; }
  .back { display: inline-block; margin-bottom: 22px; color: var(--text-muted); text-decoration: none; font-size: .85rem; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; } h1 { font-size: 1.5rem; margin: 0 0 8px; } h2 { font-size: 1rem; margin: 0; }
  .time { font-size: 1.3rem; color: var(--accent); } .time small { color: var(--text-muted); font-size: .7rem; }
  button { border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; background: var(--surface); color: var(--text); cursor: pointer; } button:disabled { opacity: .5; cursor: default; }
  .primary, .chosen { background: var(--accent); color: #fff; border-color: var(--accent); }
  .location { font-size: 1rem; } .setlist { display: inline-block; color: var(--accent); font-size: .85rem; margin: 4px 0 10px; text-decoration: none; }
  .note { white-space: pre-wrap; overflow-wrap: anywhere; font-size: .9rem; } .muted { color: var(--text-muted); font-size: .8rem; }
  .attendees { margin: 24px 0 30px; } .hint { margin: 8px 0 12px; } .chips { display: flex; gap: 8px; flex-wrap: wrap; }
  .song-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; } h2 span { color: var(--text-muted); margin-left: 6px; }
  .song-list { display: flex; flex-direction: column; gap: 10px; } .song { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); overflow: clip; }
  .song-row { display: flex; gap: 12px; align-items: center; padding: 12px 14px; }
  .song-title { flex: 1; min-width: 0; padding: 0; text-align: left; border: 0; background: transparent; } .song-title strong { font-size: .95rem; } .song-title small { display: block; font-size: .78rem; color: var(--text-muted); margin-top: 4px; }
  .pct { padding: 5px 8px; border-radius: 12px; font-size: .8rem; font-weight: 650; flex-shrink: 0; } .order { display: flex; gap: 4px; } .order button { padding: 5px 8px; }
  .song-hint { font-size: .75rem; color: var(--text-muted); margin: 0 14px 9px; } .song-note { font-size: .85rem; white-space: pre-wrap; margin: 0 14px 12px; overflow-wrap: anywhere; }
  .details { padding: 14px; border-top: 1px solid var(--border); } .details > p:first-child { margin-top: 0; }
  .musician { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 12px 0; font-size: .85rem; } .musician small { margin-left: 5px; } .absent { opacity: .5; }
  select, textarea { border: 1px solid var(--border); border-radius: 7px; background: var(--bg); color: var(--text); padding: 8px; font: inherit; }
  .note-label { display: flex; flex-direction: column; gap: 8px; font-size: .8rem; margin-top: 18px; color: var(--text-muted); }
  .detail-actions, footer { display: flex; gap: 8px; flex-wrap: wrap; } .detail-actions { margin-top: 10px; } footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border); }
  .danger { color: #dc2626; } .empty { color: var(--text-muted); padding: 22px 0; } .cancelled { padding: 12px; border-radius: 8px; background: var(--bg); color: var(--text-muted); }
  .error { color: #dc2626; padding: 12px 0; font-size: .85rem; }
  @media(max-width:600px) { h1 { font-size: 1.2rem; } .time { font-size: 1.1rem; } .song-row { gap: 8px; padding: 12px 10px; } .order { flex-direction: column; } select, textarea { font-size: 16px; } .musician { flex-wrap: wrap; } .song-heading .primary { font-size: .75rem; } }
</style>
