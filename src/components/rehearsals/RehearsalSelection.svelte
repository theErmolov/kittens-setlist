<script lang="ts">
  import RehearsalSongName from './RehearsalSongName.svelte';
  import RehearsalReadiness from './RehearsalReadiness.svelte';
  import type { Snippet } from 'svelte';
  import * as Tabs from '$components/ui/tabs';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Checkbox } from '$components/ui/checkbox';
  import { Toggle } from '$components/ui/toggle';
  import * as Field from '$components/ui/field';
  import { getCoreRowModel, type ColumnDef, type RowSelectionState, type Updater } from '@tanstack/table-core';
  import { createSvelteTable, renderSnippet } from '$components/ui/data-table';
  import DataTableView from '$components/shared/DataTableView.svelte';
  import ButtonRow from '$components/shared/ButtonRow.svelte';
  import { ScrollArea } from '$components/ui/scroll-area';
  import { cn } from '$lib/utils';
  import { createQuery } from '@tanstack/svelte-query';
  import { orderMusicianNames } from '$lib/utils';
  import type { RehearsalSong } from '$lib/types';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { rehearsalReadiness, rehearsalSongKey, rehearsalCoverage, compareRehearsalSongs } from '$lib/rehearsals';
  import { musiciansQuery, setlistsQuery, songsQuery } from '$lib/query/queries';
  import { useStore } from '$lib/store/bridge';
  import { rehearsalFormStore as form, selectAttendees, sameList } from '$lib/store/rehearsals';
  let { details }: { details: Snippet } = $props();
  const setlistsQ = createQuery(() => setlistsQuery());
  const songsQ = createQuery(() => songsQuery());
  const musiciansQ = createQuery(() => musiciansQuery());
  const catalog = $derived(songsQ.data ?? []);
  const musicians = $derived(musiciansQ.data ?? []);
  const { patch, toggle, toggleAttendee, chooseMusicians, addGuest } = form.getState();
  const setlistId = useStore(form, s => s.setlistId);
  const selected = useStore(form, s => s.songs);
  const attendanceOverrides = useStore(form, s => s.attendanceOverrides);
  const attendees = useStore(form, selectAttendees, sameList);
  const disabled = useStore(form, s => !!s.seed.cancelled);
  const source = useStore(form, s => s.source);
  const search = useStore(form, s => s.search);
  const guest = useStore(form, s => s.guest);
  const guests = useStore(form, s => s.guests);
  const setlist = $derived((setlistsQ.data ?? []).find(s => s.id === $setlistId));
  const candidates = $derived($source === 'selected' ? $selected : $source === 'setlist' && setlist
    ? [...setlist.entries].sort((a,b) => a.order - b.order).filter(e => e.song && e.songId).map(e => ({ songId: e.songId!, sourceSetlistId: setlist.id, song: { ...e.song!, progress: { ...(e.progress ?? {}), ...(e.song!.progress ?? {}), ...(!e.setlistOnly ? catalog.find(s => s.id === e.songId)?.progress ?? {} : {}) } } }))
    : catalog.filter(s => !s.archived).map(song => ({ songId: song.id, song })));
  const visible = $derived(candidates.filter(item => `${item.song.artist} ${item.song.title}`.toLocaleLowerCase().includes($search.toLocaleLowerCase())).sort(compareRehearsalSongs));
  const names = $derived(orderMusicianNames([...new Set([
    ...musicians.filter(m => !m.guest).map(m => m.name), ...$attendees, ...Object.keys($attendanceOverrides), ...$guests,
    ...[...candidates, ...$selected].flatMap(item => rehearsalCoverage(item.song, []).needed),
  ])], musicians));
  const tabValue = $derived($source === 'setlist' && !setlist ? 'catalog' : $source);
  const field = 'rounded-md bg-background px-2.5 text-base mid:text-base';
  function needed(name: string) { return $selected.filter(item => rehearsalCoverage(item.song, []).needed.includes(name)).length; }
  type Row = (typeof visible)[number];
  // Data Table: rows are the visible songs; TanStack's row selection mirrors the form store (`songs`), which stays the source of truth.
  const rowSelection = $derived<RowSelectionState>(Object.fromEntries($selected.map(s => [s.songId, true])));
  function onRowSelectionChange(updater: Updater<RowSelectionState>) {
    const prev = rowSelection;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    for (const item of visible) if (!!next[item.songId] !== !!prev[item.songId]) toggle(item);
  }
  const columns = $derived<ColumnDef<Row>[]>([
    { id: 'select', header: () => renderSnippet(selectAll), cell: ({ row }) => renderSnippet(selectCell, row.original), meta: { cellClass: 'w-10', headClass: 'w-10' } },
    { id: 'song', header: $rt.songSelectionTitle, cell: ({ row }) => renderSnippet(songCell, row.original), meta: { cellClass: 'whitespace-normal', headClass: 'whitespace-normal' } },
    { id: 'readiness', header: $rt.fullReadiness, cell: ({ row }) => renderSnippet(readinessCell, row.original), meta: { cellClass: 'w-24 text-right', headClass: 'w-24 text-right' } },
  ]);
  const table = createSvelteTable<Row>({
    get data() { return visible; },
    get columns() { return columns; },
    getRowId: item => item.songId,
    getCoreRowModel: getCoreRowModel(),
    get state() { return { rowSelection }; },
    onRowSelectionChange,
    enableRowSelection: () => !$disabled,
  });
  function chooseNotReady() { for (const item of visible) if (!isSelected(item) && rehearsalReadiness(item.song) !== 100) toggle(item); }
  function isSelected(item: RehearsalSong) { return $selected.some(s => s.songId === item.songId); }
