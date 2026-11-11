<script lang="ts">
  import { browser } from '$app/environment';
  import VibeBadge from '$components/shared/VibeBadge.svelte';
  import LinkifiedText from '$components/shared/LinkifiedText.svelte';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import PageControlsDivider from '$components/shared/PageControlsDivider.svelte';
  import PageControls from '$components/shared/PageControls.svelte';
  import * as NavigationMenu from '$components/ui/navigation-menu';
  import * as Breadcrumb from '$components/ui/breadcrumb';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import { Switch } from '$components/ui/switch';
  import * as Dialog from '$components/ui/dialog';
  import { mobileFullscreen } from '$components/setlist/dialogClasses';
  import * as Empty from '$components/ui/empty';
  import * as Table from '$components/ui/table';
  import { Badge } from '$components/ui/badge';
  import RowActions from '$components/shared/RowActions.svelte';
  import IconButton from '$components/shared/IconButton.svelte';
  import { createSvelteTable, FlexRender, renderSnippet } from '$components/ui/data-table';
  import { getCoreRowModel, getSortedRowModel, type ColumnDef } from '@tanstack/table-core';
  import { base } from '$app/paths';
  import { lang } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { cn, formatDuration, formatDate } from '$lib/utils';
  import type { Setlist } from '$lib/types';
  import * as AlertDialog from '$components/ui/alert-dialog';
  import { createQuery } from '@tanstack/svelte-query';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';
  import { canWrite } from '$lib/auth';
  import { setlistsQuery } from '$lib/query/queries';
  import { useCreateSetlist, useDeleteSetlist } from '$lib/query/setlistMutations';
  import { useStore } from '$lib/store/bridge';
  import { setlistListStore } from '$lib/store/setlistList';

  const setlistsQ = createQuery(() => setlistsQuery());
  const createMut = useCreateSetlist();
  const deleteMut = useDeleteSetlist();

  const showNew = useStore(setlistListStore, s => s.showNew);
  const newName = useStore(setlistListStore, s => s.name);
  const newDate = useStore(setlistListStore, s => s.date);
  const newStartTime = useStore(setlistListStore, s => s.startTime);
  const newVibe = useStore(setlistListStore, s => s.vibe);
  const deleteId = useStore(setlistListStore, s => s.deleteId);
  const { setShowNew, setField, resetForm, setDeleteId } = setlistListStore.getState();

  const sorting = useStore(setlistListStore, s => s.sorting);
  const songCount = (sl: Setlist) => sl.entries.filter(e => e.songId).length;
  const totalMinutes = (sl: Setlist) => sl.entries.reduce((n, e) => n + (e.breakMinutes ?? (e.songId ? (e.song?.lengthMinutes ?? 5) : 0)), 0);
  const columns: ColumnDef<Setlist>[] = [
    { id: 'name', accessorFn: sl => sl.name, header: () => $t.setlists.colName, cell: ({ row }) => renderSnippet(nameCell, row.original), meta: { cls: 'w-full max-w-0 max-mid:overflow-hidden' } },
    // Date and start time in one column, as wide as its content.
    { id: 'date', accessorFn: sl => sl.date || undefined, header: () => $rt.date, sortUndefined: 'last', cell: ({ row }) => [row.original.date ? formatDate(row.original.date, $lang) : '', row.original.startTime ?? ''].filter(Boolean).join(' '), meta: { cls: 'w-px max-mid:hidden', head: 'w-px max-mid:hidden' } },
    { id: 'songs', accessorFn: songCount, header: () => $t.setlists.colSongs, cell: ({ row }) => `${$t.setlists.songs(songCount(row.original))} (${formatDuration(totalMinutes(row.original), $lang)})`, meta: { cls: 'w-px max-mid:hidden', head: 'w-px max-mid:hidden' } },
    { id: 'vibe', accessorFn: sl => sl.vibe, header: () => $t.setlists.colVibe, enableSorting: false, cell: ({ row }) => renderSnippet(vibeCell, row.original), meta: { cls: 'w-px max-mid:hidden', head: 'w-px max-mid:hidden' } },
    { id: 'actions', header: '', enableSorting: false, cell: ({ row }) => renderSnippet(actionsCell, row.original), meta: { cls: 'w-px h-px p-0 text-right max-mid:px-0', head: 'w-px' } },
  ];
  const table = createSvelteTable<Setlist>({
    get data() { return setlistsQ.data ?? []; },
    columns,
    state: { get sorting() { return $sorting; } },
    onSortingChange: u => setlistListStore.getState().setSorting(typeof u === 'function' ? u($sorting) : u),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: sl => sl.id,
  });
  const metaOf = (c: { columnDef: { meta?: unknown } }) => (c.columnDef.meta ?? {}) as { cls?: string; head?: string };

  async function handleCreate() {
    const { name, date, startTime, vibe } = setlistListStore.getState();
    if (!name.trim()) return;
    const sl = await createMut.mutateAsync({ name: name.trim(), date: date.trim() || undefined, startTime: startTime.trim() || undefined, vibe: vibe || undefined });
    resetForm();
    goto(`/setlists/${sl.id}`);
  }

  function confirmDelete() {
    const id = setlistListStore.getState().deleteId;
    setDeleteId(null);
    if (id) deleteMut.mutate(id);
  }

  const primaryBtn = 'font-semibold';
