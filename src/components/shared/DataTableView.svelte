<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import type { Cell, Header, Row, Table as TanTable } from '@tanstack/table-core';
  import * as Table from '$components/ui/table';
  import { FlexRender } from '$components/ui/data-table';

  type ColumnClasses = { cellClass?: string; headClass?: string };

  // Renders a TanStack table with the shared shadcn table markup. Per-column classes come from
  // `column.meta.cellClass` / `column.meta.headClass`; the props below add table-wide classes.
  let { table, class: className, headerClass, bodyClass, headRowClass, headClass, rowClass, rowProps, headProps, cellClass, head, emptyText }: {
    table: TanTable<T>;
    class?: string;
    headerClass?: string;
    bodyClass?: string;
    headRowClass?: string;
    headClass?: string;
    cellClass?: string;
    rowClass?: (row: Row<T>) => string | undefined;
    /** Extra attributes/handlers spread onto each body row. */
    rowProps?: (row: Row<T>) => Record<string, unknown>;
    /** Extra attributes spread onto each header cell. */
    headProps?: (header: Header<T, unknown>) => Record<string, unknown>;
    /** Replaces the default header content. */
    head?: Snippet<[Header<T, unknown>]>;
    /** Shown as a full-width muted row when there are no rows. */
    emptyText?: string;
  } = $props();

  const meta = (c: { columnDef: { meta?: unknown } }) => (c.columnDef.meta ?? {}) as ColumnClasses;
</script>

<Table.Root class={className}>
  <Table.Header class={headerClass}>
    {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
      <Table.Row class={headRowClass}>
        {#each headerGroup.headers as header (header.id)}
          <Table.Head class="{headClass ?? ''} {meta(header.column).headClass ?? ''}" {...headProps?.(header)}>
            {#if head}
              {@render head(header)}
            {:else}
              <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
            {/if}
          </Table.Head>
        {/each}
      </Table.Row>
    {/each}
  </Table.Header>
  <Table.Body class={bodyClass}>
    {#each table.getRowModel().rows as row (row.id)}
      <Table.Row class={rowClass?.(row)} {...rowProps?.(row)}>
        {#each row.getVisibleCells() as cell (cell.id)}
          <Table.Cell class="{cellClass ?? ''} {meta(cell.column).cellClass ?? ''}">
            <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
          </Table.Cell>
        {/each}
      </Table.Row>
    {:else}
      {#if emptyText}
        <Table.Row><Table.Cell colspan={table.getVisibleLeafColumns().length} class="whitespace-normal py-3 text-muted-foreground">{emptyText}</Table.Cell></Table.Row>
      {/if}
    {/each}
  </Table.Body>
</Table.Root>
