<script lang="ts">
  /** Header of the song Data Table (sticky, shared by the editor and the rehearsal page). */
  import type { Table as TanTable } from '@tanstack/table-core';
  import * as Table from '$components/ui/table';
  import { FlexRender } from '$components/ui/data-table';
  import { cn } from '$lib/utils';
  import { colMeta } from './songColumns';

  let { table, offNames = [] }: { table: TanTable<any>; offNames?: string[] } = $props();
</script>

<Table.Header class="max-[700px]:hidden">
  {#each table.getHeaderGroups() as group (group.id)}
    <Table.Row class="border-0 hover:bg-transparent">
      {#each group.headers as header (header.id)}
        {@const id = header.column.id}
        {@const mi = id.startsWith('m:') ? group.headers.filter(h => h.column.id.startsWith('m:')).findIndex(h => h.column.id === id) : -1}
        <Table.Head style={colMeta(header.column).style} class={cn(colMeta(header.column).headCls, mi >= 0 && offNames.includes(id.slice(2)) && 'opacity-40', mi >= 0 && 'text-center')}>
          <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
        </Table.Head>
      {/each}
    </Table.Row>
  {/each}
</Table.Header>