</script>

<!-- Desktop bar; on small screens the actions live in a bottom bar (as in the catalog). -->
{#if browser && !setlistsQ.isPending}
<div class="contents max-mid:hidden">
<PageControls label={$t.nav.setlists}>
  {#snippet start()}
    <NavigationMenu.Item class="min-w-0"><Breadcrumb.Root><Breadcrumb.List class="flex-nowrap"><Breadcrumb.Item><Breadcrumb.Page class="inline-flex min-h-10 items-center whitespace-nowrap">{$t.nav.setlists}</Breadcrumb.Page></Breadcrumb.Item></Breadcrumb.List></Breadcrumb.Root></NavigationMenu.Item>
  {/snippet}
  {#snippet end()}
    {#if $canWrite}
      <PageControlsDivider />
      <NavigationMenu.Item><IconButton icon="➕" variant="default" label={$t.setlists.newBtn.replace(/^\+\s*/, '')} onclick={() => setShowNew(!setlistListStore.getState().showNew)} /></NavigationMenu.Item>
    {/if}
  {/snippet}
</PageControls>
</div>
{#if $canWrite}
  <div class="fixed inset-x-0 bottom-0 z-40 hidden h-[52px] items-center justify-center gap-2 border-t bg-card px-3 max-mid:flex">
    <IconButton variant="default" icon="➕" label={$t.setlists.newBtn.replace(/^\+\s*/, '')} onclick={() => setShowNew(!setlistListStore.getState().showNew)} />
  </div>
{/if}

{/if}

<!-- New setlist: a dialog (same layout as the editor's «Edit» dialog). -->
<Dialog.Root open={$showNew && $canWrite} onOpenChange={o => { if (!o) setShowNew(false); }}>
  <Dialog.Content class="gap-4 max-sm:grid-rows-[auto_1fr_auto] sm:max-w-md {mobileFullscreen}">
    <Dialog.Header><Dialog.Title class="text-[1.1rem] font-bold">{$t.setlists.newBtn.replace(/^\+\s*/, '')}</Dialog.Title></Dialog.Header>
    <div class="flex flex-col gap-3">
      <Input value={$newName} oninput={e => setField({ name: e.currentTarget.value })} placeholder={$t.setlists.namePlaceholder} aria-label={$t.setlists.namePlaceholder} />
      <div class="flex flex-wrap gap-2">
        <Input type="date" class="min-w-[140px] flex-1" value={$newDate} oninput={e => setField({ date: e.currentTarget.value })} />
        <Input type="time" class="min-w-[120px] flex-1" value={$newStartTime} oninput={e => setField({ startTime: e.currentTarget.value })} />
      </div>
      <div class="flex items-center gap-2">
        <Switch id="new-vibe" size="sm" checked={$newVibe} onCheckedChange={v => setField({ vibe: v })} />
        <Label for="new-vibe" class="text-[0.88rem] font-normal text-muted-foreground">{$t.setlists.vibe}</Label>
        <span class="inline-flex size-4 shrink-0 cursor-default items-center justify-center rounded-full border text-[0.7rem] leading-none text-muted-foreground" title={$t.setlists.vibeTooltip}>?</span>
      </div>
    </div>
    <Dialog.Footer class="max-sm:mt-auto">
      <Button variant="outline" onclick={() => setShowNew(false)}>{$t.setlists.cancel}</Button>
      <Button onclick={handleCreate} disabled={!$newName.trim()}>{$t.setlists.create}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<div class="p-0 max-mid:pb-[52px]">


  {#if !browser || setlistsQ.isPending}
    <LoadingCat />
  {:else if (setlistsQ.data ?? []).length === 0}
    <Empty.Root class="border py-[60px]">
      <Empty.Header>
        <Empty.Title class="text-base font-normal text-muted-foreground">{$t.setlists.empty}</Empty.Title>
      </Empty.Header>
      {#if !$showNew && $canWrite}
        <Empty.Content>
          <Button class={primaryBtn} onclick={() => setShowNew(true)}>{$t.setlists.createFirst}</Button>
        </Empty.Content>
      {/if}
    </Empty.Root>
  {:else}
    <Table.Root>
      <Table.Header>
        {#each table.getHeaderGroups() as group (group.id)}
          <Table.Row class="border-0 hover:bg-transparent">
            {#each group.headers as header (header.id)}
              <Table.Head class={metaOf(header.column).head}><FlexRender content={header.column.columnDef.header} context={header.getContext()} /></Table.Head>
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>
      <Table.Body>
        {#each table.getRowModel().rows as row (row.id)}
          <Table.Row class="group/row h-14 cursor-pointer border-0 hover:bg-transparent" onclick={() => goto(`${base}/setlists/${row.original.id}`)}>
            {#each row.getVisibleCells() as cell (cell.id)}
              <Table.Cell class={cn('border-b bg-card py-0.5 min-mid:group-hover/row:bg-(--row-hover)', metaOf(cell.column).cls)}><FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} /></Table.Cell>
            {/each}
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/if}
</div>

{#snippet nameCell(sl: Setlist)}
  <div class="flex min-w-0 flex-col">
    <!-- Name with the comment to its right (no label; links shown as «domain.tld»), on one line at every size. -->
    <div class="flex min-w-0 items-baseline gap-x-3">
      <a href="{base}/setlists/{sl.id}" class="block max-w-full shrink-0 truncate text-inherit no-underline" onclick={(e) => e.stopPropagation()}>
        <span class="font-semibold">{sl.name}</span>
      </a>
      {#if sl.comment}<span class="min-w-0 flex-1 truncate text-[0.88rem] text-muted-foreground" title={sl.comment}><LinkifiedText text={sl.comment} /></span>{/if}
    </div>
    <!-- Small view only: date / time, then the song count and total length with the vibe badge to their right. -->
    <span class="mt-0.5 truncate text-[0.78rem] text-muted-foreground min-mid:hidden">{[sl.date ? formatDate(sl.date, $lang) : '', sl.startTime ?? ''].filter(Boolean).join(' · ')}</span>
    <span class="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground min-mid:hidden"><span class="truncate">{$t.setlists.songs(songCount(sl))} ({formatDuration(totalMinutes(sl), $lang)})</span><VibeBadge vibe={sl.vibe} class="h-4 shrink-0 px-1.5 py-0 text-[0.65rem]" /></span>
  </div>
{/snippet}

{#snippet vibeCell(sl: Setlist)}
  <VibeBadge vibe={sl.vibe} />
{/snippet}

{#snippet actionsCell(sl: Setlist)}
  <!-- The ⋯ fills the whole row height, so rows leave no gaps between buttons. -->
  <div class="flex h-full justify-end">
    <RowActions class="h-full rounded-none" actions={[
      { icon: '🎤', label: $t.setlists.stage, primary: true, href: `${base}/setlists/${sl.id}/stage` },
      ...($canWrite ? [{ icon: '🗑', label: $t.song.remove, destructive: true, separatorBefore: true, onselect: () => setDeleteId(sl.id) }] : []),
    ]} />
  </div>
{/snippet}

<AlertDialog.Root open={$deleteId !== null} onOpenChange={o => { if (!o) setDeleteId(null); }}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{$t.setlists.deleteConfirm}</AlertDialog.Title>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{$t.setlists.cancel}</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={confirmDelete}>{$t.song.remove}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
