<script lang="ts">
  import { browser } from '$app/environment';
    import { countByMusician } from '$lib/musicianStats';
  import { below } from '$lib/breakpoints';
  import BacklogMidBars from './BacklogMidBars.svelte';
  import SongCardRow from './SongCardRow.svelte';
  import BacklogFilterPanel from './BacklogFilterPanel.svelte';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import type { Song, Setlist, Category, Instrument, LearningStage } from '$lib/types';
  import SongEditModal from './SongEditModal.svelte';
  import LyricsOverlay from '$components/stage/LyricsOverlay.svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { setlistsQuery, musiciansQuery } from '$lib/query/queries';
  import { backlogSongsQuery, useSaveBacklogSong, useDeleteBacklogSong, patchBacklogSong, refreshBacklogSong } from '$lib/query/backlog';
  import { useAddSongs } from '$lib/query/setlistMutations';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import { formatDuration, INSTRUMENT_ICONS } from '$lib/utils';
  import { isSetlistOpen, matchesBacklogFilters } from '$lib/backlog';
  import { lang, t } from '$lib/i18n';
  import { canWrite, currentUser } from '$lib/auth';
  import { base } from '$app/paths';
  import * as Dialog from '$components/ui/dialog';
  import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
  import { Button } from '$components/ui/button';
  import { ButtonGroup } from '$components/ui/button-group';
  import IconButton from '$components/shared/IconButton.svelte';
  import * as Table from '$components/ui/table';
  import { createSvelteTable, FlexRender, renderComponent } from '$components/ui/data-table';
  import { getCoreRowModel, getSortedRowModel, type ColumnDef, type Row, type SortingState } from '@tanstack/table-core';
  import CatCell from './cells/CatCell.svelte';
  import CatHead from './cells/CatHead.svelte';
  import SortHead from './cells/SortHead.svelte';
  import TitleCell from './cells/TitleCell.svelte';
  import MusicianCell from './cells/MusicianCell.svelte';
  import TitleHead from './cells/TitleHead.svelte';
  import ActionsCell from './cells/ActionsCell.svelte';
  import { stageBg } from './songView';
  import * as Tooltip from '$components/ui/tooltip';
  import * as Drawer from '$components/ui/drawer';
  import * as Empty from '$components/ui/empty';
  import { Badge } from '$components/ui/badge';

  const songsQ = createQuery(() => backlogSongsQuery(($currentUser?.isAdmin || $currentUser?.role === 'writer') ? 10000 : 50000));
  const setlistsQ = createQuery(() => setlistsQuery());
  const musiciansQ = createQuery(() => musiciansQuery());
  const saveSong = useSaveBacklogSong();
  const deleteSongM = useDeleteBacklogSong();
  const addSongsM = useAddSongs();

  let songs = $derived(songsQ.data ?? []);
  let setlists = $derived(setlistsQ.data ?? []);
  let musicians = $derived(musiciansQ.data ?? []);
  let loading = $derived(!browser || songsQ.isPending || setlistsQ.isPending || musiciansQ.isPending);

  const search = useStore(backlogStore, s => s.search);
  const categoryFilter = useStore(backlogStore, s => s.categoryFilter);
  const selectedMusicians = useStore(backlogStore, s => s.selectedMusicians);
  const selectedInstruments = useStore(backlogStore, s => s.selectedInstruments);
  const showProgress = useStore(backlogStore, s => s.showProgress);
  const showArchived = useStore(backlogStore, s => s.showArchived);
  const filterOpen = useStore(backlogStore, s => s.filterOpen);
  const barOpen = useStore(backlogStore, s => s.barOpen);
  const additionMode = useStore(backlogStore, s => s.additionMode);
  const sorting = useStore(backlogStore, s => s.sorting);
  const editingSongId = useStore(backlogStore, s => s.editingSongId);
  const addToSetlistSongId = useStore(backlogStore, s => s.addToSetlistSongId);
  const lyricsViewSongId = useStore(backlogStore, s => s.lyricsViewSongId);
  const songById = (id: string | null) => (id ? songs.find(s => s.id === id) ?? null : null);
  const editFreshId = useStore(backlogStore, s => s.editFreshId);
  // The edit dialog opens on a fresh server copy (cached lists are never refetched on their own).
  const editingSong = $derived($editFreshId === $editingSongId ? songById($editingSongId) : null);
  $effect(() => {
    const id = $editingSongId;
    if (!id) return;
    refreshBacklogSong(id).catch(() => {}).finally(() => { if (backlogStore.getState().editingSongId === id) actions.setEditFresh(id); });
  });
  const addToSetlistSong = $derived(songById($addToSetlistSongId));
  const lyricsViewSong = $derived(songById($lyricsViewSongId));
  const addRequest = useStore(backlogStore, s => s.addRequest);
  const deleteRequest = useStore(backlogStore, s => s.deleteRequest);
  const actions = backlogStore.getState();
  const compact = useStore(backlogStore, s => s.compact);

  // Setlists still relevant for adding: not more than 24h past their start time
  let openSetlists = $derived(setlists.filter(sl => isSetlistOpen(sl)));
  let activeFilterCount = $derived(($search.trim() ? 1 : 0) + ($showArchived ? 1 : 0) + $categoryFilter.size + $selectedMusicians.size + $selectedInstruments.size);
  let hasActiveFilters = $derived(
    $search.length > 0 || $categoryFilter.size > 0 || $selectedMusicians.size > 0 || $selectedInstruments.size > 0
  );

  const instrumentIcons = INSTRUMENT_ICONS;
  const allInstruments: Instrument[] = ['vocals', 'guitar', 'bass', 'keys', 'violin', 'saxophone', 'trumpet', 'drums', 'cajon', 'percussion'];

  // Column names — all registered musicians (guests are ad-hoc in song.musicians, not in roster)
  let permanentNames = $derived(musicians.map(m => m.name));

  // Songs in scope for the current archive view (hides archived by default)
  let scoped = $derived(() => songs.filter(s => $showArchived ? !!s.archived : !s.archived));

  let categoryCounts = $derived(() => {
    const counts: Record<Category, number> = { top: 0, mid: 0, low: 0 };
    for (const s of scoped()) {
      if (s.category in counts) counts[s.category]++;
    }
    return counts;
  });

  let musicianCounts = $derived(() => countByMusician(scoped(), permanentNames));

  let filtered = $derived(() => {
    const f = scoped().filter(s => matchesBacklogFilters(
      s, $search, $categoryFilter, $selectedMusicians, $selectedInstruments,
    ));
    return f;
  });

  // ── Data Table (TanStack): column defs, sorting state lives in backlogStore ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rc = (component: any, props?: Record<string, unknown>) => renderComponent(component, (props ?? {}) as never);
  interface ColMeta { people?: boolean; head?: string; cell?: string; cellClass?: (song: Song) => string }
  const isCyrillic = (s: string) => /[\u0400-\u04FF]/.test(s.trimStart().charAt(0)) ? 1 : 0;
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  // Artist: English artists before Russian, then alphabetical, then title.
  const artistSort = (a: Row<Song>, b: Row<Song>) =>
    isCyrillic(a.original.artist) - isCyrillic(b.original.artist) || cmp(a.original.artist, b.original.artist) || cmp(a.original.title, b.original.title);
  const titleSort = (a: Row<Song>, b: Row<Song>) => cmp(a.original.title, b.original.title);

  let columns = $derived.by((): ColumnDef<Song>[] => {
    const names = permanentNames;
    const musicianCols: ColumnDef<Song>[] = names.map((name, i) => ({
      id: `m:${name}`,
      header: name,
      enableSorting: false,
      cell: ({ row }) => rc(MusicianCell, { song: row.original, name }),
      meta: {
        // Mid and small: equal fixed-width columns; big: as narrow as the content, at least wide enough for the most instruments.
        head: 'w-15 min-w-15 px-1 text-micro tracking-normal',
        cell: 'px-1',
        people: true,
        cellClass: (song: Song) => {
          const role = song.musicians[name];
          // Stage colours only in progress mode.
          return $showProgress && role?.instruments?.length ? stageBg((song.progress?.[name] ?? 'queue') as LearningStage) : '';
        },
      } satisfies ColMeta,
    }));
    return [
      { id: 'category', header: () => rc(CatHead), enableSorting: false,
        cell: ({ row }) => rc(CatCell, { song: row.original, names }),
        meta: { head: 'w-18 min-w-18 max-w-18', cell: 'px-0 text-center' } satisfies ColMeta },
      // Hidden column: only carries the artist sort; the visible title column shows "Artist – Title" like the small view.
      { id: 'artist', accessorKey: 'artist', sortingFn: artistSort, header: () => '', cell: () => '' },
      { id: 'title', accessorKey: 'title', sortingFn: titleSort,
        header: () => rc(TitleHead),
        cell: ({ row }) => rc(TitleCell, { song: row.original, names }),
        meta: { head: 'w-[54%]', cell: 'max-w-0 text-body-lg' } satisfies ColMeta },
      ...musicianCols,
      { id: 'actions', enableSorting: false,
        header: () => $t.song.editTitle,
        cell: ({ row }) => rc(ActionsCell, { song: row.original }),
        meta: { head: 'w-px min-mid:px-0', cell: 'min-mid:h-px min-mid:p-0', last: true } as ColMeta },
    ];
  });

  const table = createSvelteTable<Song>({
    get data() { return filtered(); },
    get columns() { return columns; },
    getRowId: song => song.id,
    // The artist column only carries the sort (artist and title share one visible column).
    state: { get sorting() { return $sorting; }, get columnVisibility() { return { artist: false }; } },
    onSortingChange: updater => actions.setSorting(typeof updater === 'function' ? updater($sorting) : updater),
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  let rows = $derived(table.getRowModel().rows);
  const meta = (c: { columnDef: { meta?: unknown } }) => (c.columnDef.meta ?? {}) as ColMeta & { last?: boolean };
  const ariaSort = (dir: false | 'asc' | 'desc') => dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined;
  /** Musician columns (the song-info cells get the table colour `--table-song-bg`). */
  const isPeople = (m: ColMeta) => !!m.people;
  const tint = 'bg-table-song-bg';
  // Small tier: song rows laid out like the setlist's instead of the table.
  $effect(() => {
    if (!browser) return;
    const mq = below('mid');
    const update = () => actions.setCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });
  // The 📋 add-to-setlist mode exists in the small view only; from mid up a row click always opens the editor.
  const onRowClick = (song: Song) =>
    $currentUser?.status === 'approved' ? ($canWrite && $additionMode && $compact ? actions.requestAdd(song.id) : actions.setEditingSong(song.id)) : undefined;

  async function handleSave(updated: Song) {
    await saveSong.mutateAsync({ song: updated, canWrite: $canWrite });
    actions.setEditingSong(null);
  }

  // Row delete requests arrive through the store and are confirmed in an AlertDialog.
  function confirmDelete() {
    const id = $deleteRequest;
    actions.requestDelete(null);
    if (id) deleteSongM.mutate(id);
  }

  const onClass = 'on:bg-secondary on:text-secondary-foreground on:hover:bg-secondary/90';

  // Add a song to a setlist, skipping if it's already there. Always shows green feedback.
  function addSongToSetlist(sl: Setlist, song: Song) {
    actions.flashSong(song.id);
    if (sl.entries.some(e => e.songId === song.id)) return;
    addSongsM.mutate({ setlistId: sl.id, songs: [song] });
  }

  // Entry point from a row/button: auto-add when exactly one open setlist, else show picker.
  $effect(() => {
    const song = songById($addRequest);
    if (!$addRequest) return;
    actions.requestAdd(null);
    if (!song) return;
    if (openSetlists.length === 1) addSongToSetlist(openSetlists[0], song);
    else actions.setAddToSetlistSong(song.id);
  });

  function handlePickSetlist(sl: Setlist) {
    const song = addToSetlistSong;
    if (!song) return;
    actions.setAddToSetlistSong(null);
    addSongToSetlist(sl, song);
  }
</script>


<Tooltip.Provider>
<!-- Sticky controls bar (desktop): breadcrumb + search on the left, mode toggles + add on the right. Mobile keeps its bottom bar + drawer. -->
<!-- Mid and big: two bars (search + categories, then musicians / instruments / view toggles). Small screens use the bottom bar + drawer. -->
<div class="hidden min-mid:block">
  {#if !loading}<BacklogMidBars names={permanentNames} categoryCounts={categoryCounts()} musicianCounts={musicianCounts()} result="{$t.backlog.shown(filtered().length, scoped().length)} ({formatDuration(filtered().reduce((s, song) => s + (song.lengthMinutes ?? 5), 0), $lang)})" />{/if}
</div>
<div class="flex h-[calc(100dvh-56px)] flex-col {$barOpen ? 'min-mid:h-[calc(100dvh-217px)]' : 'min-mid:h-[calc(100dvh-112px)]'} max-mid:h-[calc(100dvh-56px-52px)]">
  <div class="flex-1 overflow-auto p-0 **:data-[slot=table-container]:overflow-visible">
    {#if loading}
      <LoadingCat />
    {:else}
      {#if $compact}
        <!-- Small view: setlist-style song rows (type | artist – title, comment, musician chips | actions). -->
        <div>
          {#each rows as row (row.id)}
            <SongCardRow song={row.original} names={permanentNames} onrowclick={() => onRowClick(row.original)} />
          {/each}
        </div>
      {:else}
      <!-- shadcn Table (mid and big): one thin header row, fixed-height rows. -->
      <Table.Root>
        <Table.Header>
          {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
            <Table.Row class="hover:bg-transparent">
              {#each headerGroup.headers as header (header.id)}
                {@const m = meta(header.column)}
                {@const hi = isPeople(m) ? headerGroup.headers.filter(h => isPeople(meta(h.column))).indexOf(header) : -1}
                <Table.Head
                  class="{m.head ?? ''} {hi >= 0 ? 'text-center' : ''} {hi >= 0 && hi % 2 === 0 ? 'bg-table-zebra-bg' : ''}"
                  aria-sort={ariaSort(header.column.getIsSorted())}
                >
                  {#if m.last}<span class="sr-only"><FlexRender content={header.column.columnDef.header} context={header.getContext()} /></span>
                  {:else}<FlexRender content={header.column.columnDef.header} context={header.getContext()} />{/if}
                </Table.Head>
              {/each}
            </Table.Row>
          {/each}
        </Table.Header>
        <Table.Body>
          {#each rows as row (row.id)}
            <Table.Row class="group/row relative h-11 cursor-pointer border-0 hover:bg-transparent" onclick={() => onRowClick(row.original)}>
              {#each row.getVisibleCells() as cell (cell.id)}
                {@const m = meta(cell.column)}
                {@const pi = isPeople(m) ? row.getVisibleCells().filter(c => isPeople(meta(c.column))).indexOf(cell) : -1}
                {@const stage = m.cellClass?.(row.original)}
                <Table.Cell class="py-0 text-table-ink {m.cell ?? ''} {stage || `group-hover/row:bg-(--row-hover) ${pi < 0 ? tint : pi % 2 === 0 ? 'bg-table-zebra-bg' : 'bg-table-people-bg'}`}">
                  <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                </Table.Cell>
              {/each}
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
      {/if}

      {#if filtered().length === 0}
        <Empty.Root class="p-10">
          <Empty.Header>
            <Empty.Media><span class="text-3xl">🎵</span></Empty.Media>
            <Empty.Title class="text-base font-medium text-muted-foreground">{$t.backlog.empty}</Empty.Title>
          </Empty.Header>
        </Empty.Root>
      {/if}
    {/if}
  </div>

  {#if !loading}
  <!-- Mobile filter drawer -->
  <Drawer.Root open={$filterOpen} onOpenChange={v => actions.setFilterOpen(v)} shouldScaleBackground={false}>
    <Drawer.Content class="after:hidden min-mid:hidden data-[vaul-drawer-direction=bottom]:bottom-[calc(52px+env(safe-area-inset-bottom))]" onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest('[data-backlog-bar]')) e.preventDefault(); }}>
      <Drawer.Header class="p-2">
        <Drawer.Title class="text-sm">{$t.backlog.filterBtn}</Drawer.Title>
        <Drawer.Description class="sr-only">{$t.backlog.search}</Drawer.Description>
      </Drawer.Header>
      <!-- The drawer ends above the bottom bar (52px), which stays clickable: its filter button closes the drawer. -->
      <div class="max-h-[70dvh] overflow-y-auto px-3 pb-3">
        <BacklogFilterPanel
          names={permanentNames}
          categoryCounts={categoryCounts()}
          musicianCounts={musicianCounts()}
          result="{$t.backlog.shown(filtered().length, scoped().length)} ({formatDuration(filtered().reduce((s, song) => s + (song.lengthMinutes ?? 5), 0), $lang)})"
        />
      </div>
    </Drawer.Content>
  </Drawer.Root>

  <!-- Mobile bottom bar -->
  <!-- Above the filter drawer (z-50) so it stays visible and clickable while that drawer opens and closes; row-action drawers (z-70) cover it. -->
  <div data-backlog-bar class="fixed inset-x-0 bottom-0 z-60 hidden safe-bar items-center justify-center gap-2 border-t bg-card px-3 max-mid:flex">
    <!-- Centred: filter | add (centre) | add-to-setlist mode. -->
    <IconButton class="no-tint relative {onClass}" icon="🎛️" label={$t.backlog.filterBtn} pressed={$filterOpen || hasActiveFilters} onpressedchange={() => actions.toggleFilterOpen()}>
      {#if activeFilterCount > 0}<Badge class="absolute top-0 right-0 h-4 min-w-4 justify-center px-1 text-micro">{activeFilterCount}</Badge>{/if}
    </IconButton>
    {#if $canWrite}
      <IconButton variant="default" icon="➕" label={$t.backlog.addSong} onclick={() => actions.setShowAddModal(true)} />
      <IconButton class={onClass} icon="📋" label={$t.backlog.addMode} pressed={$additionMode} onpressedchange={() => actions.toggleAdditionMode()} />
    {/if}
  </div>
  {/if}
</div>
</Tooltip.Provider>

{#if editingSong}
  <SongEditModal
    song={editingSong}
    personalOnly={!$canWrite}
    {musicians}
    onclose={() => actions.setEditingSong(null)}
    onsave={handleSave}
    ondelete={$canWrite ? async () => {
      await deleteSongM.mutateAsync(editingSong!.id);
    } : undefined}
    onaddtosetlist={$canWrite ? () => { if (editingSong) actions.requestAdd(editingSong.id); } : undefined}
  />
{/if}

<!-- Add-to-setlist picker -->
<Dialog.Root open={!!addToSetlistSong && $canWrite} onOpenChange={(open) => { if (!open) actions.setAddToSetlistSong(null); }}>
  <Dialog.Content class="mid:max-w-sm">
    {#if addToSetlistSong}
      {@const pickSong = addToSetlistSong}
      <Dialog.Header>
        <Dialog.Title class="text-base font-bold">{$t.addToSetlist.title}</Dialog.Title>
        <Dialog.Description>"{pickSong.artist} – {pickSong.title}"</Dialog.Description>
      </Dialog.Header>
      <div class="flex max-h-[60dvh] flex-col gap-1.5 overflow-y-auto">
        {#if openSetlists.length === 0}
          <Empty.Root class="p-4">
            <Empty.Header>
              <Empty.Description>{$t.addToSetlist.noSetlists} <a class="text-primary-ink underline" href="{base}/setlists">{$t.addToSetlist.createLink}</a></Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {:else}
          {#each openSetlists as sl}
            {@const inSetlist = sl.entries.some(e => e.songId === pickSong.id)}
            <Button
              variant="outline"
              class="w-full justify-between px-3.5 text-body-lg {inSetlist ? 'border-primary bg-primary/10 hover:bg-primary/20' : ''}"
              onclick={() => handlePickSetlist(sl)}
            >
              <span class="font-medium">{sl.name}</span>
              <span class="flex items-center gap-2">
                {#if sl.date}<Badge variant="secondary" class="font-normal text-muted-foreground">{sl.date}</Badge>{/if}
                {#if inSetlist}<span class="font-bold text-primary-ink">✓</span>{/if}
              </span>
            </Button>
          {/each}
        {/if}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- Delete-song confirmation -->
<ConfirmDialog open={$deleteRequest !== null} title={$t.song.remove} description={$t.deleteConfirm} confirmLabel={$t.song.remove} cancelLabel={$t.song.cancel} onopenchange={open => { if (!open) actions.requestDelete(null); }} onconfirm={confirmDelete} />

{#if lyricsViewSong}
  <LyricsOverlay
    song={lyricsViewSong}
    onclose={() => actions.setLyricsViewSong(null)}
    onsongupdate={(updated) => {
      patchBacklogSong(updated);
    }}
  />
{/if}
