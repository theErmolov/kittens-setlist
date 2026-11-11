<script lang="ts">
  import VibeBadge from '$components/shared/VibeBadge.svelte';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import RowActions from '$components/shared/RowActions.svelte';
  import IconButton from '$components/shared/IconButton.svelte';
  import { Badge } from '$components/ui/badge';
  import * as Table from '$components/ui/table';
  import * as Tooltip from '$components/ui/tooltip';
  import * as Item from '$components/ui/item';
  import { songTableWrap } from '../classes';
  import { cn, formatDuration } from '$lib/utils';
  import { createSvelteTable } from '$components/ui/data-table';
  import { getCoreRowModel } from '@tanstack/table-core';
  import SongTableHead from '../SongTableHead.svelte';
  import { songColumns, songVisibility, hasGuests, type SongTableRow } from '../songColumns';
  import LinkifiedText from '$components/shared/LinkifiedText.svelte';
  import Note from '$components/shared/Note.svelte';
  import SongEntryRow from '../SongEntryRow.svelte';
  import { below } from '$lib/breakpoints';
  import CommentInput from '../CommentInput.svelte';
  import { onDestroy, onMount } from 'svelte';
  import type { SetlistEntry, SetlistSubset } from '$lib/types';
  import { t, lang } from '$lib/i18n';
  import { currentUser, canWrite } from '$lib/auth';
  import { addMinutes } from '$lib/utils';
  import { buildSetlistLayout } from '$lib/setlistLayout';
  import { useStore } from '$lib/store/bridge';
  import {
    setlistEditorStore, entryKey, entryStage, entryProgressPct, subsetEntryCount, subsetPosition, subsetTotal,
  } from '$lib/store/setlistEditor';
  import { useRemoveSong, useRemoveBreak, useUpdateBreak, useUpdateEntryComment } from '$lib/query/setlistMutations';
  import { useEditorData } from './editorData.svelte';
  import { useStore as useZustand } from '$lib/store/bridge';
  import { dragModeStore } from '$lib/store/drag';
  import { notePopoverStore } from '$lib/store/notePopover';
  import PersonalNotePopover from '$components/shared/PersonalNotePopover.svelte';
  const dragEnabled = useZustand(dragModeStore, s => s.enabled);

  const data = useEditorData();
  const actions = setlistEditorStore.getState();
  const st = () => setlistEditorStore.getState();
  const sel = <T,>(f: (s: ReturnType<typeof st>) => T) => useStore(setlistEditorStore, f);
  const activeSubsetId = sel(s => s.activeSubsetId);
  const draftSubsetName = sel(s => s.draftSubsetName);
  const draggedEntryKey = sel(s => s.draggedEntryKey);
  const overEntryKey = sel(s => s.overEntryKey);
  const draggedSubsetId = sel(s => s.draggedSubsetId);
  const overSubsetId = sel(s => s.overSubsetId);
  const editingBreakOrder = sel(s => s.editingBreakOrder);

  const removeSong = useRemoveSong();
  const removeBreak = useRemoveBreak();
  const updateBreak = useUpdateBreak();
  const updateEntryComment = useUpdateEntryComment();
  const setlistId = () => st().setlistId!;

  // DOM-only drag helpers (auto-scroll frame, touch preview); drag *state* lives in the store.
  let tableWrapEl: HTMLDivElement | null = null;
  let autoScrollFrame: number | null = null;
  let autoScrollSpeed = 0;
  let lastDragClientX = 0;
  let lastDragClientY = 0;
  let cancelTouchReorder: (() => void) | null = null;
  const AUTO_SCROLL_EDGE = 80;
  const AUTO_SCROLL_MAX_SPEED = 22;

  const isDragging = $derived($draggedEntryKey !== null || $draggedSubsetId !== null);
  $effect(() => { if (!isDragging) stopDragAutoScroll(); });
  onDestroy(() => { cancelTouchReorder?.(); stopDragAutoScroll(); });

  const entriesInSubset = (subsetId: string) => subsetEntryCount(data.entries, subsetId);
  const subsetPos = (subsetId: string) => subsetPosition(data.entries, data.subsets, subsetId);
  const subsetCount = () => subsetTotal(data.entries, data.subsets);

  function handleSubsetHeaderClick(subset: SetlistSubset) {
    if ($activeSubsetId !== subset.id && below('mid').matches) actions.openSubsetEdit(subset);
  }

  function handleRowClick(e: MouseEvent, entry: SetlistEntry) {
    if (!$canWrite || $activeSubsetId === null || !entry.songId) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, button, a')) return;
    actions.toggleSubsetMembership(entry, $canWrite);
  }

  type RenderItem =
    | { kind: 'header'; subset: SetlistSubset }
    | { kind: 'hint'; subset: SetlistSubset }
    | { kind: 'divider' }
    | { kind: 'entry'; entry: SetlistEntry };

  const renderItems = $derived.by((): RenderItem[] => {
    if (data.isFiltered) {
      return data.displayEntries.map(entry => ({ kind: 'entry' as const, entry }));
    }
    const items: RenderItem[] = [];
    let restDividerAdded = false;
    for (const layoutItem of buildSetlistLayout(data.entries, data.subsets)) {
      if (layoutItem.kind === 'subset') {
        items.push({ kind: 'header', subset: layoutItem.subset });
        if ($canWrite && $activeSubsetId === layoutItem.subset.id) items.push({ kind: 'hint', subset: layoutItem.subset });
        for (const entry of layoutItem.entries) items.push({ kind: 'entry', entry });
      } else {
        if (layoutItem.entry.songId && data.subsets.length > 0 && !restDividerAdded) {
          items.push({ kind: 'divider' });
          restDividerAdded = true;
        }
        items.push({ kind: 'entry', entry: layoutItem.entry });
      }
    }
    return items;
  });

  function renderItemKey(item: RenderItem): string {
    if (item.kind === 'entry') return entryKey(item.entry);
    if (item.kind === 'divider') return 'divider';
    return `${item.kind}-${item.subset.id}`;
  }

  // Per-entry start times, keyed by entryKey. Only computed when startTime is set.
  const entryTimes = $derived.by((): Map<string, string> => {
    if (!data.meta.startTime) return new Map();
    const map = new Map<string, string>();
    let offset = 0;
    for (const entry of data.sortedEntries) {
      map.set(entryKey(entry), addMinutes(data.meta.startTime, offset));
      offset += entry.breakMinutes ?? (entry.song?.lengthMinutes ?? 5);
    }
    return map;
  });


  // ── Data Table: shared song columns, rows are view-models (song / subset header / hint / divider / break) ──
  const columnVisibility = sel(s => s.columnVisibility);
  const maxIcons = $derived(Object.fromEntries(data.allMusicians.map(n => [n, Math.max(1, ...data.entries.map(e => e.song?.musicians[n]?.instruments.length ?? 0))])));
  const columns = $derived(songColumns(data.allMusicians, { num: numHeader, song: songHeader, guests: $t.editor.guestsColumn, time: $t.editor.timeColumn }, maxIcons));
  const tableRows = $derived(renderItems.map((item): SongTableRow<RenderItem> => ({
    id: renderItemKey(item),
    kind: item.kind === 'entry' ? (item.entry.songId ? 'song' : 'break') : item.kind,
    item,
  })));
  $effect.pre(() => {
    const next = songVisibility(data.allMusicians, data.columnMusicians, !!data.meta.startTime, $canWrite && ($dragEnabled || $activeSubsetId !== null), hasGuests(data.displayEntries.flatMap(e => e.song ? [e.song] : []), data.allMusicians));
    if (JSON.stringify(next) !== JSON.stringify(st().columnVisibility)) actions.patch({ columnVisibility: next });
  });
  const table = createSvelteTable<SongTableRow<RenderItem>>({
    get data() { return tableRows; },
    get columns() { return columns as never; },
    state: { get columnVisibility() { return $columnVisibility; } },
    onColumnVisibilityChange: (u) => actions.patch({ columnVisibility: typeof u === 'function' ? u(st().columnVisibility) : u }),
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  // Columns actually rendered (visibility state minus what CSS hides at this width): what full-width rows must span.
  const tier = sel(s => s.tier);
  $effect(() => {
    const mobile = below('mid'), mid = mobile;
    const update = () => actions.patch({ tier: mobile.matches ? 'mobile' : mid.matches ? 'mid' : 'wide' });
    update();
    mobile.addEventListener('change', update); mid.addEventListener('change', update);
    return () => { mobile.removeEventListener('change', update); mid.removeEventListener('change', update); };
  });
  const shownCols = $derived(table.getVisibleLeafColumns().filter(c =>
    !(($tier !== 'wide' && c.id === 'time') || ($tier === 'mobile' && (c.id === 'guests' || c.id.startsWith('m:'))))).map(c => c.id));
  const totalCols = $derived(shownCols.length);
  const dragCol = $derived(shownCols.includes('drag')), timeCol = $derived(shownCols.includes('time'));

  async function saveEntryComment(order: number, comment: string) {
    await updateEntryComment.mutateAsync({ setlistId: setlistId(), order, comment });
  }

  async function handleRemove(songId: string) {
    await removeSong.mutateAsync({ setlistId: setlistId(), songId });
  }

  // While editing a subset, ✕ on one of its members removes it from the subset
  // instead of deleting it from the setlist entirely.
  async function handleRemoveClick(entry: SetlistEntry) {
    if ($activeSubsetId !== null && entry.subsetId === $activeSubsetId) {
      await actions.toggleSubsetMembership(entry, $canWrite);
      return;
    }
    await handleRemove(entry.songId!);
  }

  async function handleRemoveBreak(order: number) {
    await removeBreak.mutateAsync({ setlistId: setlistId(), order });
  }

  async function handleUpdateBreak(order: number, minutes: number) {
    await updateBreak.mutateAsync({ setlistId: setlistId(), order, minutes });
    actions.patch({ editingBreakOrder: null });
  }

  function updateDropTargetAtPoint(clientX: number, clientY: number) {
    const el = document.elementFromPoint(clientX, clientY);
    if (st().draggedSubsetId !== null) {
      const blockRow = el?.closest('[data-subset-block-id]') as HTMLElement | null;
      if (blockRow) {
        actions.setOverSubset(blockRow.dataset.subsetBlockId ?? null);
        return;
      }

      const headers = tableWrapEl
        ? [...tableWrapEl.querySelectorAll<HTMLElement>('[data-subset-header][data-subset-block-id]')]
        : [];
      const nearest = headers.reduce<HTMLElement | null>((best, header) => {
        if (!best) return header;
        const headerDistance = Math.abs(header.getBoundingClientRect().top - clientY);
        const bestDistance = Math.abs(best.getBoundingClientRect().top - clientY);
        return headerDistance < bestDistance ? header : best;
      }, null);
      actions.setOverSubset(nearest?.dataset.subsetBlockId ?? null);
      return;
    }

    const row = el?.closest('[data-row-key]') as HTMLElement | null;
    if (row) {
      const rect = row.getBoundingClientRect();
      actions.setOverEntry(row.dataset.rowKey ?? null, clientY < rect.top + rect.height / 2 ? 'before' : 'after');
      actions.setOverSubset(null);
      return;
    }

    const header = el?.closest('[data-subset-header][data-subset-block-id]') as HTMLElement | null;
    if (header) {
      const rect = header.getBoundingClientRect();
      actions.setOverEntry(null);
      actions.setOverSubset(header.dataset.subsetBlockId ?? null, clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    }
  }

  function stopDragAutoScroll() {
    autoScrollSpeed = 0;
    if (autoScrollFrame !== null) {
      cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = null;
    }
  }

  function autoScrollTick() {
    autoScrollFrame = null;
    if (!tableWrapEl || autoScrollSpeed === 0 || !isDragging) return;
    const before = tableWrapEl.scrollTop;
    tableWrapEl.scrollTop += autoScrollSpeed;
    updateDropTargetAtPoint(lastDragClientX, lastDragClientY);
    if (tableWrapEl.scrollTop === before) {
      autoScrollSpeed = 0;
      return;
    }
    autoScrollFrame = requestAnimationFrame(autoScrollTick);
  }

  function updateDragAutoScroll(clientX: number, clientY: number) {
    lastDragClientX = clientX;
    lastDragClientY = clientY;
    if (!tableWrapEl || !isDragging) {
      stopDragAutoScroll();
      return;
    }

    const rect = tableWrapEl.getBoundingClientRect();
    const edge = Math.min(AUTO_SCROLL_EDGE, rect.height / 3);
    let speed = 0;
    if (clientY < rect.top + edge) {
      const strength = Math.min(1, Math.max(0, (rect.top + edge - clientY) / edge));
      speed = -Math.ceil(AUTO_SCROLL_MAX_SPEED * strength);
    } else if (clientY > rect.bottom - edge) {
      const strength = Math.min(1, Math.max(0, (clientY - (rect.bottom - edge)) / edge));
      speed = Math.ceil(AUTO_SCROLL_MAX_SPEED * strength);
    }

    autoScrollSpeed = speed;
    if (speed === 0) {
      stopDragAutoScroll();
    } else if (autoScrollFrame === null) {
      autoScrollFrame = requestAnimationFrame(autoScrollTick);
    }
  }

  function onEntryDragOver(e: DragEvent, key: string) {
    e.preventDefault();
    if (st().draggedSubsetId !== null) {
      updateDropTargetAtPoint(e.clientX, e.clientY);
      updateDragAutoScroll(e.clientX, e.clientY);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    actions.setOverEntry(key, e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    updateDragAutoScroll(e.clientX, e.clientY);
  }

  function onSubsetDragStart(e: DragEvent, subsetId: string) {
    if (!$canWrite || data.isFiltered || below('mid').matches) {
      e.preventDefault();
      return;
    }
    actions.startSubsetDrag(subsetId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', subsetId);
      const subset = data.subsets.find(candidate => candidate.id === subsetId);
      const preview = document.createElement('div');
      preview.textContent = `⏭ ${subset?.name ?? ''} · ${$t.editor.subsetSongs(entriesInSubset(subsetId))}`;
      Object.assign(preview.style, {
        position: 'fixed',
        left: '-10000px',
        top: '-10000px',
        padding: '10px 14px',
        borderRadius: '8px',
        background: 'var(--t-accent-bg)',
        color: 'var(--t-accent-ink)',
        border: '2px solid var(--t-accent-ink)',
        font: '600 14px system-ui, sans-serif',
        whiteSpace: 'nowrap',
      });
      document.body.appendChild(preview);
      e.dataTransfer.setDragImage(preview, 24, 20);
      requestAnimationFrame(() => preview.remove());
    }
  }

  function onSubsetDragOver(e: DragEvent, subsetId: string) {
    if (!st().draggedSubsetId && !st().draggedEntryKey) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    actions.setOverSubset(subsetId, e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    updateDragAutoScroll(e.clientX, e.clientY);
  }

  // Touch reordering uses pointer capture so the gesture stays attached to the
  // handle, while the finger follows a full-width copy of the original row.
  function startTouchReorder(event: PointerEvent, key: string) {
    if (event.pointerType !== 'touch' || !$canWrite || data.isFiltered) return;
    const handle = event.currentTarget as HTMLElement;
    const foundSource = handle.closest<HTMLTableRowElement>('[data-row-key]');
    if (!foundSource) return;
    const source: HTMLTableRowElement = foundSource;
    const foundTable = source.closest('table');
    if (!foundTable) return;
    const sourceTable: HTMLTableElement = foundTable;
    cancelTouchReorder?.();

    const rowRect = source.getBoundingClientRect();
    const grabX = event.clientX - rowRect.left;
    const grabY = event.clientY - rowRect.top;
    const startX = event.clientX;
    const startY = event.clientY;
    let x = startX;
    let y = startY;
    let moved = false;
    let preview: HTMLElement | null = null;

    handle.setPointerCapture(event.pointerId);

    function positionPreview() {
      if (!preview) return;
      preview.style.left = `${Math.max(4, Math.min(x - grabX, window.innerWidth - rowRect.width - 4))}px`;
      preview.style.top = `${Math.max(4, y - grabY)}px`;
    }

    function showPreview() {
      const clone = source.cloneNode(true) as HTMLTableRowElement;
      clone.classList.remove('dragging', 'drag-over', 'subset-block-dragging', 'subset-block-over');
      clone.removeAttribute('data-row-key');
      clone.setAttribute('aria-hidden', 'true');
      clone.inert = true;
      clone.style.opacity = '1';

      const table = sourceTable.cloneNode(false) as HTMLTableElement;
      const tableStyle = getComputedStyle(sourceTable);
      // Cell styles are Tailwind classes on the cloned cells themselves, so a plain wrapper is enough.
      const wrapper = document.createElement('div');
      Object.assign(wrapper.style, { position: 'fixed', left: '0', top: '0', zIndex: '200', pointerEvents: 'none' });
      Object.assign(table.style, {
        margin: '0',
        width: `${rowRect.width}px`, minWidth: `${rowRect.width}px`, maxWidth: `${rowRect.width}px`,
        tableLayout: 'fixed', borderCollapse: tableStyle.borderCollapse,
        borderSpacing: tableStyle.borderSpacing, pointerEvents: 'none',
        opacity: '1', boxShadow: '0 8px 24px color-mix(in srgb, black 30%, transparent)',
      });
      const body = document.createElement('tbody');
      const cells = [...source.cells];
      [...clone.cells].forEach((cell, index) => {
        const width = cells[index]?.getBoundingClientRect().width ?? 0;
        if (width > 0) Object.assign(cell.style, { boxSizing: 'border-box', width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` });
      });
      body.append(clone);
      table.append(body);
      wrapper.append(table);
      document.body.append(wrapper);
      preview = wrapper;
      positionPreview();
    }

    function move(e: PointerEvent) {
      x = e.clientX;
      y = e.clientY;
      if (!moved && Math.hypot(x - startX, y - startY) > 5) {
        moved = true;
        showPreview();
        actions.startEntryDrag(key);
      }
      if (!moved) return;
      positionPreview();
      updateDropTargetAtPoint(x, y);
      updateDragAutoScroll(x, y);
    }

    function cleanup(clearDrag: boolean) {
      preview?.remove();
      preview = null;
      stopDragAutoScroll();
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', cancel);
      handle.removeEventListener('lostpointercapture', cancel);
      document.removeEventListener('keydown', keydown);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      cancelTouchReorder = null;
      if (clearDrag) actions.clearEntryDrag();
    }

    function finish(e: PointerEvent) {
      if (!moved) { cleanup(false); return; }
      x = e.clientX;
      y = e.clientY;
      updateDropTargetAtPoint(x, y);
      const targetSubset = st().overSubsetId;
      cleanup(false);
      if (targetSubset) void actions.dropEntryOnSubset(targetSubset);
      else void actions.dropEntry();
    }

    function cancel() { cleanup(true); }
    function keydown(e: KeyboardEvent) { if (e.key === 'Escape') cancel(); }

    cancelTouchReorder = cancel;
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', cancel);
    handle.addEventListener('lostpointercapture', cancel);
    document.addEventListener('keydown', keydown);
  }
</script>

{#snippet numHeader()}
  <span class="flex items-center justify-start gap-1.5">#
    <VibeBadge vibe={data.meta.vibe} class="h-4 px-1.5 py-0 text-[0.65rem]" />
  </span>
{/snippet}

{#snippet songHeader()}
  <span class="flex min-w-0 items-baseline gap-x-3 tracking-normal normal-case">
    <span class="shrink-0">{$t.editor.songs(data.songCount)} ({formatDuration(data.totalMinutes, $lang)})</span>
    {#if data.songCount > 0}<span class="shrink-0 text-success-ink">{$t.progress.readyCount(data.readyCount, data.songCount)}</span>{/if}
  </span>
{/snippet}


    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class={songTableWrap}
      bind:this={tableWrapEl}
      ondragover={(e) => {
        if ($draggedEntryKey !== null || $draggedSubsetId !== null) {
          e.preventDefault();
          updateDragAutoScroll(e.clientX, e.clientY);
        }
      }}
      ondragleave={(e) => {
        if (!tableWrapEl?.contains(e.relatedTarget as Node | null)) stopDragAutoScroll();
      }}
    >
      <Table.Root>
        <SongTableHead {table} />
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <Table.Body
          class="[&_tr:last-child]:border-0"
          ondragover={(e) => {
            if ($draggedEntryKey !== null || $draggedSubsetId !== null) {
              e.preventDefault();
              updateDropTargetAtPoint(e.clientX, e.clientY);
              updateDragAutoScroll(e.clientX, e.clientY);
            }
          }}
          ondrop={(e) => { e.preventDefault(); void actions.dropAtCurrentTarget(); }}
        >
          {#each table.getRowModel().rows as row (row.id)}
            {@const item = row.original.item}
            {#if item.kind === 'header'}
              {@const active = $activeSubsetId === item.subset.id}
              {@const canDragHeader = $canWrite && !data.isFiltered && $dragEnabled && !active}
              <Table.Row
                class="group/sh border-0 select-none hover:bg-transparent [&[draggable=true]]:cursor-grab max-mid:cursor-pointer"
                draggable={canDragHeader}
                data-subset-header
                data-subset-block-id={item.subset.id}
                data-active={active}
                onclick={$canWrite ? () => handleSubsetHeaderClick(item.subset) : undefined}
                ondragstart={(e) => onSubsetDragStart(e, item.subset.id)}
                ondragover={(e) => onSubsetDragOver(e, item.subset.id)}
                ondragend={() => actions.clearSubsetDrag()}
              >
                <Table.Cell
                  colspan={totalCols}
                  class={cn(
                    'w-full border-t border-border p-0',
                    active ? 'bg-[color-mix(in_srgb,var(--accent)_75%,var(--card))]' : 'bg-(--set-row) min-mid:group-hover/sh:bg-[color-mix(in_srgb,var(--set-row),var(--text)_6%)]',
                    $draggedSubsetId === item.subset.id && 'opacity-40',
                    $overSubsetId === item.subset.id && $draggedSubsetId !== item.subset.id && 'bg-muted ring-1 ring-inset ring-border',
                  )}
                >
                  <Item.Root class="min-h-10 flex-nowrap gap-2 rounded-none border-0 py-1 pr-2 pl-2.5 text-[0.86rem] max-mid:min-h-8 max-mid:flex-wrap max-mid:gap-x-2 max-mid:gap-y-0">
                    {#if $canWrite && $dragEnabled}<span class="text-base text-muted-foreground opacity-60 max-mid:hidden">⠿</span>{/if}
                    {#if $canWrite && active}
                      <Input
                        class="w-auto min-w-[180px] border-border bg-card font-bold aria-invalid:border-danger-solid max-mid:min-w-0 max-mid:flex-1"
                        value={$draftSubsetName}
                        oninput={(e) => actions.patch({ draftSubsetName: e.currentTarget.value })}
                        required
                        aria-label={$t.editor.subsetEdit}
                        aria-invalid={!$draftSubsetName.trim()}
                        onclick={(e) => e.stopPropagation()}
                        onkeydown={(e) => { if (e.key === 'Enter') actions.finishSubsetEdit(); }}
                      />
                    {:else}
                      <Item.Title class="text-[0.95rem] font-black text-foreground"><span class="no-tint" aria-hidden="true">⏭</span> {item.subset.name}</Item.Title>
                    {/if}
                    <Badge variant="secondary" class="bg-card/60 px-2 text-[0.8rem] font-normal text-foreground/80 max-mid:mr-auto">{$t.editor.subsetSongs(entriesInSubset(item.subset.id))}</Badge>
                    {#if $canWrite && !active}
                      <!-- Full height of the header bar (cancels its padding), square, no outline. -->
                      <Item.Actions class="-my-1 -mr-2 ml-auto self-stretch max-mid:hidden">
                        <RowActions class="h-auto min-h-10 w-10 self-stretch rounded-none" actions={[
                          { icon: '✏️', label: $t.editor.subsetEdit, onselect: () => actions.openSubsetEdit(item.subset) },
                          { icon: '🗑', label: $t.editor.subsetDissolve, destructive: true, separatorBefore: true, onselect: () => actions.dissolveSubset(item.subset.id) },
                        ]} />
                      </Item.Actions>
                    {/if}
                  </Item.Root>
                </Table.Cell>
              </Table.Row>
            {:else if item.kind === 'hint'}
              <Table.Row class="border-0 hover:bg-transparent">
                <Table.Cell colspan={totalCols} class="w-full bg-card p-0">
                  <Item.Root class="rounded-none border-0 px-2.5 py-2 text-[0.8rem] text-muted-foreground max-mid:flex-wrap">
                    <Item.Content class="max-mid:basis-full"><span class="whitespace-normal">{$t.editor.subsetHint}</span></Item.Content>
                    <Item.Actions class="hidden max-mid:flex">
                      <Button variant="outline" onclick={() => actions.moveSubsetBy(item.subset.id, -1)} disabled={subsetPos(item.subset.id) <= 0}>{$t.editor.subsetUp}</Button>
                      <Button variant="outline" onclick={() => actions.moveSubsetBy(item.subset.id, 1)} disabled={subsetPos(item.subset.id) >= subsetCount() - 1}>{$t.editor.subsetDown}</Button>
                    </Item.Actions>
                    <Item.Actions class="max-mid:ml-auto">
                      <Button variant="ghost" onclick={() => actions.dissolveSubset(item.subset.id)}>{$t.editor.subsetDissolve}</Button>
                      <Button onclick={() => actions.finishSubsetEdit()} disabled={!$draftSubsetName.trim()}>{$t.editor.subsetDone}</Button>
                    </Item.Actions>
                  </Item.Root>
                </Table.Cell>
              </Table.Row>
            {:else if item.kind === 'divider'}
              <Table.Row class="border-0 hover:bg-transparent">
                <Table.Cell colspan={totalCols} class="border-t px-2.5 py-1 text-[0.72rem] font-bold tracking-[0.05em] text-muted-foreground uppercase">{$t.editor.subsetRest}</Table.Cell>
              </Table.Row>
            {:else}
              {@const entry = item.entry}
              {@const key = entryKey(entry)}
              {@const entryIndex = data.displayEntries.findIndex(candidate => entryKey(candidate) === key)}
              {@const isDragging = $draggedEntryKey === key}
              {@const isOver = $overEntryKey === key && $draggedEntryKey !== key}
              {@const songNum = data.displayEntries.slice(0, entryIndex + 1).filter(e => e.songId).length}
              {@const canDrag = $canWrite && !data.isFiltered && $dragEnabled}
              {#if entry.songId}
                {@const song = entry.song}
                {#if song}
                  <SongEntryRow
                    {row}
                    {song}
                    number={songNum}
                    pct={entryProgressPct(entry)}
                    stageOf={(name) => entryStage(entry, name)}
                    personalNote={entry.personalComment}
                    onpersonal={(anchor) => notePopoverStore.getState().toggle(key, entry.personalComment ?? '', anchor)}
                    permanentNames={data.allMusicians}
                    time={data.meta.startTime ? (entryTimes.get(key) ?? '') : undefined}
                    rowClass={{
                      dragging: isDragging,
                      'drag-over': isOver,
                      'subset-member': !!entry.subsetId,
                      'subset-active-member': $activeSubsetId !== null && entry.subsetId === $activeSubsetId,
                      'subset-block-dragging': $draggedSubsetId !== null && entry.subsetId === $draggedSubsetId,
                      'subset-block-over': $draggedSubsetId !== null && $overSubsetId === entry.subsetId && $draggedSubsetId !== entry.subsetId,
                    }}
                    rowProps={{
                      draggable: canDrag,
                      'data-row-key': key,
                      'data-subset-block-id': entry.subsetId,
                      onclick: (e: MouseEvent) => handleRowClick(e, entry),
                      ondragstart: canDrag ? (ev: DragEvent) => { if ((ev.target as HTMLElement).closest('input,textarea')) { ev.preventDefault(); return; } actions.startEntryDrag(key); } : undefined,
                      ondragover: canDrag ? ((e: DragEvent) => onEntryDragOver(e, key)) : undefined,
                      ondragend: canDrag ? () => actions.clearEntryDrag() : undefined,
                    }}
                    dragCellProps={{ onpointerdown: $dragEnabled ? ((e: PointerEvent) => startTouchReorder(e, key)) : undefined }}
                    onlyrics={() => actions.patch({ lyricsViewEntryId: entry.songId ?? null })}
                    rowActions={[
                      ...($currentUser?.status === 'approved' ? [{ icon: $canWrite ? '✏️' : '🤫', label: $canWrite ? $t.editor.editEntry : $t.common.personalComment, onselect: () => actions.patch({ editingEntryId: entry.songId ?? null }) }] : []),
                      ...($canWrite ? [{ icon: '🗑', label: $activeSubsetId !== null && entry.subsetId === $activeSubsetId ? $t.editor.subsetRemove : $t.editor.remove, destructive: true, separatorBefore: true, onselect: () => handleRemoveClick(entry) }] : []),
                    ]}
                  >
                    {#snippet dragCell()}
                      {#if $canWrite}
                        {#if $activeSubsetId !== null}
                          <span class="block text-center text-base font-bold text-primary-ink">{entry.subsetId === $activeSubsetId ? '✓' : (entry.subsetId ? '' : '+')}</span>
                        {:else if $dragEnabled}
                          <span class="drag-handle block opacity-40 min-mid:group-hover/row:opacity-100">⠿</span>
                        {/if}
                      {/if}
                    {/snippet}
                    {#snippet comment()}
                      {#if $canWrite}
                        <CommentInput
                          value={entry.comment ?? ''}
                          onsave={(v) => saveEntryComment(entry.order, v)}
                        />
                      {:else if entry.comment}
                        <span class="block truncate text-[0.94rem] text-muted-foreground italic max-mid:whitespace-normal" title={entry.comment}><LinkifiedText text={entry.comment} /></span>
                      {/if}
                    {/snippet}
                  </SongEntryRow>
                {/if}
              {:else}
                {@const breakCell = cn(
                  'py-2 not-last:border-r-0 border-y border-dashed border-border bg-info first:border-l last:border-r last:pr-[7px] min-mid:group-hover/br:border-primary',
                  isDragging && 'opacity-35',
                  isOver && 'outline-2 -outline-offset-1 outline-dotted outline-primary',
                )}
                <Table.Row
                  class="break-row group/br cursor-default border-0 select-none hover:bg-transparent [&[draggable=true]]:cursor-grab"
                  draggable={canDrag}
                  data-row-key={key}
                  ondragstart={canDrag ? (() => actions.startEntryDrag(key)) : undefined}
                  ondragover={canDrag ? (e => onEntryDragOver(e, key)) : undefined}
                  ondragend={canDrag ? () => actions.clearEntryDrag() : undefined}
                >
                  {#if dragCol}<Table.Cell class={cn(breakCell, 'w-6 touch-none py-2 text-center text-base text-muted-foreground select-none')} onpointerdown={$dragEnabled ? (e => startTouchReorder(e, key)) : undefined}>{#if $canWrite && $dragEnabled}<span class="drag-handle block opacity-40 min-mid:group-hover/br:opacity-100">⠿</span>{/if}</Table.Cell>{/if}
                  <Table.Cell class={cn(breakCell, 'w-7 py-2')}></Table.Cell>
                  {#if timeCol}<Table.Cell class={cn(breakCell, 'w-[42px] py-2 text-right text-[0.72rem] text-muted-foreground')}>{entryTimes.get(entryKey(entry)) ?? ''}</Table.Cell>{/if}
                  <Table.Cell colspan={totalCols - 1 - (dragCol ? 1 : 0) - (timeCol ? 1 : 0)} class={cn(breakCell, 'py-0 pr-0 text-[0.82rem] whitespace-normal text-muted-foreground last:border-r-0 last:pr-0')}>
                    <Item.Root class="flex-nowrap items-stretch gap-1.5 border-0 p-0">
                      <Item.Media class="self-center leading-none">⏸</Item.Media>
                      <!-- Two lines: the break length, then its comment. -->
                      <Item.Content class="min-w-0 flex-col items-start gap-y-0 py-2">
                        {#if $canWrite && $editingBreakOrder === entry.order}
                          <div class="flex flex-wrap items-center gap-2">
                            {#each [5, 10, 20, 30] as min}
                              <Button
                                variant={entry.breakMinutes === min ? 'default' : 'outline'}
                                onclick={(e) => { e.stopPropagation(); handleUpdateBreak(entry.order, min); }}
                              >{$t.editor.minutes(min)}</Button>
                            {/each}
                            <Button variant="ghost" aria-label={$t.editor.cancel} onclick={(e) => { e.stopPropagation(); actions.patch({ editingBreakOrder: null }); }}>✕</Button>
                          </div>
                        {:else if $canWrite}
                          <Button variant="ghost" class="h-auto w-fit px-0 py-0 text-[0.82rem] font-normal text-muted-foreground italic hover:bg-transparent" onclick={(e) => { e.stopPropagation(); actions.patch({ editingBreakOrder: entry.order }); }}>{$t.editor.breakLabel(entry.breakMinutes!)}</Button>
                        {:else}
                          <span class="text-[0.82rem] text-muted-foreground italic">{$t.editor.breakLabel(entry.breakMinutes!)}</span>
                        {/if}
                        {#if $canWrite}
                          <CommentInput
                            value={entry.comment ?? ''}
                            onsave={(v) => saveEntryComment(entry.order, v)}
                            class="font-semibold text-foreground not-italic"
                          />
                        {:else}
                          <span class="block truncate text-[0.94rem] font-semibold text-foreground" title={entry.comment}><LinkifiedText text={entry.comment ?? ''} /></span>
                        {/if}
                      </Item.Content>
                      {#if $canWrite}
                        <!-- Full height of the break row, the same size and style as the ⋯ of the song rows. -->
                        <Item.Actions class="self-stretch">
                          <RowActions class="h-auto min-h-10 w-10 self-stretch rounded-none" actions={[
                            { icon: '✏️', label: $t.common.edit, onselect: () => actions.patch({ editingBreakOrder: entry.order }) },
                            { icon: '🗑', label: $t.editor.remove, destructive: true, separatorBefore: true, onselect: () => handleRemoveBreak(entry.order) },
                          ]} />
                        </Item.Actions>
                      {/if}
                    </Item.Root>
                  </Table.Cell>
                </Table.Row>
              {/if}
            {/if}
          {/each}
          {#if $draggedEntryKey !== null}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <Table.Row
              class="border-0 hover:bg-transparent max-mid:hidden"
              ondragover={e => { e.preventDefault(); actions.setOverEntry('end'); }}
            >
              <Table.Cell colspan={totalCols} class={cn('h-10 bg-card', $overEntryKey === 'end' && 'outline-2 outline-dashed outline-primary')}></Table.Cell>
            </Table.Row>
          {/if}
        </Table.Body>
      </Table.Root>
    </div>

<PersonalNotePopover />
