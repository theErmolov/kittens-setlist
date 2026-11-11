<script lang="ts">
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { lang, t } from '$lib/i18n';
  import { currentUser, authLoading } from '$lib/auth';
  import { createQuery } from '@tanstack/svelte-query';
  import { budgetQuery, setlistsQuery } from '$lib/query/queries';
  import { useBudgetMutations } from '$lib/query/shell';
  import { useStore } from '$lib/store/bridge';
  import { budgetStore } from '$lib/store/shell';
  import { budgetTotals, buildBudgetReport, formatEUR } from '$lib/utils';
  import type { BudgetEntry } from '$lib/types';
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import { Card } from '$components/ui/card';
  import * as Table from '$components/ui/table';
  import { getCoreRowModel, getSortedRowModel, type ColumnDef } from '@tanstack/table-core';
  import { createSvelteTable, FlexRender, renderSnippet } from '$components/ui/data-table';
  import * as Empty from '$components/ui/empty';
  import RowActions, { type RowAction } from '$components/shared/RowActions.svelte';
  import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
  import BudgetEntryModal from '$components/budget/BudgetEntryModal.svelte';

  const isAdminUser = $derived(!$authLoading && $currentUser?.isAdmin === true);
  const budget = createQuery(() => ({ ...budgetQuery(), enabled: isAdminUser }));
  const setlistsResult = createQuery(() => ({ ...setlistsQuery(), enabled: isAdminUser }));
  const mutations = useBudgetMutations();

  const modalKind = useStore(budgetStore, s => s.modalKind);
  const reportText = useStore(budgetStore, s => s.reportText);
  const copied = useStore(budgetStore, s => s.copied);
  const deleteTarget = useStore(budgetStore, s => s.deleteTargetId);
  const sorting = useStore(budgetStore, s => s.sorting);
  const bs = budgetStore.getState;

  const entries = $derived(budget.data ?? []);
  const setlists = $derived(setlistsResult.data ?? []);
  const loading = $derived(budget.isPending || setlistsResult.isPending);

  const totals = $derived(budgetTotals(entries));

  // Admin-only guard (mirrors the admin page)
  $effect(() => {
    if ($authLoading) return;
    if (!$currentUser?.isAdmin) goto(`${base}/backlog`);
  });

  const kindColor = { income: 'bg-success text-success-ink', expense: 'bg-danger text-danger-ink', debt: 'bg-warning text-warning-ink' } as const;

  const setlistName = (id?: string) => setlists.find(s => s.id === id)?.name;

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat($lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  // Data Table: default sort is date descending; sorting state lives in budgetStore.
  const who = (e: BudgetEntry) => e.kind === 'income' ? e.person || '—' : e.kind === 'expense' ? e.spentBy || '—' : e.creditor || '—';
  const columns = $derived<ColumnDef<BudgetEntry>[]>([
    { id: 'date', accessorFn: e => e.date, header: $t.budget.date, meta: { cellClass: 'whitespace-nowrap max-mid:basis-full' }, cell: ({ row }) => renderSnippet(dateCell, row.original) },
    { id: 'kind', accessorFn: e => e.kind, header: $t.budget.cols.kind, enableSorting: false, cell: ({ row }) => renderSnippet(kindCell, row.original) },
    { id: 'who', accessorFn: who, header: $t.budget.cols.who, enableSorting: false, cell: ({ row }) => renderSnippet(whoCell, row.original) },
    { id: 'what', accessorFn: e => (e.kind === 'expense' ? e.description : '') ?? '', header: $t.budget.cols.what, enableSorting: false, meta: { cellClass: 'whitespace-normal max-mid:basis-full' }, cell: ({ row }) => renderSnippet(whatCell, row.original) },
    { id: 'method', accessorFn: e => (e.kind === 'debt' ? '' : e.method), header: $t.budget.method, enableSorting: false, cell: ({ row }) => renderSnippet(methodCell, row.original) },
    { id: 'amount', accessorFn: e => e.amount, header: $t.budget.amount, meta: { cellClass: 'text-right' }, cell: ({ row }) => renderSnippet(amountCell, row.original) },
    { id: 'paid', accessorFn: e => (e.kind === 'debt' ? e.paid : false) ?? false, header: $t.budget.cols.paid, enableSorting: false, cell: ({ row }) => renderSnippet(paidCell, row.original) },
    { id: 'actions', header: '', enableSorting: false, meta: { cellClass: 'w-16 max-mid:ml-auto' }, cell: ({ row }) => renderSnippet(actionsCell, row.original) },
  ]);
  const table = createSvelteTable<BudgetEntry>({
    get data() { return entries; },
    get columns() { return columns; },
    getRowId: e => e.id,
    state: { get sorting() { return $sorting; } },
    onSortingChange: updater => bs().setSorting(updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function rowActions(e: BudgetEntry): RowAction[] {
    const out: RowAction[] = [];
    if (e.kind === 'expense' && e.receiptKey) out.push({ icon: '🧾', label: $t.budget.viewReceipt.replace('🧾', '').trim(), onselect: () => openReceipt(e) });
    if (e.kind === 'debt') out.push({ icon: e.paid ? '❌' : '✅', label: $t.budget.markPaid, onselect: () => void togglePaid(e) });
    out.push({ icon: '✏️', label: $t.budget.edit, onselect: () => bs().openEdit(e) });
    out.push({ icon: '🗑️', label: $t.budget.delete, destructive: true, separatorBefore: true, onselect: () => bs().setDeleteTarget(e.id) });
    return out;
  }

  async function handleDelete() {
    const target = bs().deleteTargetId;
    bs().setDeleteTarget(null);
    if (target) await mutations.remove.mutateAsync(target);
  }

  async function togglePaid(e: BudgetEntry) {
    if (e.kind !== 'debt') return;
    await mutations.update.mutateAsync({
      ...e,
      paid: !e.paid,
      ...(e.paid ? {} : { paidAt: new Date().toISOString() }),
    });
  }

  function openReceipt(e: BudgetEntry) {
    mutations.openReceipt.mutate(e.id);
  }

  function generateReport() {
    bs().setReport(buildBudgetReport(entries, setlists, Date.now(), $lang));
  }

  async function copyReport() {
    await navigator.clipboard.writeText($reportText);
    bs().setCopied(true);
    setTimeout(() => { bs().setCopied(false); }, 1500);
  }
</script>

{#snippet stat(label: string, value: string, accent = false, neg = false)}
  <Card class="card min-w-0 flex-[1_1_110px] gap-1 rounded-[10px] p-3 {accent ? 'accent border-primary bg-(--secondary-soft)' : ''}">
    <span class="card-lbl text-[0.78rem] text-muted-foreground">{label}</span>
    <span class="card-val text-[1.1rem] font-bold {neg ? 'neg text-danger-ink' : ''}">{value}</span>
  </Card>
{/snippet}

{#if $currentUser?.isAdmin}
<div>
  {#if loading}
    <LoadingCat />
  {:else}
    <!-- Dashboard: Наличка + Переводы = На руках − Долги = Баланс -->
    <div class="dash mb-5 flex flex-wrap items-center gap-2">
      {@render stat($t.budget.dash.cash, formatEUR(totals.cash, $lang))}
      <span class="op shrink-0 text-[1.2rem] font-bold text-muted-foreground">+</span>
      {@render stat($t.budget.dash.transfer, formatEUR(totals.transfer, $lang))}
      <span class="op shrink-0 text-[1.2rem] font-bold text-muted-foreground">=</span>
      {@render stat($t.budget.dash.onHand, formatEUR(totals.onHand, $lang), true)}
      <span class="op shrink-0 text-[1.2rem] font-bold text-muted-foreground">−</span>
      {@render stat($t.budget.dash.debts, formatEUR(totals.debts, $lang), false, true)}
      <span class="op shrink-0 text-[1.2rem] font-bold text-muted-foreground">=</span>
      {@render stat($t.budget.dash.balance, formatEUR(totals.balance, $lang), true, totals.balance < 0)}
    </div>

    <!-- Add buttons -->
    <div class="toolbar mb-3.5 flex flex-wrap items-center gap-2">
      <Button variant="outline" class="btn-add income flex-auto border-l-4 border-l-success-ink px-3.5 text-[0.88rem] font-semibold" onclick={() => bs().openAdd('income')}>{$t.budget.addIncome}</Button>
      <Button variant="outline" class="btn-add expense flex-auto border-l-4 border-l-danger-ink px-3.5 text-[0.88rem] font-semibold" onclick={() => bs().openAdd('expense')}>{$t.budget.addExpense}</Button>
      <Button variant="outline" class="btn-add debt flex-auto border-l-4 border-l-warning-ink px-3.5 text-[0.88rem] font-semibold" onclick={() => bs().openAdd('debt')}>{$t.budget.addDebt}</Button>
    </div>

    <!-- Entries -->
    {#if entries.length === 0}
      <Empty.Root class="empty mb-7 border">
        <Empty.Header><Empty.Description>{$t.budget.empty}</Empty.Description></Empty.Header>
      </Empty.Root>
    {:else}
      <div class="mb-7">
        <Table.Root class="rows max-mid:[&_tbody]:grid max-mid:[&_tbody]:gap-[3px] max-mid:[&_thead]:hidden">
          <Table.Header>
            {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
              <Table.Row>
                {#each headerGroup.headers as header (header.id)}
                  <Table.Head aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : undefined}>
                    {#if header.column.getCanSort()}
                      <button type="button" class="inline-flex cursor-pointer items-center gap-1 font-[inherit] uppercase tracking-[inherit] hover:text-foreground" onclick={header.column.getToggleSortingHandler()}>
                        <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
                        <span aria-hidden="true">{header.column.getIsSorted() === 'asc' ? '↑' : header.column.getIsSorted() === 'desc' ? '↓' : ''}</span>
                      </button>
                    {:else}
                      <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
                    {/if}
                  </Table.Head>
                {/each}
              </Table.Row>
            {/each}
          </Table.Header>
          <Table.Body>
            {#each table.getRowModel().rows as row (row.id)}
              {@const e = row.original}
              <Table.Row class="row max-mid:flex max-mid:flex-wrap max-mid:items-center max-mid:gap-x-3 max-mid:px-3 max-mid:py-2 {e.kind === 'debt' && e.paid ? 'paid opacity-55' : ''}">
                {#each row.getVisibleCells() as cell (cell.id)}
                  <Table.Cell class="max-mid:not-last:border-r-0 max-mid:p-0 {(cell.column.columnDef.meta as { cellClass?: string } | undefined)?.cellClass ?? ''}">
                    <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                  </Table.Cell>
                {/each}
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    {/if}

    <!-- Report -->
    <div class="report border-t pt-4">
      <div class="report-head mb-3 flex items-center justify-between gap-2.5">
        <h2 class="text-[1.1rem]">{$t.budget.report}</h2>
        <Button variant="outline" class="px-[18px] text-[0.88rem]" onclick={generateReport}>{$t.budget.generateReport}</Button>
      </div>
      {#if $reportText}
        <Card class="mb-3 gap-0 rounded-[10px] p-3.5"><pre class="whitespace-pre-wrap font-[inherit] text-[0.9rem]">{$reportText}</pre></Card>
        <Button class="px-[18px] text-[0.88rem] font-semibold" onclick={copyReport}>{$copied ? $t.budget.copied : $t.budget.copy}</Button>
      {/if}
    </div>
  {/if}
</div>

{#if $modalKind}
  <BudgetEntryModal />
{/if}

<ConfirmDialog
  open={$deleteTarget !== null}
  description={$t.budget.deleteConfirm}
  confirmLabel={$t.budget.delete}
  onopenchange={open => { if (!open) bs().setDeleteTarget(null); }}
  onconfirm={handleDelete}
/>

{/if}

{#snippet dateCell(e: BudgetEntry)}{fmtDate(e.date)}{/snippet}
{#snippet kindCell(e: BudgetEntry)}
  <Badge class="badge {e.kind} {kindColor[e.kind]} h-auto rounded-md px-[7px] py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.03em]">{$t.budget.kind[e.kind]}</Badge>
{/snippet}
{#snippet whoCell(e: BudgetEntry)}<span class="row-who">{who(e)}</span>{/snippet}
{#snippet whatCell(e: BudgetEntry)}
  <span class="block">{e.kind === 'expense' ? e.description || '' : ''}</span>
  <span class="row-meta block text-[0.78rem] text-muted-foreground">
    {#if setlistName(e.setlistId)}{setlistName(e.setlistId)}{/if}{#if setlistName(e.setlistId) && e.comment} · {/if}{#if e.comment}{e.comment}{/if}
  </span>
{/snippet}
{#snippet methodCell(e: BudgetEntry)}
  {#if e.kind === 'income' || e.kind === 'expense'}
    <Badge variant="secondary" class="chip h-auto px-2 py-0.5 text-[0.72rem] font-normal text-muted-foreground">{e.method === 'cash' ? $t.budget.methodCash : $t.budget.methodTransfer}</Badge>
  {/if}
{/snippet}
{#snippet amountCell(e: BudgetEntry)}
  <span class="row-amount text-base font-bold {e.kind === 'income' ? 'pos text-success-ink' : e.kind === 'expense' ? 'neg text-danger-ink' : 'debt text-warning-ink'}">
    {e.kind === 'income' ? '+' : e.kind === 'expense' ? '−' : ''}{formatEUR(e.amount, $lang)}
  </span>
{/snippet}
{#snippet paidCell(e: BudgetEntry)}
  {#if e.kind === 'debt' && e.paid}
    <Badge variant="secondary" class="bg-success text-success-ink">{$t.budget.paid}</Badge>
  {/if}
{/snippet}
{#snippet actionsCell(e: BudgetEntry)}
  <RowActions actions={rowActions(e)} />
{/snippet}
