<script lang="ts">
  import { browser } from '$app/environment';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import type { Song, Setlist, Category, Instrument, LearningStage } from '$lib/types';
  import SongEditModal from './SongEditModal.svelte';
  import LyricsOverlay from '$components/stage/LyricsOverlay.svelte';
  import BacklogFilter from './BacklogFilter.svelte';
  import ActiveFilters from './ActiveFilters.svelte';
  import * as Popover from '$components/ui/popover';
  import { createQuery } from '@tanstack/svelte-query';
  import { setlistsQuery, musiciansQuery } from '$lib/query/queries';
  import { backlogSongsQuery, useSaveBacklogSong, useDeleteBacklogSong, patchBacklogSong } from '$lib/query/backlog';
  import { useAddSongs } from '$lib/query/setlistMutations';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import { formatDuration, INSTRUMENT_ICONS } from '$lib/utils';
  import { isSetlistOpen, matchesBacklogFilters } from '$lib/backlog';
  import { lang, t } from '$lib/i18n';
  import { canWrite, currentUser } from '$lib/auth';
  import { base } from '$app/paths';
  import * as Dialog from '$components/ui/dialog';
  import * as AlertDialog from '$components/ui/alert-dialog';
  import { Button } from '$components/ui/button';
  import { ButtonGroup } from '$components/ui/button-group';
  import IconButton from '$components/shared/IconButton.svelte';
  import PageControlsDivider from '$components/shared/PageControlsDivider.svelte';
  import PageControls from '$components/shared/PageControls.svelte';
  import * as NavigationMenu from '$components/ui/navigation-menu';
  import * as Breadcrumb from '$components/ui/breadcrumb';
  import * as Table from '$components/ui/table';
  import { createSvelteTable, FlexRender, renderComponent } from '$components/ui/data-table';
  import { getCoreRowModel, getSortedRowModel, type ColumnDef, type Row, type SortingState } from '@tanstack/table-core';
  import CatCell from './cells/CatCell.svelte';
  import CatHead from './cells/CatHead.svelte';
  import SortHead from './cells/SortHead.svelte';
  import TitleCell from './cells/TitleCell.svelte';
  import MusicianCell from './cells/MusicianCell.svelte';
  import GuestsCell from './cells/GuestsCell.svelte';
  import ActionsCell from './cells/ActionsCell.svelte';
  import { stageBg, guestTags } from './songView';
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
  let loading = $derived(songsQ.isPending || setlistsQ.isPending || musiciansQ.isPending);

  const search = useStore(backlogStore, s => s.search);
  const categoryFilter = useStore(backlogStore, s => s.categoryFilter);
  const selectedMusicians = useStore(backlogStore, s => s.selectedMusicians);
  const selectedInstruments = useStore(backlogStore, s => s.selectedInstruments);
  const showProgress = useStore(backlogStore, s => s.showProgress);
  const showArchived = useStore(backlogStore, s => s.showArchived);
  const filterOpen = useStore(backlogStore, s => s.filterOpen);
  const filterPopoverOpen = useStore(backlogStore, s => s.filterPopoverOpen);
  const additionMode = useStore(backlogStore, s => s.additionMode);
  const sorting = useStore(backlogStore, s => s.sorting);
  const editingSongId = useStore(backlogStore, s => s.editingSongId);
  const addToSetlistSongId = useStore(backlogStore, s => s.addToSetlistSongId);
  const lyricsViewSongId = useStore(backlogStore, s => s.lyricsViewSongId);
  const songById = (id: string | null) => (id ? songs.find(s => s.id === id) ?? null : null);
  const editingSong = $derived(songById($editingSongId));
  const addToSetlistSong = $derived(songById($addToSetlistSongId));
  const lyricsViewSong = $derived(songById($lyricsViewSongId));
  const addRequest = useStore(backlogStore, s => s.addRequest);
  const deleteRequest = useStore(backlogStore, s => s.deleteRequest);
  const actions = backlogStore.getState();
  const compact = useStore(backlogStore, s => s.compact);

  // Setlists still relevant for adding: not more than 24h past their start time
  let openSetlists = $derived(setlists.filter(sl => isSetlistOpen(sl)));
  // eslint-disable-next-line prefer-const
  let filterAnchor: HTMLElement | undefined;
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

  let musicianCounts = $derived(() => {
    const counts: Record<string, number> = {};
    for (const name of permanentNames) {
      counts[name] = scoped().filter(s => {
        const role = s.musicians[name];
        return role && role.instruments.length > 0;
      }).length;
    }
    return counts;
  });

  let filtered = $derived(() => {
    const f = scoped().filter(s => matchesBacklogFilters(
      s, $search, $categoryFilter, $selectedMusicians, $selectedInstruments,
    ));
    return f;
  });

  // ── Data Table (TanStack): column defs, sorting state lives in backlogStore ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rc = (component: any, props?: Record<string, unknown>) => renderComponent(component, (props ?? {}) as never);
  interface ColMeta { compact?: string; minWidth?: string; head?: string; cell?: string; width?: string; cellStyle?: (song: Song) => string }
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
        head: 'w-px',
        cell: '',
        compact: 'order-3 min-w-0 flex-1 basis-0',
        // Wide enough for the most instruments any shown row has in this column (icons keep full size).
        minWidth: `calc(${Math.max(1, ...filtered().map(song => song.musicians[name]?.instruments?.length ?? 0))} * 1.6rem + 1.5rem)`,
        cellStyle: (song: Song) => {
          const role = song.musicians[name];
          return role?.instruments?.length ? `background: ${stageBg((song.progress?.[name] ?? 'queue') as LearningStage)}` : '';
        },
      } satisfies ColMeta,
    }));
    return [
      { id: 'category', header: () => rc(CatHead), enableSorting: false,
        cell: ({ row }) => rc(CatCell, { song: row.original, names }),
        meta: { head: 'w-px', cell: 'text-center', compact: 'w-12 shrink-0' } satisfies ColMeta },
      { id: 'artist', accessorKey: 'artist', sortingFn: artistSort,
        header: () => rc(SortHead, { id: 'artist', label: $t.backlog.cols.artist }),
        cell: ({ row }) => row.original.artist,
        meta: { cell: 'max-w-0 truncate font-medium', width: '22%', compact: 'max-w-full! min-w-0 flex-1 basis-0' } satisfies ColMeta },
      { id: 'title', accessorKey: 'title', sortingFn: titleSort,
        header: () => rc(SortHead, { id: 'title', label: $t.backlog.cols.title }),
        cell: ({ row }) => rc(TitleCell, { song: row.original }),
        meta: { cell: 'whitespace-normal', width: '32%', compact: 'min-w-0 flex-[1.4] basis-0' } satisfies ColMeta },
      ...musicianCols,
      { id: 'guests', enableSorting: false,
        header: () => $t.backlog.cols.guests,
        cell: ({ row }) => rc(GuestsCell, { song: row.original, names }),
        meta: { cell: 'whitespace-normal', width: '14%', compact: 'order-3 min-w-0 flex-[1.5] basis-0' } satisfies ColMeta },
      { id: 'actions', enableSorting: false,
        header: () => $t.song.editTitle,
        cell: ({ row }) => rc(ActionsCell, { song: row.original }),
        meta: { head: 'w-px', last: true, compact: 'w-16 shrink-0' } as ColMeta },
    ];
  });

  let hasGuests = $derived(filtered().some(song => guestTags(song, permanentNames).length > 0));
  const table = createSvelteTable<Song>({
    get data() { return filtered(); },
    get columns() { return columns; },
    getRowId: song => song.id,
    // The Guests column is shown only while some shown row has a guest.
    state: { get sorting() { return $sorting; }, get columnVisibility() { return { guests: hasGuests }; } },
    onSortingChange: updater => actions.setSorting(typeof updater === 'function' ? updater($sorting) : updater),
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  let rows = $derived(table.getRowModel().rows);
  const meta = (c: { columnDef: { meta?: unknown } }) => (c.columnDef.meta ?? {}) as ColMeta & { last?: boolean };
  const ariaSort = (dir: false | 'asc' | 'desc') => dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined;
  /** Compact view: each row is a flex-wrap line; the `before` item forces the people cells (order-3) onto a second line. */
  const isPeople = (m: ColMeta) => !!m.compact?.includes('order-3');
  /** Compact view: the song-info line of a row has a light violet fill. */
  const tint = 'bg-[color-mix(in_srgb,var(--accent)_7%,var(--card))]';
  const topTint = `content-center ${tint}`;
  const rowCompact = 'overflow-hidden rounded-[4px] border! border-[color-mix(in_srgb,var(--text)_28%,var(--card))] flex flex-wrap before:order-2 before:h-0 before:basis-full before:content-[\'\']';
  // Switch to the two-line layout when the full table would no longer fit the viewport (grows with the number of people).
  $effect(() => {
    if (!browser) return;
    const mq = matchMedia(`(max-width: ${Math.max(700, 380 + 105 * permanentNames.length + (hasGuests ? 170 : 0))}px)`);
    const update = () => actions.setCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });
  const onRowClick = (song: Song) =>
    $currentUser?.status === 'approved' ? ($canWrite && $additionMode ? actions.requestAdd(song.id) : actions.setEditingSong(song.id)) : undefined;

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

  const onClass = 'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90';

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

{#snippet filterPalette(autofocus = false)}
  <BacklogFilter
    {autofocus}
    names={permanentNames}
    categoryCounts={categoryCounts()}
    musicianCounts={musicianCounts()}
    result="{$t.backlog.shown(filtered().length, scoped().length)} ({formatDuration(filtered().reduce((s, song) => s + (song.lengthMinutes ?? 5), 0), $lang)})"
  />
{/snippet}

<Tooltip.Provider>
<!-- Sticky controls bar (desktop): breadcrumb + search on the left, mode toggles + add on the right. Mobile keeps its bottom bar + drawer. -->
<div class="contents max-[700px]:hidden">
  <PageControls label={$t.nav.backlog}>
    {#snippet start()}
      <NavigationMenu.Item class="min-w-0"><Breadcrumb.Root><Breadcrumb.List class="flex-nowrap"><Breadcrumb.Item><Breadcrumb.Page class="inline-flex min-h-10 items-center whitespace-nowrap">{$t.nav.backlog}</Breadcrumb.Page></Breadcrumb.Item></Breadcrumb.List></Breadcrumb.Root></NavigationMenu.Item>
      <PageControlsDivider />
      <NavigationMenu.Item>
        <span bind:this={filterAnchor} class="inline-flex">
          <IconButton class="relative {activeFilterCount > 0 ? onClass : ''}" icon="🎛️" label={$t.backlog.filterBtn} pressed={$filterPopoverOpen} expanded={$filterPopoverOpen} onpressedchange={v => actions.setFilterPopoverOpen(v)}>
            {#if activeFilterCount > 0}<Badge class="absolute top-0 right-0 h-4 min-w-4 justify-center px-1 text-[0.65rem]">{activeFilterCount}</Badge>{/if}
          </IconButton>
        </span>
        <Popover.Root open={$filterPopoverOpen} onOpenChange={v => actions.setFilterPopoverOpen(v)}>
          <Popover.Content customAnchor={filterAnchor} align="start" class="w-[340px] p-1" onInteractOutside={(e) => { if (filterAnchor?.contains(e.target as Node)) e.preventDefault(); }}>
            {@render filterPalette()}
          </Popover.Content>
        </Popover.Root>
      </NavigationMenu.Item>
      <NavigationMenu.Item class="min-w-0"><ActiveFilters class="flex-nowrap overflow-hidden" /></NavigationMenu.Item>
    {/snippet}
    {#snippet end()}
      {#if $canWrite}<NavigationMenu.Item><IconButton variant="default" icon="➕" label={$t.backlog.addSong} onclick={() => actions.setShowAddModal(true)} /></NavigationMenu.Item>{/if}
    {/snippet}
  </PageControls>
</div>
<div class="flex h-[calc(100dvh-56px)] flex-col min-[701px]:h-[calc(100dvh-112px)] max-[700px]:h-[calc(100dvh-56px-52px)]">
  <div class="flex-1 overflow-auto px-4 pt-3 pb-4 max-[700px]:px-0 max-[700px]:py-0 **:data-[slot=table-container]:overflow-visible">
    {#if loading}
      <LoadingCat />
    {:else}
      <!-- shadcn Table; two-line rows when it would not fit (see `compact`) -->
      <Table.Root class={$compact ? 'block' : ''}>
        <Table.Header class={$compact ? 'sticky top-0 z-[2] block bg-card shadow-[0_2px_0_var(--border)]' : ''}>
          {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
            <Table.Row class="hover:bg-transparent {$compact ? rowCompact : ''}">
              {#each headerGroup.headers as header (header.id)}
                {@const m = meta(header.column)}
                <Table.Head
                  class="{m.head ?? ''} {$compact ? `static block ${m.compact ?? ''} ${isPeople(m) ? 'content-center' : 'content-center border-b'}` : ''}"
                  style={$compact ? '' : `${m.width ? `width: ${m.width};` : ''}${m.minWidth ? `min-width: ${m.minWidth}` : ''}`}
                  aria-sort={ariaSort(header.column.getIsSorted())}
                >
                  {#if m.last}<span class="sr-only"><FlexRender content={header.column.columnDef.header} context={header.getContext()} /></span>
                  {:else}<FlexRender content={header.column.columnDef.header} context={header.getContext()} />{/if}
                </Table.Head>
              {/each}
            </Table.Row>
          {/each}
        </Table.Header>
        <Table.Body class={$compact ? 'block' : ''}>
          {#each rows as row (row.id)}
            <Table.Row class="group/row relative cursor-pointer border-0 hover:bg-transparent {$compact ? `${rowCompact} not-first:-mt-px` : ''}" onclick={() => onRowClick(row.original)}>
              {#each row.getVisibleCells() as cell (cell.id)}
                {@const m = meta(cell.column)}
                <Table.Cell class="bg-card py-0.5 min-[701px]:group-hover/row:bg-(--row-hover) {m.cell ?? ''} {$compact ? `block ${m.compact ?? ''} ${isPeople(m) ? 'min-h-10 content-center border-t' : topTint}` : isPeople(m) ? '' : tint}" style={m.cellStyle?.(row.original) ?? ''}>
                  <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                </Table.Cell>
              {/each}
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>

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

  <!-- Mobile filter drawer -->
  <Drawer.Root open={$filterOpen} onOpenChange={v => actions.setFilterOpen(v)} shouldScaleBackground={false}>
    <Drawer.Content class="min-[701px]:hidden">
      <Drawer.Header>
        <Drawer.Title>{$t.backlog.filterBtn}</Drawer.Title>
        <Drawer.Description class="sr-only">{$t.backlog.search}</Drawer.Description>
      </Drawer.Header>
      <div class="flex flex-col gap-3 px-4 pb-6">
        <ActiveFilters />
        {@render filterPalette(true)}
      </div>
    </Drawer.Content>
  </Drawer.Root>

  <!-- Mobile bottom bar -->
  <div class="fixed inset-x-0 bottom-0 z-40 hidden h-[52px] items-center gap-2 border-t bg-card px-3 max-[700px]:flex">
    <ButtonGroup>
      <IconButton class="relative {onClass}" icon="🎛️" label={$t.backlog.filterBtn} pressed={$filterOpen || hasActiveFilters} onpressedchange={() => actions.toggleFilterOpen()}>
        {#if activeFilterCount > 0}<Badge class="absolute top-0 right-0 h-4 min-w-4 justify-center px-1 text-[0.65rem]">{activeFilterCount}</Badge>{/if}
      </IconButton>
      {#if $canWrite}<IconButton class={onClass} icon="📋" label={$t.backlog.addMode} pressed={$additionMode} onpressedchange={() => actions.toggleAdditionMode()} />{/if}
    </ButtonGroup>
    {#if $canWrite}<IconButton class="ml-auto" variant="default" icon="➕" label={$t.backlog.addSong} onclick={() => actions.setShowAddModal(true)} />{/if}
  </div>
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
  <Dialog.Content class="sm:max-w-sm">
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
              class="w-full justify-between px-3.5 text-[0.9rem] {inSetlist ? 'border-primary bg-primary/10 hover:bg-primary/20' : ''}"
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
<AlertDialog.Root open={$deleteRequest !== null} onOpenChange={(open) => { if (!open) actions.requestDelete(null); }}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{$t.song.remove}</AlertDialog.Title>
      <AlertDialog.Description>{$t.deleteConfirm}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{$t.song.cancel}</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={confirmDelete}>{$t.song.remove}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

{#if lyricsViewSong}
  <LyricsOverlay
    song={lyricsViewSong}
    onclose={() => actions.setLyricsViewSong(null)}
    onsongupdate={(updated) => {
      patchBacklogSong(updated);
    }}
  />
{/if}
