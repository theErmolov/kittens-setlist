<script lang="ts">
  import { Button } from '$components/ui/button';
    import { countByMusician, playsInSong } from '$lib/musicianStats';
  import CommentInput from '$components/setlist/CommentInput.svelte';
  import { Alert, AlertDescription } from '$components/ui/alert';
  import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
  import RowActions from '$components/shared/RowActions.svelte';
  import RehearsalFilter from '$components/rehearsals/RehearsalFilter.svelte';
  import IconButton from '$components/shared/IconButton.svelte';
  import { isPastRehearsal, rehearsalTime, timeText } from '$components/rehearsals/classes';
  import StageView from '$components/stage/StageView.svelte';
  import { Badge } from '$components/ui/badge';
  import { pressedOn } from '$components/setlist/classes';
  import StageRow, { type RosterCell } from '$components/stage/StageRow.svelte';
  import { STAGE_BADGE } from '$lib/palette';
  import * as Popover from '$components/ui/popover';
  import { noteStore } from '$lib/store/shell';
  import { dragModeStore } from '$lib/store/drag';
  import { onDestroy, untrack } from 'svelte';
  import LinkifiedText from '$components/shared/LinkifiedText.svelte';
  import PersonalNotePopover from '$components/shared/PersonalNotePopover.svelte';
  import { notePopoverStore } from '$lib/store/notePopover';
  import LearningProgress from '$components/shared/LearningProgress.svelte';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { authLoading, canAccessRehearsals } from '$lib/auth';
  import { lang, t } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { rehearsalReadiness, rehearsalSongKey, localDate, rehearsalCoverage } from '$lib/rehearsals';
  import { formatDate, orderMusicianNames } from '$lib/utils';
  import type { Rehearsal, RehearsalDraft, RehearsalSong, LearningStage } from '$lib/types';
  import { keys, rehearsalQuery, setlistsQuery, songsQuery, musiciansQuery } from '$lib/query/queries';
  import { useCreateRehearsal, useUpdateRehearsal, useDeleteRehearsal, useUpdateRehearsalProgress } from '$lib/query/rehearsals';
  import { useStore } from '$lib/store/bridge';
  import { rehearsalDetailStore as detail } from '$lib/store/rehearsals';
  import RehearsalForm from '$components/rehearsals/RehearsalForm.svelte';

  const qc = useQueryClient();
  const id = $derived(page.params.id!);
  const enabled = $derived(!$authLoading && $canAccessRehearsals);
  // No focus refetch: it must not replace the optimistic order while background saves are in flight.
  const rehearsalQ = createQuery(() => ({ ...rehearsalQuery(id), enabled, refetchOnWindowFocus: false }));
  const setlistsQ = createQuery(() => ({ ...setlistsQuery(), enabled }));
  const songsQ = createQuery(() => ({ ...songsQuery(), enabled }));
  const musiciansQ = createQuery(() => ({ ...musiciansQuery(), enabled }));
  const createMut = useCreateRehearsal(), updateMut = useUpdateRehearsal(), deleteMut = useDeleteRehearsal(), progressMut = useUpdateRehearsalProgress();
  const rehearsal = $derived<Rehearsal | null>(rehearsalQ.data ?? null);
  const setlists = $derived(setlistsQ.data ?? []), catalog = $derived(songsQ.data ?? []), musicians = $derived(musiciansQ.data ?? []);
  const queries = [rehearsalQ, setlistsQ, songsQ, musiciansQ];
  const loading = $derived(queries.some(q => q.isPending));
  const loadFailed = $derived(!loading && queries.some(q => q.isError));

  detail.getState().reset();
  const { patch } = detail.getState();
  const st = () => detail.getState();
  const busyS = useStore(detail, s => s.busy), errorS = useStore(detail, s => s.error), showFormS = useStore(detail, s => s.showForm);
  const repeatingS = useStore(detail, s => s.repeating), readinessFirstS = useStore(detail, s => s.readinessFirst), participantsS = useStore(detail, s => s.participantFilter), filterOpenS = useStore(detail, s => s.filterOpen), filterTextS = useStore(detail, s => s.filterText);
  const lyricsS = useStore(detail, s => s.lyricsKey), confirmS = useStore(detail, s => s.confirm);
  const dragEnabled = useStore(dragModeStore, s => s.enabled);
  const mobile = useStore(noteStore, s => s.mobile);
  const dragIndexS = useStore(detail, s => s.dragIndex), dropIndexS = useStore(detail, s => s.dropIndex), dragMovedS = useStore(detail, s => s.dragMoved);
  const busy = $derived($busyS), showForm = $derived($showFormS), repeating = $derived($repeatingS), readinessFirst = $derived($readinessFirstS);
  const lyrics = $derived($lyricsS ? rehearsal?.songs.find(s => rehearsalSongKey(s) === $lyricsS) ?? null : null);
  const dragIndex = $derived($dragIndexS), dropIndex = $derived($dropIndexS), dragMoved = $derived($dragMovedS);
  const error = $derived($errorS || (loadFailed ? $rt.error : ''));

  // Write serialisation only (promise chain + epoch). The last server-confirmed rehearsal lives in the query cache.
  type OrderQueue = { pending: Promise<void>; epoch: number };
  const emptyOrderQueue = (): OrderQueue => ({ pending: Promise.resolve(), epoch: 0 });
  const confirmedKey = (rid: string) => ['rehearsal-confirmed', rid] as const;
  const getConfirmed = () => qc.getQueryData<Rehearsal>(confirmedKey(untrack(() => id))) ?? null;
  const setConfirmed = (value: Rehearsal) => qc.setQueryData(confirmedKey(untrack(() => id)), value);
  let orderQueue = emptyOrderQueue();
  const setRehearsal = (value: Rehearsal) => qc.setQueryData(keys.rehearsal(untrack(() => id)), value);
  const linked = $derived(setlists.find(s => s.id === rehearsal?.setlistId));
  const activeAttendees = $derived(rehearsal?.attendees ?? []);
  const participants = $derived($participantsS);
  const text = $derived($filterTextS.trim().toLowerCase());
  const filtering = $derived(participants.length > 0 || text !== '');
  const sortedSongs = $derived(readinessFirst
    ? [...(rehearsal?.songs ?? [])].sort((a, b) => (rehearsalReadiness(a.song, activeAttendees) ?? Infinity) - (rehearsalReadiness(b.song, activeAttendees) ?? Infinity))
    : rehearsal?.songs ?? []);
  // Participant filter: AND, like the backlog's musician filter.
  const displayedSongs = $derived(filtering ? sortedSongs.filter(item => participants.every(name => playsInSong(item.song, name)) && (!text || `${item.song.artist} ${item.song.title}`.toLowerCase().includes(text))) : sortedSongs);
  const filterNames = $derived(orderMusicianNames(activeAttendees, musicians));
  const filterCounts = $derived(countByMusician((rehearsal?.songs ?? []).map(item => item.song), filterNames));
  const activeFilterCount = $derived(participants.length + (text ? 1 : 0) + (readinessFirst ? 1 : 0));
  // The API strips personal comments from rehearsals, so show the caller's own note from the source
  // setlist entry (or the backlog song), which both come back already personalised.
  function personalNote(item: RehearsalSong): string | undefined {
    const fromSetlist = item.sourceSetlistId
      ? setlists.find(sl => sl.id === item.sourceSetlistId)?.entries.find(e => e.songId === item.songId)?.personalComment
      : undefined;
    return fromSetlist ?? catalog.find(song => song.id === item.songId)?.personalComment;
  }
  const permanentNames = $derived(musicians.map(m => m.name));
  const notComing = $derived([...new Set([...permanentNames, ...displayedSongs.flatMap(item => Object.keys(item.song.musicians))])].filter(name => !activeAttendees.includes(name)));
  const levelPickerS = useStore(detail, s => s.levelPicker);
  // Roster pills of a song row: band musicians who play it (in roster order), then guests; pills are tinted by the learning stage and open the level picker.
  function rosterCells(item: RehearsalSong, key: string): RosterCell[] {
    const cells: RosterCell[] = [];
    const guestNames = Object.keys(item.song.musicians).filter(name => !permanentNames.includes(name)).sort((a, b) => a.localeCompare(b));
    // As on the stage: one slot per band musician (empty when they do not play, so the columns line up), then the guests.
    for (const name of [...permanentNames, ...guestNames]) {
      const instruments = item.song.musicians[name]?.instruments ?? [];
      if (!instruments.length) { if (permanentNames.includes(name)) cells.push({ name, instruments }); continue; }
      cells.push({
        name, instruments, guest: !permanentNames.includes(name),
        tone: STAGE_BADGE[item.song.progress?.[name] ?? 'queue'] ?? STAGE_BADGE.queue,
        off: !activeAttendees.includes(name),
        label: `${name} · ${$t.song.progress}: ${item.song.title}`,
        onclick: anchor => pickLevel(key, name, anchor),
      });
    }
    return cells;
  }
  const formInitial = $derived(rehearsal ? { ...rehearsal, attendees: activeAttendees, ...(repeating ? { date: localDate(), cancelled: false } : {}) } : {});
  let lastId = untrack(() => id);
  $effect(() => {
    const target = id;
    if (target !== lastId) { lastId = target; detail.getState().reset(); }
    return () => { orderQueue = emptyOrderQueue(); qc.removeQueries({ queryKey: confirmedKey(target), exact: true }); };
  });
  $effect(() => {
    if ($authLoading) return;
    if (!$canAccessRehearsals) goto(`${base}/backlog`);
  });
  $effect(() => {
    // First load of this rehearsal: seed the confirmed version and the note drafts.
    if (rehearsal && getConfirmed() === null) setConfirmed(rehearsal);
  });
  let cancelDrag: (() => void) | undefined;
  onDestroy(() => cancelDrag?.());
  function reorder(from: number, to: number) {
    if (!rehearsal || busy || rehearsal.cancelled || filtering || from === to || to < 0 || to >= rehearsal.songs.length) return;
    const songs = [...displayedSongs];
    songs.splice(to, 0, songs.splice(from, 1)[0]);
    const next = { ...rehearsal, songs };
    const queue = orderQueue;
    const epoch = queue.epoch;
    // Move immediately. Serialize background writes so rapid drops use the latest version.
    const target = untrack(() => id);
    setRehearsal(next);
    patch({ readinessFirst: false, error: '' });
    queue.pending = queue.pending.then(async () => {
      const confirmed = qc.getQueryData<Rehearsal>(confirmedKey(target));
      if (epoch !== queue.epoch || !confirmed) return;
      try {
        const saved = await updateMut.mutateAsync({ ...next, version: confirmed.version });
        qc.setQueryData(confirmedKey(target), saved);
        if (orderQueue !== queue) return;
        // Acknowledging a save must not replace the visible cards or a newer local order.
        qc.setQueryData<Rehearsal>(keys.rehearsal(target), cur => cur ? { ...cur, version: saved.version } : cur);
      } catch (e) {
        queue.epoch++;
        if (orderQueue !== queue) return;
        cancelDrag?.();
        qc.setQueryData(keys.rehearsal(target), qc.getQueryData<Rehearsal>(confirmedKey(target)));
        patch({ error: String(e).includes('409') ? $rt.conflict : $rt.saveError });
      }
    });
  }
  function toggleReadinessOrder() {
    if (!rehearsal || busy || rehearsal.cancelled || dragIndex !== null) return;
    patch({ readinessFirst: !readinessFirst });
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
    patch({ dragIndex: index, dropIndex: index, dragMoved: false });
    function target() {
      const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-rehearsal-index]');
      if (row) patch({ dropIndex: Number(row.dataset.rehearsalIndex) });
      if (preview) {
        preview.style.left = `${Math.max(8, Math.min(x - offsetX, window.innerWidth - rect.width - 8))}px`;
        preview.style.top = `${Math.max(8, y - offsetY)}px`;
      }
    }
    function showPreview() {
      // Clone the actual row so readiness, notes and wrapping stay identical.
      const clone = source.cloneNode(true) as HTMLElement;
      clone.classList.remove('opacity-35', 'bg-muted', 'ring-1', 'ring-inset', 'ring-border');
      clone.removeAttribute('data-rehearsal-index');
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      const originalFields = source.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
      clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((field, i) => {
        field.value = originalFields[i].value;
        if (field instanceof HTMLInputElement && originalFields[i] instanceof HTMLInputElement) field.checked = originalFields[i].checked;
      });
      Object.assign(clone.style, {
        width: `${rect.width}px`, minWidth: `${rect.width}px`, maxWidth: `${rect.width}px`, margin: '0',
        background: 'var(--card)', boxShadow: '0 8px 24px color-mix(in srgb, currentColor 22%, transparent)',
      });
      preview = document.createElement('div');
      preview.className = 'drag-preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.inert = true;
      Object.assign(preview.style, { position: 'fixed', zIndex: '200', pointerEvents: 'none', left: '0', top: '0', font: getComputedStyle(source).font });
      preview.append(clone);
      document.body.append(preview);
    }
    function scroll() {
      if (moved) { const speed = y < 100 ? -12 : y > window.innerHeight - 80 ? 12 : 0; if (speed) { window.scrollBy(0, speed); target(); } }
      frame = requestAnimationFrame(scroll);
    }
    function move(e: PointerEvent) { x = e.clientX; y = e.clientY; if (!moved && Math.abs(y - startY) > 5) { showPreview(); moved = true; patch({ dragMoved: true }); } if (moved) target(); }
    function finish(e: PointerEvent) {
      const to = st().dropIndex;
      cleanup();
      if (e.type === 'pointerup' && moved && to !== null) reorder(index, to);
    }
    function cleanup() {
      preview?.remove(); preview = null;
      cancelAnimationFrame(frame); patch({ dragIndex: null, dropIndex: null, dragMoved: false }); cancelDrag = undefined;
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
  async function reload() {
    if (!rehearsal) { if (loadFailed) queries.filter(q => q.isError).forEach(q => q.refetch()); else location.reload(); return; }
    patch({ busy: true, error: '' });
    try { await orderQueue.pending; const fresh = (await rehearsalQ.refetch()).data; if (!fresh) throw new Error('reload'); setConfirmed(fresh); } catch { patch({ error: $rt.error }); }
    finally { patch({ busy: false }); }
  }
  async function persist(patchData: Partial<Rehearsal>, optimistic = false) {
    if (!rehearsal || st().busy) return;
    patch({ busy: true, error: '' });
    let rollback: Rehearsal | null = null;
    try {
      await orderQueue.pending;
      if (!rehearsal) return;
      patch({ error: '' });
      const before = rehearsal;
      if (optimistic) rollback = before;
      const next = { ...before, ...patchData };
      if (!next.cancelled && patchData.songs && patchData.attendees === undefined) {
        const beforeNeeded = new Set(before.songs.flatMap(item => rehearsalCoverage(item.song, []).needed));
        const nextNeeded = new Set(next.songs.flatMap(item => rehearsalCoverage(item.song, []).needed));
        next.attendees = next.attendees.filter(name => !beforeNeeded.has(name) || nextNeeded.has(name));
      }
      if (optimistic) setRehearsal(next);
      const saved = await updateMut.mutateAsync(next);
      setRehearsal(saved);
      setConfirmed(saved);
    }
    catch(e) { if (rollback) setRehearsal(rollback); patch({ error: String(e).includes('409') ? $rt.conflict : $rt.saveError }); throw e; }
    finally { patch({ busy: false }); }
  }
  async function togglePlayed(item: RehearsalSong) {
    if (!rehearsal || busy || rehearsal.cancelled) return;
    // Use the visible order, including the optional readiness sort, as stage view does.
    const through = new Set(displayedSongs.slice(0, displayedSongs.indexOf(item) + 1).map(rehearsalSongKey));
    await persist({ songs: rehearsal.songs.map(song => item.played
      ? rehearsalSongKey(song) === rehearsalSongKey(item) ? { ...song, played: false } : song
      : through.has(rehearsalSongKey(song)) ? { ...song, played: true } : song) }, true).catch(() => {});
  }
  function action(p: Partial<Rehearsal>) { return persist(p).catch(() => {}); }
  async function saveForm(draft: RehearsalDraft) {
    if (repeating) { const created = await createMut.mutateAsync({ draft, copyFromId: rehearsal?.id }); patch({ showForm: false }); await goto(`${base}/rehearsals/${created.id}`); }
    else { await persist(draft); patch({ showForm: false }); }
  }
  function pickLevel(key: string, name: string, anchor: HTMLElement) {
    if (busy || rehearsal?.cancelled || !activeAttendees.includes(name)) return;
    const open = st().levelPicker;
    if (open?.key === key && open.name === name) return patch({ levelPicker: null });
    notePopoverStore.getState().close();
    patch({ levelPicker: { key, name, anchor } });
  }
  const pickerItem = $derived($levelPickerS ? displayedSongs.find(item => rehearsalSongKey(item) === $levelPickerS.key) : undefined);
  function chooseLevel(stage: LearningStage) {
    const picker = st().levelPicker;
    if (picker && pickerItem) progress(pickerItem, picker.name, stage);
    patch({ levelPicker: null });
  }
  const closePicker = () => { if (st().levelPicker) patch({ levelPicker: null }); };
  async function progress(item: RehearsalSong, name: string, stage: LearningStage) {
    if (!rehearsal || busy) return;
    patch({ busy: true, error: '' });
    try {
      await orderQueue.pending;
      const saved = await progressMut.mutateAsync({ id, song: item, musicianName: name, stage });
      setConfirmed(saved);
    } catch { patch({ error: $rt.progressError }); }
    finally { patch({ busy: false }); }
  }
  async function toggleCancelled() {
    if (!rehearsal) return;
    if (rehearsal.cancelled) await action({ cancelled: false });
    else patch({ confirm: 'cancel' });
  }
  async function confirmed() {
    const kind = st().confirm;
    patch({ confirm: null });
    if (kind === 'cancel') await action({ cancelled: true });
    else if (kind === 'delete') await remove();
  }
  async function remove() {
    if (!rehearsal) return;
    patch({ busy: true, error: '' });
    try { await orderQueue.pending; if (!rehearsal) return; await deleteMut.mutateAsync(rehearsal); await goto(`${base}/rehearsals`); }
    catch(e) { patch({ error: String(e).includes('409') ? $rt.conflict : $rt.saveError }); }
    finally { patch({ busy: false }); }
  }
</script>

<svelte:window onscroll={closePicker} onresize={closePicker} />

<!-- Readiness picker: the existing 3-segment LearningProgress inside a Popover anchored to the clicked cell. -->
<Popover.Root open={!!$levelPickerS && !!pickerItem} onOpenChange={value => { if (!value) closePicker(); }}>
  {#if $levelPickerS && pickerItem}
    <Popover.Content
      customAnchor={$levelPickerS.anchor}
      side="bottom"
      collisionPadding={8}
      trapFocus={false}
      aria-label={`${$levelPickerS.name} · ${$t.song.progress}`}
      class="w-max max-w-[calc(100vw-16px)] flex-row items-center gap-2.5 rounded-soft px-2.5 py-2"
      onOpenAutoFocus={e => e.preventDefault()}
      onCloseAutoFocus={e => e.preventDefault()}
      onInteractOutside={e => { if ($levelPickerS.anchor.contains(e.target as Node | null)) e.preventDefault(); }}
    >
      <span class="px-1 text-small font-semibold text-muted-foreground">{$levelPickerS.name}</span>
      <LearningProgress name={$levelPickerS.name} value={pickerItem.song.progress?.[$levelPickerS.name] ?? 'queue'} onchange={chooseLevel} disabled={busy || rehearsal?.cancelled || (pickerItem.sourceMissing && !catalog.some(s => s.id === pickerItem.songId))} />
    </Popover.Content>
  {/if}
</Popover.Root>

<PersonalNotePopover />

{#snippet dragBtn()}
  <span class="inline-flex" title={filtering ? $rt.filterDragHint : undefined}><IconButton text={$t.common.dragMode} icon="⠿" label={$t.common.dragMode} pressed={$dragEnabled} onpressedchange={() => dragModeStore.getState().toggle()}  disabled={busy || !rehearsal || rehearsal.cancelled || rehearsal.songs.length < 2 || dragIndex !== null || filtering} /></span>
{/snippet}
{#snippet actionsMenu()}
  <RowActions inline showText disabled={busy} actions={[
    { icon: '✏️', label: $rt.edit, onselect: () => patch({ repeating: false, showForm: true }) },
    { icon: '🔁', label: $rt.repeat, onselect: () => patch({ repeating: true, showForm: true }) },
    { icon: rehearsal!.cancelled ? '↩️' : '🚫', label: rehearsal!.cancelled ? $rt.restore : $rt.cancelSession, onselect: toggleCancelled },
    { icon: '🗑️', label: $rt.delete, destructive: true, separatorBefore: true, onselect: () => patch({ confirm: 'delete' }) },
  ]} />
{/snippet}

{#if $canAccessRehearsals}
{#if loading}
  <LoadingCat />
{:else if rehearsal}
<StageView
  backHref="{base}/rehearsals"
  backLabel={$rt.title}
  items={displayedSongs}
  itemKey={rehearsalSongKey}
  emptyText={rehearsal.songs.length ? undefined : $rt.emptySongs}
  filterOpen={$filterOpenS}
  filterActive={activeFilterCount > 0}
  filterCount={activeFilterCount}
  ontogglefilter={() => patch({ filterOpen: !$filterOpenS })}
  mobileBar
  lyrics={lyrics ? { song: lyrics.song, onclose: () => patch({ lyricsKey: null }), onsavetranspose: async song => song } : null}
>
  {#snippet title()}
    <!-- Date + time (+ linked setlist) and the played/total counter. -->
    <div class="flex min-w-0 flex-1 flex-col leading-tight">
      <h1 class="m-0 flex flex-wrap items-baseline gap-x-2 text-lead font-bold whitespace-nowrap">
        <span class={rehearsal.cancelled ? 'line-through' : ''}>{formatDate(rehearsal.date, $lang)}</span>
        <span class={timeText(isPastRehearsal(rehearsal))}>{rehearsalTime(rehearsal)}</span>
        <span class="text-body font-normal text-muted-foreground"><span class="sr-only">{$rt.songs} </span>{rehearsal.songs.filter(song => song.played).length}/{rehearsal.songs.length}</span>
      </h1>
      {#if linked}
        <a href="{base}/setlists/{linked.id}" title="{$rt.setlist}: {linked.name}" aria-label="{$rt.setlist}: {linked.name}" class="block max-w-full truncate text-body text-primary-ink no-underline mid:max-w-[40ch]"><span aria-hidden="true">🎪</span> {linked.name}</a>
      {:else if rehearsal.setlistId}
        <span class="block max-w-full truncate text-small text-muted-foreground" title="{$rt.setlist}: {$rt.unavailableSetlist}"><span aria-hidden="true">🎪</span> {$rt.unavailableSetlist}</span>
      {/if}
    </div>
  {/snippet}

  {#snippet actions()}
    <!-- Small screens: these live in the bottom bar below. -->
    <div class="flex items-center gap-2 max-mid:hidden">
      {@render dragBtn()}
      {@render actionsMenu()}
    </div>
  {/snippet}

  {#snippet filterPanel()}
    <RehearsalFilter names={filterNames.filter(n => permanentNames.includes(n))} guests={filterNames.filter(n => !permanentNames.includes(n))} counts={filterCounts} />
  {/snippet}

  {#snippet banner()}
    {#if error}<Alert variant="destructive" class="m-2 flex w-auto items-center justify-between gap-2"><AlertDescription>{error}</AlertDescription><Button variant="outline" size="sm" onclick={reload} disabled={busy}>{$rt.reload}</Button></Alert>{/if}
    {#if rehearsal.cancelled || rehearsal.location || rehearsal.note}
      <div class="flex flex-col gap-0.5 border-b bg-table-selected-bg px-2 py-1 text-body-lg">
        {#if rehearsal.cancelled}<p class="m-0 font-semibold text-danger-ink"><span aria-hidden="true">🚫</span> {$rt.cancelledHint}</p>{/if}
        {#if rehearsal.location}<p class="m-0">{rehearsal.location}</p>{/if}
        {#if rehearsal.note}<p class="m-0 text-body break-words whitespace-pre-wrap text-muted-foreground"><LinkifiedText text={rehearsal.note} /></p>{/if}
      </div>
    {/if}
  {/snippet}

  {#snippet row(item, index)}
    {@const songKey = rehearsalSongKey(item)}
    {@const pct = rehearsalReadiness(item.song, activeAttendees)}
    {@const editable = !rehearsal!.cancelled}
    {@const full = rehearsalReadiness(item.song)}
    {@const personal = personalNote(item)}
    {@const rowBtn = 'no-tint h-auto min-h-10 w-full rounded-none min-mid:w-14'}
    {@const noteBtn = 'no-tint h-auto min-h-10 w-full rounded-none min-mid:w-16 min-mid:text-glyph'}
    <StageRow
      song={item.song}
      position={index + 1}
      played={!!item.played}
      interactive={editable && !busy}
      onclick={() => togglePlayed(item)}
      titleLabel={`${item.played ? $rt.markUndone : $rt.markDone}: ${item.song.title}`}
      onlyrics={() => patch({ lyricsKey: songKey })}
      leadActive={$dragEnabled && !filtering}
      cells={rosterCells(item, songKey)}
      {pct}
      pctTitle={`${$rt.sessionReadiness}: ${pct ?? '—'}${pct !== null ? '%' : ''} · ${$rt.fullReadiness}: ${full ?? '—'}${full !== null ? '%' : ''}`}
      hasComment={!!(item.song.comment || editable || item.note || pct === null || item.sourceMissing)}
      rowClass={[dragMoved && dragIndex === index && 'opacity-35', dragMoved && dropIndex === index && dragIndex !== index && 'bg-muted ring-1 ring-inset ring-border']}
      rowProps={{ 'data-rehearsal-index': index }}
    >
      {#snippet lead()}
        {#if $dragEnabled && !filtering}<Button variant="ghost" size="icon" class="drag-handle h-6 w-full min-mid:h-5 cursor-grab touch-none rounded-none text-inherit hover:bg-transparent hover:text-primary-ink active:cursor-grabbing disabled:cursor-default" aria-label={`${$rt.drag}: ${item.song.title}`} title={$rt.drag} disabled={busy || rehearsal!.cancelled} onclick={e => e.stopPropagation()} onpointerdown={event => startDrag(event, index)} onkeydown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); reorder(index, index + (event.key === 'ArrowUp' ? -1 : 1)); } }}>⠿</Button>{/if}
      {/snippet}
      {#snippet comment()}
        <!-- Two comments: the song's setlist/catalog comment (read-only here) and this rehearsal's note (editable), plus hints. -->
        {#if item.song.comment}<div class="text-muted-foreground"><LinkifiedText text={item.song.comment} /></div>{/if}
        {#if editable}
          <CommentInput value={item.note ?? ''} onsave={v => action({ songs: rehearsal!.songs.map(s => rehearsalSongKey(s) === songKey ? { ...s, note: v } : s) })} />
        {:else if item.note}
          <div class="text-muted-foreground italic"><LinkifiedText text={item.note} /></div>
        {/if}
        {#if pct === null}<p class="m-0 text-xs text-muted-foreground">{$rt.noPlayers}</p>{/if}
        {#if item.sourceMissing}<p class="m-0 truncate text-xs text-muted-foreground" title={$rt.sourceMissing}>{$rt.sourceMissing}</p>{/if}
      {/snippet}
      {#snippet actions()}
        {#if personal}<IconButton class={noteBtn} variant="secondary" icon="🤫" label={$t.common.personalComment} onclick={e => { e.stopPropagation(); patch({ levelPicker: null }); notePopoverStore.getState().toggle(songKey, personal, e.currentTarget as HTMLElement); }} />{/if}
      {/snippet}
      {#snippet endActions()}
        <RowActions inline="bare" variant="outline" class={rowBtn} actions={[{ icon: '🗑️', label: $rt.remove, destructive: true, disabled: busy || !editable, onselect: () => action({ songs: rehearsal!.songs.filter(s => rehearsalSongKey(s) !== songKey) }) }]} />
      {/snippet}
    </StageRow>
  {/snippet}
</StageView>

<!-- Small screens: filter | actions menu (centre) | drag, like the other pages' bottom bars. -->
<div class="fixed right-0 bottom-0 left-0 z-21 hidden safe-bar-lg grid-cols-[1fr_auto_1fr] items-center gap-2 border-t bg-card px-2 max-mid:grid">
  <div class="flex justify-end gap-2">
    <IconButton class="relative {pressedOn}" icon="🎛️" label={$t.stage.filters} pressed={$filterOpenS || activeFilterCount > 0} expanded={$filterOpenS} onpressedchange={() => patch({ filterOpen: !$filterOpenS })}>
      {#if activeFilterCount > 0}<Badge class="absolute top-0 right-0 h-4 min-w-4 justify-center px-1 text-micro">{activeFilterCount}</Badge>{/if}
    </IconButton>
  </div>
  <div>{@render actionsMenu()}</div>
  <div class="flex justify-start">{@render dragBtn()}</div>
</div>
{:else if error}
  <Alert variant="destructive" class="m-3 flex w-auto items-center justify-between gap-2"><AlertDescription>{error}</AlertDescription><Button variant="outline" size="sm" onclick={reload} disabled={busy}>{$rt.reload}</Button></Alert>
{/if}
{#if showForm && rehearsal}<RehearsalForm title={repeating ? $rt.repeat : $rt.edit} initial={formInitial} onsubmit={saveForm} onclose={() => patch({ showForm: false })} />{/if}
<ConfirmDialog open={$confirmS !== null} title={$confirmS === 'delete' ? $rt.delete : $rt.cancelSession} description={$confirmS === 'delete' ? $rt.deleteConfirm : $rt.cancelConfirm} confirmLabel={$confirmS === 'delete' ? $rt.delete : $rt.cancelSession} cancelLabel={$rt.close} destructive={false} confirmClass={$confirmS === 'delete' ? 'bg-destructive text-white hover:bg-destructive/90' : ''} onopenchange={value => { if (!value) patch({ confirm: null }); }} onconfirm={confirmed} />
{/if}
