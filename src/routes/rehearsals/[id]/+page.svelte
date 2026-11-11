<script lang="ts">
  import SongEntryRow from '$components/setlist/SongEntryRow.svelte';
  import { Button } from '$components/ui/button';
  import CommentInput from '$components/setlist/CommentInput.svelte';
  import { Alert, AlertDescription } from '$components/ui/alert';
  import { Card, CardContent } from '$components/ui/card';
  import { Empty, EmptyHeader, EmptyTitle } from '$components/ui/empty';
  import * as AlertDialog from '$components/ui/alert-dialog';
  import * as Table from '$components/ui/table';
  import * as Breadcrumb from '$components/ui/breadcrumb';
  import * as NavigationMenu from '$components/ui/navigation-menu';
  import RowActions from '$components/shared/RowActions.svelte';
  import RehearsalFilter from '$components/rehearsals/RehearsalFilter.svelte';
  import ButtonRow from '$components/shared/ButtonRow.svelte';
  import { Badge } from '$components/ui/badge';
  import IconButton from '$components/shared/IconButton.svelte';
  import PageControlsDivider from '$components/shared/PageControlsDivider.svelte';
  import PageControls from '$components/shared/PageControls.svelte';
  import DateTimeCrumb from '$components/shared/DateTimeCrumb.svelte';
  import { isPastRehearsal, rehearsalTime } from '$components/rehearsals/classes';
  import SongTableHead from '$components/setlist/SongTableHead.svelte';
  import { songColumns, songVisibility, type SongTableRow } from '$components/setlist/songColumns';
  import { createSvelteTable } from '$components/ui/data-table';
  import { getCoreRowModel } from '@tanstack/table-core';
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
  import { cn, formatDate, INSTRUMENT_ICONS, orderMusicianNames } from '$lib/utils';
  import type { Rehearsal, RehearsalDraft, RehearsalSong, LearningStage } from '$lib/types';
  import { keys, rehearsalQuery, setlistsQuery, songsQuery, musiciansQuery } from '$lib/query/queries';
  import { useCreateRehearsal, useUpdateRehearsal, useDeleteRehearsal, useUpdateRehearsalProgress } from '$lib/query/rehearsals';
  import { useStore } from '$lib/store/bridge';
  import { rehearsalDetailStore as detail } from '$lib/store/rehearsals';
  import RehearsalForm from '$components/rehearsals/RehearsalForm.svelte';
  import LyricsOverlay from '$components/stage/LyricsOverlay.svelte';

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
  const plays = (item: RehearsalSong, name: string) => (item.song.musicians[name]?.instruments.length ?? 0) > 0;
  const participants = $derived($participantsS);
  const text = $derived($filterTextS.trim().toLowerCase());
  const filtering = $derived(participants.length > 0 || text !== '');
  const sortedSongs = $derived(readinessFirst
    ? [...(rehearsal?.songs ?? [])].sort((a, b) => (rehearsalReadiness(a.song, activeAttendees) ?? Infinity) - (rehearsalReadiness(b.song, activeAttendees) ?? Infinity))
    : rehearsal?.songs ?? []);
  // Participant filter: AND, like the backlog's musician filter.
  const displayedSongs = $derived(filtering ? sortedSongs.filter(item => participants.every(name => plays(item, name)) && (!text || `${item.song.artist} ${item.song.title}`.toLowerCase().includes(text))) : sortedSongs);
  const filterNames = $derived(orderMusicianNames(activeAttendees, musicians));
  const filterCounts = $derived(Object.fromEntries(filterNames.map(name => [name, (rehearsal?.songs ?? []).filter(item => plays(item, name)).length])));
  const activeFilterCount = $derived(participants.length + (text ? 1 : 0) + (readinessFirst ? 1 : 0));
  const onClass = 'data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground data-[state=on]:hover:bg-secondary/90';
  // The API strips personal comments from rehearsals, so show the caller's own note from the source
  // setlist entry (or the backlog song), which both come back already personalised.
  function personalNote(item: RehearsalSong): string | undefined {
    const fromSetlist = item.sourceSetlistId
      ? setlists.find(sl => sl.id === item.sourceSetlistId)?.entries.find(e => e.songId === item.songId)?.personalComment
      : undefined;
    return fromSetlist ?? catalog.find(song => song.id === item.songId)?.personalComment;
  }
  const permanentNames = $derived(musicians.map(m => m.name));
  // Table columns = attending band musicians who play in at least one of the songs.
  const columnMusicians = $derived(permanentNames.filter(name => displayedSongs.some(item => (item.song.musicians[name]?.instruments.length ?? 0) > 0)));
  const notComing = $derived([...new Set([...permanentNames, ...displayedSongs.flatMap(item => Object.keys(item.song.musicians))])].filter(name => !activeAttendees.includes(name)));
  const levelPickerS = useStore(detail, s => s.levelPicker);
  const attendingMusicians = $derived(permanentNames.filter(name => activeAttendees.includes(name)));
  // drag + number + song + musician columns + actions
  const hasGuests = $derived(displayedSongs.some(item => Object.entries(item.song.musicians).some(([n, r]) => !permanentNames.includes(n) && r.instruments.length > 0)));

  // Data Table: shared song columns; unused musician columns are hidden through the store's columnVisibility.
  const columnVisibilityS = useStore(detail, s => s.columnVisibility);
  const maxIcons = $derived(Object.fromEntries(permanentNames.map(n => [n, Math.max(1, ...displayedSongs.map(i => i.song.musicians[n]?.instruments.length ?? 0))])));
  const columns = $derived(songColumns(permanentNames, { song: songHeader, guests: $t.editor.guestsColumn }, maxIcons));
  const tableRows = $derived(displayedSongs.map((item): SongTableRow<RehearsalSong> => ({ id: rehearsalSongKey(item), kind: 'song', item })));
  $effect.pre(() => {
    const next = songVisibility(permanentNames, columnMusicians, false, $dragEnabled && !filtering, hasGuests);
    if (JSON.stringify(next) !== JSON.stringify(st().columnVisibility)) patch({ columnVisibility: next });
  });
  const table = createSvelteTable<SongTableRow<RehearsalSong>>({
    get data() { return tableRows; },
    get columns() { return columns as never; },
    state: { get columnVisibility() { return $columnVisibilityS; } },
    onColumnVisibilityChange: (u) => patch({ columnVisibility: typeof u === 'function' ? u(st().columnVisibility) : u }),
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });
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
    const source = handle.closest<HTMLTableRowElement>('tr[data-rehearsal-index]')!;
    const sourceTable = source.closest('table')!;
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
      const sourceRows = [source, ...(source.nextElementSibling?.classList.contains('song-details-row') ? [source.nextElementSibling as HTMLTableRowElement] : [])];
      const body = document.createElement('tbody');
      for (const sourceRow of sourceRows) {
        const clone = sourceRow.cloneNode(true) as HTMLTableRowElement;
        clone.classList.remove('dragging', 'drag-over');
        clone.removeAttribute('data-rehearsal-index');
        clone.removeAttribute('id');
        clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
        clone.querySelectorAll<HTMLElement>('td').forEach(cell => { cell.style.opacity = '1'; cell.style.outline = 'none'; });
        const originalCells = [...sourceRow.cells];
        [...clone.cells].forEach((cell, i) => {
          const width = originalCells[i]?.getBoundingClientRect().width ?? 0;
          if (width > 0 && sourceRow === source) Object.assign(cell.style, { boxSizing: 'border-box', width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` });
        });
        const originalFields = sourceRow.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
        clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((field, i) => {
          field.value = originalFields[i].value;
          if (field instanceof HTMLInputElement && originalFields[i] instanceof HTMLInputElement) field.checked = originalFields[i].checked;
        });
        body.append(clone);
      }
      const table = sourceTable.cloneNode(false) as HTMLTableElement;
      const tableStyle = getComputedStyle(sourceTable);
      Object.assign(table.style, {
        margin: '0', width: `${rect.width}px`, minWidth: `${rect.width}px`, maxWidth: `${rect.width}px`,
        tableLayout: 'fixed', borderCollapse: tableStyle.borderCollapse, borderSpacing: tableStyle.borderSpacing,
        pointerEvents: 'none', boxShadow: '0 8px 24px color-mix(in srgb, currentColor 22%, transparent)',
      });
      table.append(body);
      // The song-table wrapper gives the cloned rows the same styles as the real table.
      preview = document.createElement('div');
      preview.className = 'drag-preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.inert = true;
      Object.assign(preview.style, { position: 'fixed', zIndex: '200', pointerEvents: 'none', left: '0', top: '0', font: getComputedStyle(source).font });
      preview.append(table);
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
      class="w-max max-w-[calc(100vw-16px)] flex-row items-center gap-2.5 rounded-[10px] px-2.5 py-2"
      onOpenAutoFocus={e => e.preventDefault()}
      onCloseAutoFocus={e => e.preventDefault()}
      onInteractOutside={e => { if ($levelPickerS.anchor.contains(e.target as Node | null)) e.preventDefault(); }}
    >
      <span class="px-1 text-[.8rem] font-semibold text-muted-foreground">{$levelPickerS.name}</span>
      <LearningProgress name={$levelPickerS.name} value={pickerItem.song.progress?.[$levelPickerS.name] ?? 'queue'} onchange={chooseLevel} disabled={busy || rehearsal?.cancelled || (pickerItem.sourceMissing && !catalog.some(s => s.id === pickerItem.songId))} />
    </Popover.Content>
  {/if}
</Popover.Root>

<PersonalNotePopover />

{#snippet dragBtn()}
  <span class="inline-flex" title={filtering ? $rt.filterDragHint : undefined}><IconButton icon="⠿" label={$t.common.dragMode} pressed={$dragEnabled} onpressedchange={() => dragModeStore.getState().toggle()} disabled={busy || !rehearsal || rehearsal.cancelled || rehearsal.songs.length < 2 || dragIndex !== null || filtering} /></span>
{/snippet}
{#snippet actionsMenu()}
  <RowActions disabled={busy} actions={[
    { icon: '✏️', label: $rt.edit, onselect: () => patch({ repeating: false, showForm: true }) },
    { icon: '🔁', label: $rt.repeat, onselect: () => patch({ repeating: true, showForm: true }) },
    { icon: rehearsal!.cancelled ? '↩️' : '🚫', label: rehearsal!.cancelled ? $rt.restore : $rt.cancelSession, onselect: toggleCancelled },
    { icon: '🗑️', label: $rt.delete, destructive: true, separatorBefore: true, onselect: () => patch({ confirm: 'delete' }) },
  ]} />
{/snippet}

{#snippet songHeader()}
  <span class="max-mid:hidden"><span class="text-[.85rem] font-bold text-foreground">{$rt.songs}</span> <span class="ml-1 text-muted-foreground">{rehearsal!.songs.filter(song => song.played).length}/{rehearsal!.songs.length}</span></span>
{/snippet}

{#if $canAccessRehearsals}
{#if !loading && rehearsal}
<!-- Desktop bar; on small screens the date header sits in the page and the controls in a bottom bar (as in the catalog). -->
<div class="contents max-mid:hidden">
<PageControls label={$rt.title}>
  {#snippet start()}
  <NavigationMenu.Item class="min-w-0 max-w-full">
    <Breadcrumb.Root>
      <Breadcrumb.List class="flex-nowrap items-center gap-1.5 sm:gap-1.5">
        <Breadcrumb.Item class="shrink-0 max-mid:hidden"><Breadcrumb.Link href="{base}/rehearsals" class="inline-flex min-h-10 items-center">{$rt.title}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator class="max-mid:hidden" />
        <Breadcrumb.Item class="min-w-0 flex-col items-start gap-0.5 py-0.5">
          <DateTimeCrumb date={rehearsal.date} time={rehearsalTime(rehearsal)} past={isPastRehearsal(rehearsal)} />
          {#if linked}
            <Breadcrumb.Link href="{base}/setlists/{linked.id}" title="{$rt.setlist}: {linked.name}" aria-label="{$rt.setlist}: {linked.name}" class="block max-w-full text-[.85rem] leading-tight text-primary-ink max-sm:whitespace-nowrap sm:max-w-[34ch] sm:truncate"><span aria-hidden="true">🎪</span> {linked.name}</Breadcrumb.Link>
          {:else if rehearsal.setlistId}
            <span class="block max-w-full text-[.8rem] leading-tight text-muted-foreground max-sm:whitespace-nowrap sm:truncate" title="{$rt.setlist}: {$rt.unavailableSetlist}"><span aria-hidden="true">🎪</span> {$rt.unavailableSetlist}</span>
          {/if}
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  </NavigationMenu.Item>
  {/snippet}
  {#snippet end()}
  <NavigationMenu.Item>
    <IconButton class="relative {activeFilterCount > 0 ? onClass : ''}" icon="🎛️" label={$t.backlog.filterBtn} pressed={$filterOpenS} expanded={$filterOpenS} onpressedchange={v => patch({ filterOpen: v })}>
      {#if activeFilterCount > 0}<Badge class="absolute top-0 right-0 h-4 min-w-4 justify-center px-1 text-[0.65rem]">{activeFilterCount}</Badge>{/if}
    </IconButton>
  </NavigationMenu.Item>
  <NavigationMenu.Item>{@render dragBtn()}</NavigationMenu.Item>
  <NavigationMenu.Item>{@render actionsMenu()}</NavigationMenu.Item>
  {/snippet}
</PageControls>
</div>
<RehearsalFilter names={filterNames.filter(n => permanentNames.includes(n))} guests={filterNames.filter(n => !permanentNames.includes(n))} counts={filterCounts} />
<div class="flex flex-col gap-0.5 border-b bg-(--table-selected) px-3 py-2 min-mid:hidden">
  <DateTimeCrumb date={rehearsal.date} time={rehearsalTime(rehearsal)} past={isPastRehearsal(rehearsal)} />
  {#if linked}
    <a href="{base}/setlists/{linked.id}" class="block text-[.85rem] leading-tight text-primary-ink no-underline"><span aria-hidden="true">🎪</span> {linked.name}</a>
  {:else if rehearsal.setlistId}
    <span class="block text-[.8rem] leading-tight text-muted-foreground"><span aria-hidden="true">🎪</span> {$rt.unavailableSetlist}</span>
  {/if}
  <div class="mt-1 text-[.8rem] font-bold tracking-wide text-foreground uppercase">{$rt.songs} <span class="ml-1 font-normal text-muted-foreground">{rehearsal.songs.filter(song => song.played).length}/{rehearsal.songs.length}</span></div>
</div>
<div class="fixed inset-x-0 bottom-0 z-40 hidden h-[52px] items-center gap-2 border-t bg-card px-3 max-mid:grid grid-cols-[1fr_auto_1fr]">
  <div class="flex justify-end gap-2">
  <IconButton class="relative {activeFilterCount > 0 ? onClass : ''}" icon="🎛️" label={$t.backlog.filterBtn} pressed={$filterOpenS} onpressedchange={v => patch({ filterOpen: v })}>
    {#if activeFilterCount > 0}<Badge class="absolute top-0 right-0 h-4 min-w-4 justify-center px-1 text-[0.65rem]">{activeFilterCount}</Badge>{/if}
  </IconButton>
  </div>
  <div>{@render actionsMenu()}</div>
  <div class="flex justify-start gap-2">{@render dragBtn()}</div>
</div>
{/if}
<div class="p-0 max-mid:pb-[52px]">
  {#if error}<Alert variant="destructive" class="m-3 flex w-auto items-center justify-between gap-2"><AlertDescription>{error}</AlertDescription><Button variant="outline" size="sm" onclick={reload} disabled={busy}>{$rt.reload}</Button></Alert>{/if}
  {#if loading}<LoadingCat />
  {:else if rehearsal}
    <h1 class="sr-only">{formatDate(rehearsal.date, $lang)} {rehearsalTime(rehearsal)}</h1>
    {#if rehearsal.cancelled || rehearsal.location || rehearsal.note}
    <Card class="m-3">
      <CardContent class="flex flex-col items-start gap-2">
        {#if rehearsal.cancelled}<Alert><AlertDescription>{$rt.cancelledHint}</AlertDescription></Alert>{/if}
        {#if rehearsal.location}<p class="m-0 text-base">{rehearsal.location}</p>{/if}
        {#if rehearsal.note}<p class="m-0 text-[.9rem] break-words whitespace-pre-wrap"><LinkifiedText text={rehearsal.note} /></p>{/if}
      </CardContent>
    </Card>
    {/if}
    {#if !rehearsal.songs.length}<h2 class="m-3 text-base font-bold">{$rt.songs}</h2>{/if}
    {#if !rehearsal.songs.length}<Empty class="border"><EmptyHeader><EmptyTitle class="text-base font-normal text-muted-foreground">{$rt.emptySongs}</EmptyTitle></EmptyHeader></Empty>{/if}
    {#if rehearsal.songs.length}
    <div>
      <Table.Root>
        <SongTableHead {table} offNames={notComing} />
        <Table.Body class="[&_tr:last-child]:border-0">
    {#each table.getRowModel().rows as row, index (row.id)}
      {@const item = row.original.item}
      {@const songKey = rehearsalSongKey(item)}
      {@const pct = rehearsalReadiness(item.song, activeAttendees)}
      {@const editable = !rehearsal.cancelled}
      {@const full = rehearsalReadiness(item.song)}
      <SongEntryRow
        {row}
        rowActions={[{ icon: '🗑️', label: $rt.remove, destructive: true, disabled: busy || !editable, onselect: () => action({ songs: rehearsal!.songs.filter(s => rehearsalSongKey(s) !== songKey) }) }]}
        song={item.song}
        number={index + 1}
        {pct}
        pctTitle={`${$rt.sessionReadiness}: ${pct ?? '—'}${pct !== null ? '%' : ''} · ${$rt.fullReadiness}: ${full ?? '—'}${full !== null ? '%' : ''}`}
        played={!!item.played}
        stageOf={name => item.song.progress?.[name] ?? 'queue'}
        {permanentNames}
        bubbleMusicians={permanentNames}
        rowClass={{ dragging: dragMoved && dragIndex === index, 'drag-over': dragMoved && dropIndex === index && dragIndex !== index }}
        rowProps={{ 'data-rehearsal-index': index }}
        titleFirst
        onlyrics={() => patch({ lyricsKey: songKey })}
        personalNote={personalNote(item)}
        onpersonal={anchor => { patch({ levelPicker: null }); notePopoverStore.getState().toggle(songKey, personalNote(item) ?? '', anchor); }}
        ontitle={() => togglePlayed(item)}
        titleLabel={`${item.played ? $rt.markUndone : $rt.markDone}: ${item.song.title}`}
        titleDisabled={busy || rehearsal.cancelled}
        disabledMusicians={notComing}
        oncell={(name, anchor) => pickLevel(songKey, name, anchor)}
        cellLabel={name => `${name} · ${$t.song.progress}: ${item.song.title}`}
      >
        {#snippet dragCell()}
          {#if $dragEnabled && !filtering}<Button variant="ghost" size="icon" class="drag-handle w-full cursor-grab touch-none rounded-none text-inherit hover:bg-transparent hover:text-primary-ink active:cursor-grabbing disabled:cursor-default" aria-label={`${$rt.drag}: ${item.song.title}`} title={$rt.drag} disabled={busy || rehearsal!.cancelled} onpointerdown={event => startDrag(event, index)} onkeydown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); reorder(index, index + (event.key === 'ArrowUp' ? -1 : 1)); } }}>⠿</Button>{/if}
        {/snippet}
        {#snippet comment()}
          <!-- One line, two comments: LEFT = the song's setlist/catalog comment (read-only here), RIGHT = this rehearsal's note (editable). -->
          <div class="flex min-w-0 items-center gap-3">
            {#if item.song.comment}
              <span class="block min-w-0 max-w-[45%] shrink-0 truncate text-[.85rem] text-muted-foreground" title={item.song.comment}><LinkifiedText text={item.song.comment} /></span>
            {/if}
            <div class="min-w-0 flex-1">
              {#if editable}
                <CommentInput value={item.note ?? ''} onsave={v => action({ songs: rehearsal!.songs.map(s => rehearsalSongKey(s) === songKey ? { ...s, note: v } : s) })} />
              {:else if item.note}
                <span class="block truncate text-[.85rem] text-muted-foreground italic"><LinkifiedText text={item.note} /></span>
              {/if}
            </div>
          </div>
        {/snippet}
        {#snippet extras()}
          {#if pct === null}<p class="mt-1 mb-0 text-xs whitespace-normal text-muted-foreground">{$rt.noPlayers}</p>{/if}
          {#if item.sourceMissing}<p class="mt-1 mb-0 truncate text-xs text-muted-foreground" title={$rt.sourceMissing}>{$rt.sourceMissing}</p>{/if}
        {/snippet}
      </SongEntryRow>
    {/each}
        </Table.Body>
      </Table.Root>
    </div>
    {/if}
  {/if}
</div>
{#if showForm && rehearsal}<RehearsalForm title={repeating ? $rt.repeat : $rt.edit} initial={formInitial} onsubmit={saveForm} onclose={() => patch({ showForm: false })} />{/if}
<AlertDialog.Root open={$confirmS !== null} onOpenChange={value => { if (!value) patch({ confirm: null }); }}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{$confirmS === 'delete' ? $rt.delete : $rt.cancelSession}</AlertDialog.Title>
      <AlertDialog.Description>{$confirmS === 'delete' ? $rt.deleteConfirm : $rt.cancelConfirm}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{$rt.close}</AlertDialog.Cancel>
      <AlertDialog.Action class={$confirmS === 'delete' ? 'bg-destructive text-white hover:bg-destructive/90' : ''} onclick={confirmed}>{$confirmS === 'delete' ? $rt.delete : $rt.cancelSession}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
{#if lyrics}<LyricsOverlay song={lyrics.song} onclose={() => patch({ lyricsKey: null })} onsavetranspose={async song => song} />{/if}
{/if}