</script>
<section class="grid h-full min-h-0 grid-cols-[minmax(240px,.75fr)_minmax(0,1.6fr)] gap-6 compact:flex compact:h-auto compact:flex-col" aria-label={$rt.plan}>
  <ScrollArea class="min-h-0 [&>[data-slot=scroll-area-viewport]>div]:flex [&>[data-slot=scroll-area-viewport]>div]:flex-col [&>[data-slot=scroll-area-viewport]>div]:gap-5.5 [&>[data-slot=scroll-area-viewport]>div]:pr-1 [&>[data-slot=scroll-area-viewport]>div]:pb-2 compact:shrink-0">
    {@render details()}
    <Field.Set class="min-w-0 gap-3" aria-label={$rt.attendees} disabled={$disabled}>
      <div class="grid grid-cols-3 items-center gap-2 px-0.5">
        <Field.Legend variant="label" class="mb-0 text-center text-body-lg font-bold">{$rt.attendees}</Field.Legend>
        <Button type="button" variant="outline" size="sm" class="min-w-0 px-2" onclick={() => chooseMusicians(names, true)}>{$rt.all}</Button>
        <Button type="button" variant="outline" size="sm" class="min-w-0 px-2" onclick={() => chooseMusicians(names, false)}>{$rt.none}</Button>
      </div>
      <div class="grid grid-cols-3 gap-2 p-0.5">
        {#each names as name}
          {@const count = needed(name)}
          <Toggle
            variant="outline"
            pressed={$attendees.includes(name)}
            onPressedChange={() => toggleAttendee(name)}
            title={count ? `${$rt.needed}: ${count}` : $rt.unused}
            class={cn('min-w-0 justify-between px-3 text-body on:border-transparent on:bg-primary on:text-primary-foreground', $selected.length > 0 && count === 0 && 'opacity-65')}
          ><span class="truncate">{name}</span><span class="ml-1 inline-block shrink-0 text-right text-caption tabular-nums">{count}</span></Toggle>
        {/each}
      </div>
      <div class="flex items-center gap-2">
        <Input value={$guest} oninput={e => patch({ guest: e.currentTarget.value })} placeholder={$rt.guest} aria-label={$rt.guest} maxlength={100} onkeydown={e => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }} class={field} />
        <Button type="button" variant="outline" class="shrink-0" onclick={addGuest}>{$rt.add}</Button>
      </div>
      <Field.Description class="m-0 text-small leading-normal">{$rt.attendanceAutoHint}</Field.Description>
    </Field.Set>
  </ScrollArea>
  <Field.Set class="min-h-0 min-w-0 gap-3 overflow-hidden compact:shrink-0 compact:overflow-visible" aria-label={$rt.songSelectionTitle} disabled={$disabled}>
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <Field.Legend class="m-0 text-base font-bold">{$rt.songSelectionTitle}</Field.Legend>
      <Tabs.Root value={tabValue} onValueChange={value => patch({ source: value as 'setlist' | 'catalog' | 'selected' })}>
        <Tabs.List>
          {#if setlist}<Tabs.Trigger value="setlist" class="px-3">{$rt.fromSetlist}</Tabs.Trigger>{/if}
          <Tabs.Trigger value="catalog" class="px-3">{$rt.catalog}</Tabs.Trigger>
          <Tabs.Trigger value="selected" class="w-36 flex-none px-3 tabular-nums">{$selected.length} {$rt.selected}</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </div>
    <ButtonRow class="shrink-0">
      <Input value={$search} oninput={e => patch({ search: e.currentTarget.value })} placeholder={$rt.search} aria-label={$rt.search} class="{field} min-w-0 flex-1" />
      <Button type="button" variant="outline" class="shrink-0" onclick={chooseNotReady}>{$rt.notReady}</Button>
    </ButtonRow>
    <ScrollArea class="min-h-0 flex-1 compact:flex-none compact:[&>[data-slot=scroll-area-viewport]]:max-h-[50dvh] compact:[&>[data-slot=scroll-area-viewport]]:min-h-37.5">
      <DataTableView
        {table}
        headClass="not-last:border-r-0"
        cellClass="min-w-0 wrap-anywhere not-last:border-r-0"
        rowClass={() => 'cursor-pointer data-[state=selected]:bg-table-selected-bg data-[state=selected]:hover:bg-[color-mix(in_srgb,var(--table-selected-bg),var(--text)_5%)]'}
        rowProps={row => ({
          'data-state': row.getIsSelected() ? 'selected' : undefined,
          onclick: (e: MouseEvent) => { if (!(e.target as Element).closest('[role=checkbox]')) row.toggleSelected(); },
        })}
        emptyText={$rt.noMatches}
      />
    </ScrollArea>
  </Field.Set>
</section>

{#snippet selectAll()}
  <Checkbox checked={table.getIsAllRowsSelected()} indeterminate={table.getIsSomeRowsSelected()} onCheckedChange={v => table.toggleAllRowsSelected(!!v)} aria-label={$rt.allSongs} title={$rt.allSongs} />
{/snippet}
{#snippet selectCell(item: Row)}
  <Checkbox checked={isSelected(item)} onCheckedChange={() => toggle(item)} aria-label={`${item.song.artist} – ${item.song.title}`} />
{/snippet}
{#snippet songCell(item: Row)}
  {@const coverage = rehearsalCoverage(item.song, $attendees)}
  <RehearsalSongName artist={item.song.artist} title={item.song.title} dimmed={!coverage.complete} />
  <!-- Who will not come: always the second line (every size). -->
  <div class={cn('mt-0.5 text-tiny leading-tight', coverage.complete ? 'text-foreground/75' : 'text-foreground/65')}>{coverage.complete ? $rt.available : coverage.needed.length ? `${$rt.missing}: ${coverage.missing.join(', ')}` : $rt.unassigned}</div>
{/snippet}
{#snippet readinessCell(item: Row)}
  <RehearsalReadiness value={rehearsalReadiness(item.song)} label={$rt.fullReadiness} />
{/snippet}
