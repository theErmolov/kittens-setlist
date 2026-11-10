<script lang="ts">
  import { base } from '$app/paths';
  import { createQuery } from '@tanstack/svelte-query';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { Card } from '$components/ui/card';
  import { Badge } from '$components/ui/badge';
  import * as Table from '$components/ui/table';
  import { getCoreRowModel, type ColumnDef } from '@tanstack/table-core';
  import { createSvelteTable, FlexRender, renderSnippet } from '$components/ui/data-table';
  import * as Empty from '$components/ui/empty';
  import { Alert } from '$components/ui/alert';
  import { lang, t } from '$lib/i18n';
  import { onlinePresenceQuery, setlistsQuery } from '$lib/query/queries';
  import { useStore } from '$lib/store/bridge';
  import { pollUnlessDenied } from '$lib/query/client';
  import { onlineStore } from '$lib/store/shell';

  const presence = createQuery(() => ({
    ...onlinePresenceQuery(),
    staleTime: 0,
    refetchInterval: pollUnlessDenied(() => (document.hidden ? false : 10_000)),
  }));
  const setlists = createQuery(() => setlistsQuery());
  const now = useStore(onlineStore, s => s.now);

  const loading = $derived(presence.isPending);
  const failed = $derived(presence.isError);
  const entries = $derived(failed ? [] : presence.data ?? []);
  const setlistNames = $derived(Object.fromEntries((setlists.data ?? []).map(setlist => [setlist.id, setlist.name])));

  // Refresh the "now" used to expire entries whenever fresh data lands or the tab returns.
  $effect(() => {
    presence.dataUpdatedAt;
    onlineStore.getState().touch();
  });
  $effect(() => {
    const visible = () => onlineStore.getState().touch();
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  });

  // One row per (person, room); a person with several tabs open in a room shows "×N".
  interface OnlineRow { id: string; name: string; room: string; tabs: number; lastSeen: number }
  const rows = $derived.by(() => {
    const grouped = new Map<string, OnlineRow>();
    for (const entry of entries) {
      if (entry.expiresAt * 1000 <= $now) continue;
      const person = entry.userId ?? `guest:${entry.clientId}`;
      const id = `${person}|${entry.room}`;
      const seen = Date.parse(entry.lastSeen) || 0;
      const row = grouped.get(id);
      if (row) { row.tabs += 1; row.lastSeen = Math.max(row.lastSeen, seen); }
      else grouped.set(id, { id, name: entry.userId ? entry.name : $t.admin.onlineGuest, room: entry.room, tabs: 1, lastSeen: seen });
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name) || a.room.localeCompare(b.room));
  });
  const peopleCount = $derived(new Set(rows.map(r => r.id.split('|')[0])).size);

  const columns = $derived<ColumnDef<OnlineRow>[]>([
    { id: 'user', header: $t.admin.onlineUser, cell: ({ row }) => renderSnippet(userCell, row.original) },
    { id: 'scope', header: $t.admin.onlineScope, cell: ({ row }) => renderSnippet(scopeCell, row.original) },
    { id: 'room', header: $t.admin.onlineRoom, cell: ({ row }) => renderSnippet(roomCell, row.original) },
    { id: 'seen', header: $t.admin.onlineSeen, cell: ({ row }) => renderSnippet(seenCell, row.original) },
  ]);
  const table = createSvelteTable<OnlineRow>({
    get data() { return rows; },
    get columns() { return columns; },
    getRowId: row => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  function roomHref(room: string): string {
    return room === 'backlog' ? `${base}/backlog` : `${base}/setlists/${encodeURIComponent(room.slice(8))}`;
  }
  function roomLabel(room: string): string {
    return room === 'backlog' ? $t.nav.backlog : setlistNames[room.slice(8)] ?? $t.admin.onlineSetlist;
  }
</script>

<Card class="online-panel mb-5 gap-0 rounded-[10px] px-4 py-3.5" aria-labelledby="online-title" role="region">
  <h2 id="online-title" class="mb-2.5 flex items-center gap-2 text-[0.9rem] font-semibold">{$t.admin.onlineTitle}{#if !loading && !failed} <Badge variant="secondary" class="count">{peopleCount}</Badge>{/if}</h2>
  {#if loading}
    <LoadingCat />
  {:else if failed}
    <Alert variant="destructive" class="border-0 bg-transparent p-0 text-[0.82rem]" role="status">{$t.admin.onlineUnavailable}</Alert>
  {:else if rows.length === 0}
    <Empty.Root class="border-0 p-2"><Empty.Header><Empty.Description class="text-[0.78rem] leading-normal">{$t.admin.onlineEmpty}</Empty.Description></Empty.Header></Empty.Root>
  {:else}
    <div>
      <Table.Root class="max-[760px]:[&_thead]:hidden max-[760px]:[&_tbody]:grid max-[760px]:[&_tbody]:gap-[3px]">
        <Table.Header>
          {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
            <Table.Row>
              {#each headerGroup.headers as header (header.id)}
                <Table.Head><FlexRender content={header.column.columnDef.header} context={header.getContext()} /></Table.Head>
              {/each}
            </Table.Row>
          {/each}
        </Table.Header>
        <Table.Body>
          {#each table.getRowModel().rows as row (row.id)}
            <Table.Row class="max-[760px]:grid max-[760px]:grid-cols-2">
              {#each row.getVisibleCells() as cell (cell.id)}
                <Table.Cell class="whitespace-normal [overflow-wrap:anywhere] max-[760px]:not-last:border-r-0"><FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} /></Table.Cell>
              {/each}
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/if}
  <p class="mt-2.5 text-[0.78rem] leading-normal text-muted-foreground">{$t.admin.onlineHint}</p>
</Card>

{#snippet userCell(row: OnlineRow)}
  <span class="flex min-w-0 items-center gap-[7px] text-[0.85rem]"><span class="size-1.5 shrink-0 rounded-full bg-success-ink" aria-hidden="true"></span>{row.name}</span>
{/snippet}
{#snippet scopeCell(row: OnlineRow)}{row.room === 'backlog' ? $t.nav.backlog : $t.admin.onlineSetlist}{/snippet}
{#snippet roomCell(row: OnlineRow)}
  <a class="text-[0.8rem] text-primary-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={roomHref(row.room)}>{roomLabel(row.room)}{#if row.tabs > 1}{' ×'}{row.tabs}{/if}</a>
{/snippet}
{#snippet seenCell(row: OnlineRow)}{row.lastSeen ? new Date(row.lastSeen).toLocaleTimeString($lang === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}{/snippet}
