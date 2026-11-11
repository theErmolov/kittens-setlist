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
export interface SongColMeta { cls?: string; headCls?: string; /** Preferred width (inline style) of head + cells. */ style?: string }
export const colMeta = (c: { columnDef: { meta?: unknown } }): SongColMeta => (c.columnDef.meta ?? {}) as SongColMeta;

export interface SongHeaders {
  num?: Snippet<[]>;
  song?: Snippet<[]>;
  /** Header text of the guests column. */
  guests?: string;
  /** Header text of the time column. */
  time?: string;
}

/** A table row view-model: song rows are rendered by SongEntryRow, other kinds by the page around it. */
export interface SongTableRow<T = unknown> { id: string; kind: string; item: T }

type Ctx = { snippets: Record<string, Snippet<[any]>>; column: { id: string } };
const cellOf = (key: string) => (ctx: unknown) => renderSnippet((ctx as Ctx).snippets[key], undefined);

/** Preferred width of a musician column: room for its widest instrument set at full icon size (the header text is the floor). */
export const iconColumnWidth = (maxIcons: number) => `--mw: calc(${Math.max(1, maxIcons)} * 1.6rem + 0.75rem)`;

export function songColumns(roster: string[], headers: SongHeaders, maxIcons: Record<string, number> = {}): ColumnDef<SongTableRow>[] {
  return [
    { id: 'drag', header: '', cell: cellOf('drag'), meta: { cls: 'w-6 touch-none text-center text-base text-muted-foreground select-none', headCls: 'w-6' } },
    { id: 'num', header: headers.num ? () => renderSnippet(headers.num!, undefined) : '#', cell: cellOf('num'), meta: { cls: 'w-px text-left text-[0.82rem] text-muted-foreground max-mid:h-px max-mid:p-0 max-mid:text-center', headCls: 'w-px text-left max-mid:text-center' } },
    { id: 'time', header: headers.time ?? '', cell: cellOf('time'), meta: { cls: 'w-px px-1.5 text-left text-[0.72rem] text-muted-foreground max-mid:hidden', headCls: 'w-px px-1.5 text-left text-[0.62rem] max-mid:hidden' } },
    { id: 'song', header: headers.song ? () => renderSnippet(headers.song!, undefined) : '', cell: cellOf('song'), meta: { cls: 'w-full max-w-0 max-mid:max-w-none max-mid:whitespace-normal', headCls: 'w-full max-w-0 overflow-hidden' } },
    ...roster.map((name): ColumnDef<SongTableRow> => ({
      id: `m:${name}`,
      header: name,
      cell: (ctx) => renderSnippet((ctx as unknown as Ctx).snippets.m, name),
      meta: { style: iconColumnWidth(maxIcons[name] ?? 1), cls: 'px-1.5 min-[1280px]:min-w-(--mw) text-left text-[1.17rem] max-mid:hidden', headCls: 'px-1.5 min-[1280px]:min-w-(--mw) text-center max-mid:hidden' },
    })),
    { id: 'guests', header: headers.guests ?? '', cell: cellOf('guests'), meta: { cls: 'w-[12%] min-w-[110px] max-mid:hidden', headCls: 'w-[12%] min-w-[110px] max-mid:hidden' } },
    { id: 'actions', header: '', cell: cellOf('actions'), meta: { cls: 'h-px w-px p-0 text-right max-mid:p-0', headCls: 'w-px px-2 text-right' } },
  ];
}

/** True when any of the songs has a guest (a musician that is not in the permanent roster and plays something). */
export function hasGuests(songs: { musicians: Record<string, { instruments: unknown[] }> }[], roster: string[]): boolean {
  const permanent = new Set(roster);
  return songs.some(song => Object.entries(song.musicians).some(([name, role]) => !permanent.has(name) && role.instruments.length > 0));
}

/** Column visibility: unused musician columns, the time column without a start time and the (otherwise empty) drag column are hidden. */
export function songVisibility(roster: string[], used: string[], showTime: boolean, showDrag = true, showGuests = true): VisibilityState {
  const usedSet = new Set(used);
  return { drag: showDrag, time: showTime, guests: showGuests, ...Object.fromEntries(roster.map(n => [`m:${n}`, usedSet.has(n)])) };
}
