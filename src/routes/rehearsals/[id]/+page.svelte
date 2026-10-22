<script lang="ts">
  import RehearsalSongName from '$components/rehearsals/RehearsalSongName.svelte';
  import RehearsalReadiness from '$components/rehearsals/RehearsalReadiness.svelte';
  import FilterChip from '$components/shared/FilterChip.svelte';
  import { onDestroy } from 'svelte';
  import LearningProgress from '$components/shared/LearningProgress.svelte';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { authLoading, canAccessRehearsals } from '$lib/auth';
  import { lang } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { getRehearsal, getSetlists, getSongs, getMusicians, updateRehearsal, createRehearsal, deleteRehearsal, updateRehearsalProgress } from '$lib/api';
  import { rehearsalReadiness, rehearsalSongKey, localDate, rehearsalCoverage } from '$lib/rehearsals';
  import { formatDate, INSTRUMENT_ICONS, orderMusicianNames } from '$lib/utils';
  import type { Rehearsal, RehearsalDraft, RehearsalSong, Setlist, Song, BandMusician, LearningStage } from '$lib/types';
  import RehearsalForm from '$components/rehearsals/RehearsalForm.svelte';
  import LyricsOverlay from '$components/stage/LyricsOverlay.svelte';

  let rehearsal = $state<Rehearsal | null>(null);
  let setlists = $state<Setlist[]>([]), catalog = $state<Song[]>([]), musicians = $state<BandMusician[]>([]);
  let loading = $state(true), error = $state(''), busy = $state(false);
  let showForm = $state(false), repeating = $state(false);
  let readinessFirst = $state(false);
  let expanded = $state<string | null>(null), lyrics = $state<Song | null>(null);
  let notes = $state<Record<string, string>>({});
  type OrderQueue = { confirmed: Rehearsal | null; pending: Promise<void>; epoch: number };
  const emptyOrderQueue = (): OrderQueue => ({ confirmed: null, pending: Promise.resolve(), epoch: 0 });
  let orderQueue = emptyOrderQueue();
  const id = $derived(page.params.id!);
  const linked = $derived(setlists.find(s => s.id === rehearsal?.setlistId));
  const activeAttendees = $derived(rehearsal?.attendees ?? []);
  const displayedSongs = $derived(readinessFirst
    ? [...(rehearsal?.songs ?? [])].sort((a, b) => (rehearsalReadiness(a.song, activeAttendees) ?? Infinity) - (rehearsalReadiness(b.song, activeAttendees) ?? Infinity))
    : rehearsal?.songs ?? []);
  const formInitial = $derived(rehearsal ? { ...rehearsal, attendees: activeAttendees, ...(repeating ? { date: localDate(), cancelled: false } : {}) } : {});
  $effect(() => {
    if ($authLoading) return;
    if (!$canAccessRehearsals) { goto(`${base}/backlog`); return; }
    const target = id;
    let active = true;
    loading = true; error = ''; rehearsal = null; orderQueue = emptyOrderQueue();
    Promise.all([getRehearsal(target), getSetlists(), getSongs(), getMusicians()]).then(([r,s,c,m]) => {
      if (!active) return;
      orderQueue.confirmed = r; rehearsal = r; setlists = s; catalog = c; musicians = m; resetNotes(); loading = false;
    }).catch(() => { if (active) { error = $rt.error; loading = false; } });
    return () => { active = false; orderQueue = emptyOrderQueue(); };
  });
  let dragMoved = $state(false);
  let cancelDrag: (() => void) | undefined;
  onDestroy(() => cancelDrag?.());
  let dragIndex = $state<number | null>(null), dropIndex = $state<number | null>(null);
  function reorder(from: number, to: number) {
    if (!rehearsal || busy || rehearsal.cancelled || from === to || to < 0 || to >= rehearsal.songs.length) return;
    const songs = [...displayedSongs];
    songs.splice(to, 0, songs.splice(from, 1)[0]);
    const next = { ...rehearsal, songs };
    const queue = orderQueue;
    const epoch = queue.epoch;
    // Move immediately. Serialize background writes so rapid drops use the latest version.
    rehearsal = next;
    readinessFirst = false;
    error = '';
    queue.pending = queue.pending.then(async () => {
      if (epoch !== queue.epoch || !queue.confirmed) return;
      try {
        const saved = await updateRehearsal({ ...next, version: queue.confirmed.version });
        queue.confirmed = saved;
        if (orderQueue !== queue) return;
        // Acknowledging a save must not replace the visible cards or a newer local order.
        if (rehearsal) rehearsal.version = saved.version;
      } catch (e) {
        queue.epoch++;
        if (orderQueue !== queue) return;
        cancelDrag?.();
        rehearsal = queue.confirmed;
        error = String(e).includes('409') ? $rt.conflict : $rt.saveError;
      }
    });
  }
  function toggleReadinessOrder() {
    if (!rehearsal || busy || rehearsal.cancelled || dragIndex !== null) return;
    readinessFirst = !readinessFirst;
  }
  function startDrag(event: PointerEvent, index: number) {
    if (!rehearsal || busy || rehearsal.cancelled || event.button !== 0) return;
    cancelDrag?.();
    const handle = event.currentTarget as HTMLButtonElement;
    const source = handle.closest<HTMLElement>('[data-rehearsal-index]')!;
    const rect = source.getBoundingClientRect();
    const offsetX = event.clientX - rect.left, offsetY = event.clientY - rect.top;
    let preview: HTMLElement | null = null;
    handle.setPointerCapture(event.pointerId);
    let x = event.clientX, y = event.clientY, moved = false, frame = 0;
    const startY = y;
    dragIndex = index; dropIndex = index; dragMoved = false;
    function target() {
      const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-rehearsal-index]');
      if (row) dropIndex = Number(row.dataset.rehearsalIndex);
      if (preview) {
        preview.style.left = `${Math.max(8, Math.min(x - offsetX, window.innerWidth - rect.width - 8))}px`;
        preview.style.top = `${Math.max(8, y - offsetY)}px`;
      }
    }
    function showPreview() {
      // Clone the actual card so expanded details, readiness and wrapping stay identical.
      preview = source.cloneNode(true) as HTMLElement;
      preview.classList.remove('dragging', 'drop-target');
      preview.classList.add('drag-preview');
      preview.removeAttribute('data-rehearsal-index');
      preview.removeAttribute('id');
      preview.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      preview.setAttribute('aria-hidden', 'true');
      preview.inert = true;
      preview.style.width = `${rect.width}px`;
      preview.style.font = getComputedStyle(source).font;
      const originalFields = source.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
      preview.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((field, i) => {
        field.value = originalFields[i].value;
        if (field instanceof HTMLInputElement && originalFields[i] instanceof HTMLInputElement) field.checked = originalFields[i].checked;
      });
      document.body.append(preview);
    }
    function scroll() {
      if (moved) { const speed = y < 100 ? -12 : y > window.innerHeight - 80 ? 12 : 0; if (speed) { window.scrollBy(0, speed); target(); } }
      frame = requestAnimationFrame(scroll);
    }
    function move(e: PointerEvent) { x = e.clientX; y = e.clientY; if (!moved && Math.abs(y - startY) > 5) { showPreview(); moved = true; dragMoved = true; } if (moved) target(); }
    function finish(e: PointerEvent) {
      const to = dropIndex;
      cleanup();
      if (e.type === 'pointerup' && moved && to !== null) reorder(index, to);
    }
    function cleanup() {
      preview?.remove(); preview = null;
      cancelAnimationFrame(frame); dragIndex = null; dropIndex = null; dragMoved = false; cancelDrag = undefined;
      document.removeEventListener('keydown', keydown);
      handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', finish); handle.removeEventListener('lostpointercapture', finish);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    }
    function keydown(e: KeyboardEvent) { if (e.key === 'Escape') cleanup(); }
    cancelDrag = cleanup;
    document.addEventListener('keydown', keydown);
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', finish); handle.addEventListener('lostpointercapture', finish);
    frame = requestAnimationFrame(scroll);
  }
  function resetNotes() { notes = Object.fromEntries((rehearsal?.songs ?? []).map(s => [rehearsalSongKey(s), s.note ?? ''])); }
  async function reload() {
    if (!rehearsal) { location.reload(); return; }
    busy = true; error = '';
    try { await orderQueue.pending; rehearsal = await getRehearsal(id); orderQueue.confirmed = rehearsal; resetNotes(); } catch { error = $rt.error; }
    finally { busy = false; }
  }
  async function persist(patch: Partial<Rehearsal>) {
    if (!rehearsal || busy) return;
    busy = true; error = '';
    try {
      await orderQueue.pending;
      if (!rehearsal) return;
      error = '';
      const before = rehearsal;
      const next = { ...before, ...patch };
      if (!next.cancelled && patch.songs && patch.attendees === undefined) {
        const beforeNeeded = new Set(before.songs.flatMap(item => rehearsalCoverage(item.song, []).needed));
        const nextNeeded = new Set(next.songs.flatMap(item => rehearsalCoverage(item.song, []).needed));
        next.attendees = next.attendees.filter(name => !beforeNeeded.has(name) || nextNeeded.has(name));
      }
      rehearsal = await updateRehearsal(next);
      orderQueue.confirmed = rehearsal;
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
  async function progress(item: RehearsalSong, name: string, stage: LearningStage) {
    if (!rehearsal || busy) return;
    busy = true; error = '';
    try {
      await orderQueue.pending;
      rehearsal = await updateRehearsalProgress(id, item, name, stage);
      orderQueue.confirmed = rehearsal;
      // Picker readiness should also reflect this latest canonical progress.
      catalog = catalog.map(song => song.id === item.songId ? { ...song, progress: { ...(song.progress ?? {}), [name]: stage } } : song);
    } catch { error = $rt.progressError; }
    finally { busy = false; }
  }
  async function toggleCancelled() { if (rehearsal && (rehearsal.cancelled || confirm($rt.cancelConfirm))) await action({ cancelled: !rehearsal.cancelled }); }
  async function remove() {
    if (!rehearsal || !confirm($rt.deleteConfirm)) return;
    busy = true; error = '';
    try { await orderQueue.pending; if (!rehearsal) return; await deleteRehearsal(rehearsal); await goto(`${base}/rehearsals`); }
    catch(e) { error = String(e).includes('409') ? $rt.conflict : $rt.saveError; }
    finally { busy = false; }
  }
</script>

{#if $canAccessRehearsals}
<div class="page">
  <a class="back" href="{base}/rehearsals">‹ {$rt.title}</a>
  {#if error}<div class="error" role="alert">{error} <button onclick={reload} disabled={busy}>{$rt.reload}</button></div>{/if}
  {#if loading}<p class="loading"><LoadingCat /></p>
  {:else if rehearsal}
    <header>
      <div><h1>{formatDate(rehearsal.date, $lang)}</h1><div class="time">{rehearsal.startTime}</div></div>
      <button onclick={() => { repeating = false; showForm = true; }} disabled={busy}>{$rt.edit}</button>
    </header>
    {#if rehearsal.cancelled}<p class="cancelled">{$rt.cancelledHint}</p>{/if}
    {#if rehearsal.location}<p class="location">{rehearsal.location}</p>{/if}
    {#if linked}<a class="setlist" href="{base}/setlists/{linked.id}">{$rt.setlist}: {linked.name}</a>
    {:else if rehearsal.setlistId}<p class="muted">{$rt.unavailableSetlist}</p>{/if}
    {#if rehearsal.note}<p class="note">{rehearsal.note}</p>{/if}
    <div class="song-heading"><h2>{$rt.songs} <span>{rehearsal.songs.length}</span></h2><div class="song-actions"><FilterChip label={$rt.leastReadyFirst} active={readinessFirst} onclick={toggleReadinessOrder} disabled={busy || rehearsal.cancelled || rehearsal.songs.length < 2 || dragIndex !== null} /></div></div>
    {#if rehearsal.songs.length > 1}<p class="reorder-hint">{$rt.reorderHint}</p>{/if}
    {#if !rehearsal.songs.length}<p class="empty">{$rt.emptySongs}</p>{/if}
    <div class="song-list">
    {#each displayedSongs as item, index (rehearsalSongKey(item))}
      {@const songKey = rehearsalSongKey(item)}
      {@const pct = rehearsalReadiness(item.song, activeAttendees)}
      {@const missing = orderMusicianNames(Object.keys(item.song.musicians), musicians).filter(name => item.song.musicians[name].instruments.length && !activeAttendees.includes(name))}
      <article class="song" data-rehearsal-index={index} class:dragging={dragMoved && dragIndex === index} class:drop-target={dragMoved && dropIndex === index && dragIndex !== index}>
        <div class="song-row">
          <button class="drag-handle" aria-label={`${$rt.drag}: ${item.song.title}`} title={$rt.drag} disabled={busy || rehearsal.cancelled} onpointerdown={event => startDrag(event, index)} onkeydown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); reorder(index, index + (event.key === 'ArrowUp' ? -1 : 1)); } }}>⠿</button>
          <span class="song-order">{index + 1}</span>
          <button class="song-title" aria-expanded={expanded === songKey} onclick={() => { expanded = expanded === songKey ? null : songKey; }}><RehearsalSongName artist={item.song.artist} title={item.song.title} /></button>
          {#if item.song.lyrics}<button class="lyrics-btn" aria-label={`${$rt.lyrics}: ${item.song.title}`} title={$rt.lyrics} onclick={() => { lyrics = item.song; }}>📝</button>{:else}<span class="lyrics-spacer" aria-hidden="true"></span>{/if}
          <RehearsalReadiness value={pct} label={$rt.sessionReadiness} />
        </div>
        {#if pct === null}<p class="song-hint">{$rt.noPlayers}</p>{/if}
        {#if missing.length}<p class="song-hint">{$rt.missing}: {missing.join(', ')}</p>{/if}
        {#if item.note && expanded !== songKey}<p class="song-note">{item.note}</p>{/if}
        {#if expanded === songKey}
          <div class="details">
            <p class="muted">{$rt.fullReadiness}: {rehearsalReadiness(item.song) ?? '—'}{rehearsalReadiness(item.song) !== null ? '%' : ''}</p>
            {#if item.sourceMissing}<p class="muted">{$rt.sourceMissing}</p>{/if}
            {#each orderMusicianNames(Object.keys(item.song.musicians), musicians).filter(name => item.song.musicians[name].instruments.length) as name}
              {@const role = item.song.musicians[name]}
              <div class="musician" class:absent={!activeAttendees.includes(name)}><span>{name} <small>{role.instruments.map(i => INSTRUMENT_ICONS[i]).join(' ')}</small></span>
                <LearningProgress {name} value={item.song.progress?.[name] ?? 'queue'} onchange={stage => progress(item, name, stage)} disabled={busy || rehearsal.cancelled || !activeAttendees.includes(name) || (item.sourceMissing && !catalog.some(s => s.id === item.songId))} />
              </div>
            {/each}
            {#if item.song.comment}<p class="note muted">{item.song.comment}</p>{/if}
            <label class="note-label">{$rt.songNote}<textarea bind:value={notes[songKey]} maxlength="4000" rows="2" disabled={busy || rehearsal.cancelled}></textarea></label>
            <div class="detail-actions">
              <button onclick={() => action({ songs: rehearsal!.songs.map(s => rehearsalSongKey(s) === songKey ? { ...s, note: notes[songKey] } : s) })} disabled={busy || rehearsal.cancelled || (notes[songKey] ?? '') === (item.note ?? '')}>{$rt.save}</button>
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
{#if showForm && rehearsal}<RehearsalForm title={repeating ? $rt.repeat : $rt.edit} initial={formInitial} {setlists} {musicians} {catalog} onsubmit={saveForm} onclose={() => { showForm = false; }} />{/if}
{#if lyrics}<LyricsOverlay song={lyrics} onclose={() => { lyrics = null; }} onsavetranspose={async song => { lyrics = song; return song; }} />{/if}
{/if}
<style>
  .loading { padding: 40px 20px; }
  .page { max-width: 820px; margin: 0 auto; padding: 22px 16px 48px; }
  .back { display: inline-block; margin-bottom: 22px; color: var(--text-muted); text-decoration: none; font-size: .85rem; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; } h1 { font-size: 1.5rem; margin: 0 0 8px; } h2 { font-size: 1rem; margin: 0; }
  .time { font-size: 1.3rem; color: var(--accent); }
  button { border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; background: var(--surface); color: var(--text); cursor: pointer; } button:disabled { opacity: .5; cursor: default; }
  .location { font-size: 1rem; } .setlist { display: inline-block; color: var(--accent); font-size: .85rem; margin: 4px 0 10px; text-decoration: none; }
  .note { white-space: pre-wrap; overflow-wrap: anywhere; font-size: .9rem; } .muted { color: var(--text-muted); font-size: .8rem; }
  .song-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .song-heading { flex-wrap: wrap; display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 24px 0 14px; } h2 span { color: var(--text-muted); margin-left: 6px; }
  .song-list { display: flex; flex-direction: column; gap: 3px; } .song { position: relative; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); overflow: clip; }
  .song-row { display: grid; grid-template-columns: 32px 20px minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 7px 8px; }
  .song:hover { background: var(--row-hover); }
  .song-order { text-align: center; font-size: .82rem; color: var(--text-muted); }
  .drag-handle { touch-action: none; cursor: grab; width: 32px; min-height: 44px; padding: 6px; border: 0; background: transparent; color: var(--text-muted); font-size: 1rem; flex-shrink: 0; }
  .drag-handle:hover { color: var(--accent); }
  .drag-handle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .drag-handle:active { cursor: grabbing; }
  .reorder-hint { font-size: .78rem; color: var(--text-muted); margin: -5px 0 14px; }
  .dragging { opacity: .35; } .drop-target { outline: 2px dotted var(--accent); outline-offset: -2px; }
  :global(.song.drag-preview) { position: fixed; z-index: 200; pointer-events: none; box-sizing: border-box; margin: 0; opacity: 1; box-shadow: 0 8px 24px #0003; }

  .song-title { font: inherit; flex: 1; min-width: 0; padding: 0; text-align: left; border: 0; background: transparent; }
  .lyrics-btn { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 5px; background: var(--accent); color: #fff; font-size: 1rem; }
  .lyrics-spacer { width: 34px; height: 34px; }
  .song-hint { font-size: .75rem; color: var(--text-muted); margin: 0 8px 6px 76px; } .song-note { font-size: .85rem; white-space: pre-wrap; margin: 0 8px 8px 76px; overflow-wrap: anywhere; }
  .details { padding: 14px; border-top: 1px solid var(--border); } .details > p:first-child { margin-top: 0; }
  .musician { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 12px 0; font-size: .85rem; } .musician small { margin-left: 5px; } .absent { opacity: .5; }
  textarea { border: 1px solid var(--border); border-radius: 7px; background: var(--bg); color: var(--text); padding: 8px; font: inherit; }
  .note-label { display: flex; flex-direction: column; gap: 8px; font-size: .8rem; margin-top: 18px; color: var(--text-muted); }
  .detail-actions, footer { display: flex; gap: 8px; flex-wrap: wrap; } .detail-actions { margin-top: 10px; } footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border); }
  .danger { color: #dc2626; } .empty { color: var(--text-muted); padding: 22px 0; } .cancelled { padding: 12px; border-radius: 8px; background: var(--bg); color: var(--text-muted); }
  .error { color: #dc2626; padding: 12px 0; font-size: .85rem; }
  @media(max-width:600px) { h1 { font-size: 1.2rem; } .time { font-size: 1.1rem; } textarea { font-size: 16px; } .musician { flex-wrap: wrap; } }
</style>
