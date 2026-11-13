/**
 * Column defs of the song Data Table, shared by the setlist editor and the rehearsal detail page.
 * Cells render through the row's own snippets (SongEntryRow passes them in the render context);
 * headers are supplied by the page (`headers`), musician columns are generated from the roster and
 * shown/hidden through the table's `columnVisibility` state.
 */
import { renderSnippet } from '$components/ui/data-table';
import type { ColumnDef, VisibilityState } from '@tanstack/table-core';
import type { Snippet } from 'svelte';

/** Column `meta` of the song table: Tailwind classes of the body cells / header cell. */
export interface SongColMeta { cls?: string; headCls?: string }
export const colMeta = (c: { columnDef: { meta?: unknown } }): SongColMeta => (c.columnDef.meta ?? {}) as SongColMeta;

export interface SongHeaders {
  num?: Snippet<[]>;
  song?: Snippet<[]>;
  /** Header text of the time column. */
  time?: string;
}

/** A table row view-model: song rows are rendered by SongEntryRow, other kinds by the page around it. */
export interface SongTableRow<T = unknown> { id: string; kind: string; item: T }

type Ctx = { snippets: Record<string, Snippet<[any]>>; column: { id: string } };
const cellOf = (key: string) => (ctx: unknown) => renderSnippet((ctx as Ctx).snippets[key], undefined);

export function songColumns(roster: string[], headers: SongHeaders): ColumnDef<SongTableRow>[] {
  return [
    { id: 'drag', header: '', cell: cellOf('drag'), meta: { cls: 'w-6 touch-none text-center text-base text-muted-foreground select-none', headCls: 'w-6' } },
    { id: 'num', header: headers.num ? () => renderSnippet(headers.num!, undefined) : '#', cell: cellOf('num'), meta: { cls: 'w-px px-1 text-left text-caption text-muted-foreground max-mid:h-px max-mid:p-0 max-mid:text-center', headCls: 'w-px px-1 text-left max-mid:text-center' } },
    { id: 'time', header: headers.time ?? '', cell: cellOf('time'), meta: { cls: 'w-px px-1 text-left text-micro text-muted-foreground max-mid:hidden', headCls: 'w-px px-1 text-left text-micro max-mid:hidden' } },
    { id: 'song', header: headers.song ? () => renderSnippet(headers.song!, undefined) : '', cell: cellOf('song'), meta: { cls: 'w-full max-w-0 max-mid:max-w-none max-mid:whitespace-normal', headCls: 'w-full max-w-0 overflow-hidden' } },
    // Musician columns are exactly as compact as the catalog's: one FIXED width (3.75rem = 60px, small header text), never wider.
    ...roster.map((name): ColumnDef<SongTableRow> => ({
      id: `m:${name}`,
      header: name,
      cell: (ctx) => renderSnippet((ctx as unknown as Ctx).snippets.m, name),
      meta: { cls: 'w-15 min-w-15 max-w-15 px-1 text-left text-[1.17rem] max-mid:hidden', headCls: 'w-15 min-w-15 max-w-15 overflow-hidden px-1 text-center text-micro tracking-normal text-ellipsis max-mid:hidden' },
    })),
    { id: 'actions', header: '', cell: cellOf('actions'), meta: { cls: 'h-px w-px p-0 text-right max-mid:p-0', headCls: 'w-px px-2 text-right' } },
  ];
}

/** Column visibility: unused musician columns, the time column without a start time and the (otherwise empty) drag column are hidden. */
export function songVisibility(roster: string[], used: string[], showTime: boolean, showDrag = true): VisibilityState {
  const usedSet = new Set(used);
  return { drag: showDrag, time: showTime, ...Object.fromEntries(roster.map(n => [`m:${n}`, usedSet.has(n)])) };
}
