<script lang="ts">
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { Button } from '$components/ui/button';
  import * as Select from '$components/ui/select';
  import * as Table from '$components/ui/table';
  import IconButton from '$components/shared/IconButton.svelte';
  import * as Empty from '$components/ui/empty';
  import { getCoreRowModel, type ColumnDef, type PaginationState, type Updater } from '@tanstack/table-core';
  import { createSvelteTable, FlexRender, renderSnippet } from '$components/ui/data-table';
  import type { AuditLogEntry } from '$lib/types';
  import { lang, t } from '$lib/i18n';
  import { currentUser, authLoading } from '$lib/auth';
  import { createQuery } from '@tanstack/svelte-query';
  import { auditPageQuery } from '$lib/query/shell';
  import { useStore } from '$lib/store/bridge';
  import { auditStore } from '$lib/store/shell';
  import { formatLocalizedAuditSummary, formatLocalizedAuditEntity } from '$lib/auditI18n';

  const auditPageSize = useStore(auditStore, s => s.pageSize);
  const auditCursorStack = useStore(auditStore, s => s.cursorStack);

  const audit = createQuery(() => auditPageQuery(
    $auditPageSize,
    $auditCursorStack[$auditCursorStack.length - 1],
    !$authLoading && $currentUser?.isAdmin === true,
  ));
  const auditItems = $derived(audit.data?.items ?? []);
  const auditNextCursor = $derived(audit.data?.nextCursor);
  const auditLoading = $derived(audit.isFetching);

  // Data Table with server (cursor) pagination: pageIndex = number of cursors consumed; moving forward pushes
  // the API's next cursor, moving back pops one. The TanStack Query cursor flow above is unchanged.
  function onPaginationChange(updater: Updater<PaginationState>) {
    const current: PaginationState = { pageIndex: $auditCursorStack.length, pageSize: $auditPageSize };
    const next = typeof updater === 'function' ? updater(current) : updater;
    if (next.pageSize !== current.pageSize) auditStore.getState().setPageSize(next.pageSize);
    else if (next.pageIndex > current.pageIndex && auditNextCursor) auditStore.getState().next(auditNextCursor);
    else if (next.pageIndex < current.pageIndex) auditStore.getState().prev();
  }

  const columns = $derived<ColumnDef<AuditLogEntry>[]>([
    { id: 'when', header: $t.admin.auditWhen, meta: { cellClass: 'audit-when w-36 text-muted-foreground' }, cell: ({ row }) => renderSnippet(whenCell, row.original) },
    { id: 'who', header: $t.admin.auditWho, meta: { cellClass: 'audit-who w-28 font-semibold whitespace-normal' }, cell: ({ row }) => renderSnippet(whoCell, row.original) },
    { id: 'entity', header: $t.admin.auditEntity, meta: { cellClass: 'whitespace-normal' }, cell: ({ row }) => renderSnippet(entityCell, row.original) },
    { id: 'details', header: $t.admin.auditDetails, meta: { cellClass: 'audit-details whitespace-normal break-words text-muted-foreground' }, cell: ({ row }) => renderSnippet(detailsCell, row.original) },
  ]);
  const table = createSvelteTable<AuditLogEntry>({
    get data() { return auditItems; },
    get columns() { return columns; },
    getRowId: entry => entry.sk,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    get pageCount() { return $auditCursorStack.length + (auditNextCursor ? 2 : 1); },
    state: {
      get pagination() { return { pageIndex: $auditCursorStack.length, pageSize: $auditPageSize }; },
    },
    onPaginationChange,
  });

  function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleString($lang === 'ru' ? 'ru-RU' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

</script>

{#if $currentUser?.isAdmin}
    <section>
      <div class="audit-header mb-2 flex justify-end">
        <Select.Root type="single" value={String($auditPageSize)} onValueChange={v => table.setPageSize(Number(v))}>
          <Select.Trigger class="page-size-select w-20 bg-card max-md:text-base" aria-label={$t.admin.auditLog}>{$auditPageSize}</Select.Trigger>
          <Select.Content>
            {#each [20, 50, 100] as size (size)}
              <Select.Item value={String(size)} label={String(size)} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      {#if auditLoading}<LoadingCat />
      {:else if auditItems.length === 0}<Empty.Root class="hint border"><Empty.Header><Empty.Description>{$t.admin.auditEmpty}</Empty.Description></Empty.Header></Empty.Root>
      {:else}
        <div class="audit-table">
          <Table.Root class="max-mid:[&_tbody]:grid max-mid:[&_tbody]:gap-[3px] max-mid:[&_thead]:hidden">
            <Table.Header>
              {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
                <Table.Row>
                  {#each headerGroup.headers as header (header.id)}
                    <Table.Head>
                      <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
                    </Table.Head>
                  {/each}
                </Table.Row>
              {/each}
            </Table.Header>
            <Table.Body>
              {#each table.getRowModel().rows as row (row.id)}
                <Table.Row class="max-mid:grid max-mid:grid-cols-2 max-mid:gap-x-2">
                  {#each row.getVisibleCells() as cell (cell.id)}
                    <Table.Cell class="max-mid:not-last:border-r-0 {(cell.column.columnDef.meta as { cellClass?: string } | undefined)?.cellClass ?? ''}">
                      <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                    </Table.Cell>
                  {/each}
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
        <div class="audit-nav mt-2.5 flex gap-2">
          <IconButton icon="⬅️" label={$t.admin.auditPrev} disabled={!table.getCanPreviousPage()} onclick={() => table.previousPage()} />
          <IconButton icon="➡️" label={$t.admin.auditNext} disabled={!table.getCanNextPage()} onclick={() => table.nextPage()} />
        </div>
      {/if}
    </section>
{/if}

{#snippet whenCell(entry: AuditLogEntry)}{formatTimestamp(entry.timestamp)}{/snippet}
{#snippet whoCell(entry: AuditLogEntry)}{entry.actorName}{/snippet}
{#snippet entityCell(entry: AuditLogEntry)}<span class="entity-type mr-1 text-[0.68rem] font-bold uppercase text-primary-ink">{$t.admin.auditEntities[entry.entityType]}</span>{formatLocalizedAuditEntity(entry, $lang)}{/snippet}
{#snippet detailsCell(entry: AuditLogEntry)}{formatLocalizedAuditSummary(entry, $lang)}{/snippet}
