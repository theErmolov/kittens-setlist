<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { lang, t } from '$lib/i18n';
  import { currentUser, authLoading } from '$lib/auth';
  import { getBudget, getSetlists, deleteBudgetEntry, updateBudgetEntry, getReceiptUrl } from '$lib/api';
  import { budgetTotals, buildBudgetReport, formatEUR } from '$lib/utils';
  import type { BudgetEntry, BudgetKind, Setlist } from '$lib/types';
  import BudgetEntryModal from '$components/budget/BudgetEntryModal.svelte';

  let entries = $state<BudgetEntry[]>([]);
  let setlists = $state<Setlist[]>([]);
  let loading = $state(true);
  let dataLoaded = $state(false);

  let modalKind = $state<BudgetKind | null>(null);
  let editEntry = $state<BudgetEntry | null>(null);

  let reportText = $state('');
  let copied = $state(false);

  const totals = $derived(budgetTotals(entries));
  const visible = $derived(
    [...entries].sort((a, b) => b.date.localeCompare(a.date))
  );

  // Admin-only guard + data load (mirrors the admin page)
  $effect(() => {
    if ($authLoading || dataLoaded) return;
    if (!$currentUser?.isAdmin) { goto(`${base}/backlog`); return; }
    dataLoaded = true;
    Promise.all([getBudget(), getSetlists()]).then(([b, s]) => {
      entries = b;
      setlists = s;
      loading = false;
    });
  });

  const setlistName = (id?: string) => setlists.find(s => s.id === id)?.name;

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat($lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  function openAdd(kind: BudgetKind) { editEntry = null; modalKind = kind; }
  function openEdit(e: BudgetEntry) { editEntry = e; modalKind = e.kind; }
  function closeModal() { modalKind = null; editEntry = null; }

  function onSaved(saved: BudgetEntry) {
    const i = entries.findIndex(e => e.id === saved.id);
    entries = i >= 0
      ? entries.map(e => e.id === saved.id ? saved : e)
      : [...entries, saved];
  }

  async function handleDelete(e: BudgetEntry) {
    if (!confirm($t.budget.deleteConfirm)) return;
    await deleteBudgetEntry(e.id);
    entries = entries.filter(x => x.id !== e.id);
  }

  async function togglePaid(e: BudgetEntry) {
    if (e.kind !== 'debt') return;
    const updated = await updateBudgetEntry({
      ...e,
      paid: !e.paid,
      ...(e.paid ? {} : { paidAt: new Date().toISOString() }),
    });
    entries = entries.map(x => x.id === updated.id ? updated : x);
  }

  async function openReceipt(e: BudgetEntry) {
    const url = await getReceiptUrl(e.id);
    window.open(url, '_blank');
  }

  function generateReport() {
    reportText = buildBudgetReport(entries, setlists, Date.now(), $lang);
    copied = false;
  }

  async function copyReport() {
    await navigator.clipboard.writeText(reportText);
    copied = true;
    setTimeout(() => { copied = false; }, 1500);
  }
</script>

<div class="page">
  <h1>{$t.budget.title}</h1>

  {#if loading}
    <p class="loading">…</p>
  {:else}
    <!-- Dashboard: Наличка + Переводы = На руках − Долги = Баланс -->
    <div class="dash">
      <div class="card"><span class="card-lbl">{$t.budget.dash.cash}</span><span class="card-val">{formatEUR(totals.cash, $lang)}</span></div>
      <span class="op">+</span>
      <div class="card"><span class="card-lbl">{$t.budget.dash.transfer}</span><span class="card-val">{formatEUR(totals.transfer, $lang)}</span></div>
      <span class="op">=</span>
      <div class="card accent"><span class="card-lbl">{$t.budget.dash.onHand}</span><span class="card-val">{formatEUR(totals.onHand, $lang)}</span></div>
      <span class="op">−</span>
      <div class="card"><span class="card-lbl">{$t.budget.dash.debts}</span><span class="card-val neg">{formatEUR(totals.debts, $lang)}</span></div>
      <span class="op">=</span>
      <div class="card accent"><span class="card-lbl">{$t.budget.dash.balance}</span><span class="card-val" class:neg={totals.balance < 0}>{formatEUR(totals.balance, $lang)}</span></div>
    </div>

    <!-- Add buttons -->
    <div class="toolbar">
      <button class="btn-add income" onclick={() => openAdd('income')}>{$t.budget.addIncome}</button>
      <button class="btn-add expense" onclick={() => openAdd('expense')}>{$t.budget.addExpense}</button>
      <button class="btn-add debt" onclick={() => openAdd('debt')}>{$t.budget.addDebt}</button>
    </div>

    <!-- Entries -->
    {#if visible.length === 0}
      <p class="empty">{$t.budget.empty}</p>
    {:else}
      <div class="rows">
        {#each visible as e (e.id)}
          <div class="row" class:paid={e.kind === 'debt' && e.paid}>
            <div class="row-main">
              <span class="badge {e.kind}">{$t.budget.kind[e.kind]}</span>
              <span class="row-amount" class:pos={e.kind === 'income'} class:neg={e.kind === 'expense'} class:debt={e.kind === 'debt'}>
                {e.kind === 'income' ? '+' : e.kind === 'expense' ? '−' : ''}{formatEUR(e.amount, $lang)}
              </span>
              <span class="row-who">
                {#if e.kind === 'income'}{e.person || '—'}
                {:else if e.kind === 'expense'}{e.description || e.spentBy || '—'}
                {:else}{e.creditor || '—'}{/if}
              </span>
              {#if (e.kind === 'income' || e.kind === 'expense')}
                <span class="chip">{e.method === 'cash' ? $t.budget.methodCash : $t.budget.methodTransfer}</span>
              {/if}
            </div>
            <div class="row-meta">
              <span>{fmtDate(e.date)}</span>
              {#if setlistName(e.setlistId)}<span>· {setlistName(e.setlistId)}</span>{/if}
              {#if e.comment}<span>· {e.comment}</span>{/if}
            </div>
            <div class="row-actions">
              {#if e.kind === 'expense' && e.receiptKey}
                <button class="icon-btn" onclick={() => openReceipt(e)} title={$t.budget.viewReceipt}>🧾</button>
              {/if}
              {#if e.kind === 'debt'}
                <button class="icon-btn" onclick={() => togglePaid(e)} title={$t.budget.markPaid}>{e.paid ? '✕' : '✓'}</button>
              {/if}
              <button class="icon-btn" onclick={() => openEdit(e)} title={$t.budget.edit}>✏️</button>
              <button class="icon-btn danger" onclick={() => handleDelete(e)}>🗑</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Report -->
    <div class="report">
      <div class="report-head">
        <h2>{$t.budget.report}</h2>
        <button class="btn-secondary" onclick={generateReport}>{$t.budget.generateReport}</button>
      </div>
      {#if reportText}
        <pre>{reportText}</pre>
        <button class="btn-primary" onclick={copyReport}>{copied ? $t.budget.copied : $t.budget.copy}</button>
      {/if}
    </div>
  {/if}
</div>

{#if modalKind}
  <BudgetEntryModal kind={modalKind} entry={editEntry} {setlists} onclose={closeModal} onsaved={onSaved} />
{/if}

<style>
  .page { padding: 20px 16px; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin-bottom: 16px; }
  .loading, .empty { text-align: center; padding: 40px 20px; color: var(--text-muted); }

  .dash { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  .card { flex: 1 1 110px; min-width: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
  .card.accent { border-color: var(--accent); background: var(--chip-bg); }
  .card-lbl { font-size: 0.78rem; color: var(--text-muted); }
  .card-val { font-size: 1.1rem; font-weight: 700; }
  .card-val.neg { color: #e05252; }
  .op { flex: 0 0 auto; font-size: 1.2rem; font-weight: 700; color: var(--text-muted); }

  .toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
  .btn-add { flex: 1 1 auto; padding: 8px 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.88rem; border-left-width: 4px; }
  .btn-add.income { border-left-color: #3a9e5c; }
  .btn-add.expense { border-left-color: #e05252; }
  .btn-add.debt { border-left-color: #d98a1f; }

  .rows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 28px; }
  .row { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; position: relative; }
  .row.paid { opacity: 0.55; }
  .row-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .badge { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 2px 7px; border-radius: 6px; color: #fff; }
  .badge.income { background: #3a9e5c; }
  .badge.expense { background: #e05252; }
  .badge.debt { background: #d98a1f; }
  .row-amount { font-weight: 700; font-size: 1rem; }
  .row-amount.pos { color: #3a9e5c; }
  .row-amount.neg { color: #e05252; }
  .row-amount.debt { color: #d98a1f; }
  .row-who { color: var(--text); }
  .chip { font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; background: var(--chip-bg); color: var(--text-muted); }
  .row-meta { font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 6px; flex-wrap: wrap; }
  .row-actions { display: flex; gap: 4px; position: absolute; top: 8px; right: 8px; }
  .icon-btn { background: none; border: none; cursor: pointer; font-size: 0.95rem; padding: 2px 4px; line-height: 1; }
  .icon-btn.danger { filter: grayscale(0.2); }

  .report { border-top: 1px solid var(--border); padding-top: 16px; }
  .report-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
  .report-head h2 { font-size: 1.1rem; }
  pre { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; white-space: pre-wrap; font-family: inherit; font-size: 0.9rem; margin-bottom: 12px; }

  .btn-primary { padding: 8px 18px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.88rem; }
  .btn-secondary { padding: 8px 18px; border: 1px solid var(--border); background: transparent; border-radius: 6px; cursor: pointer; color: var(--text); font-size: 0.88rem; }
</style>
