<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { t } from '$lib/i18n';
  import { parseEUR } from '$lib/utils';
  import { addBudgetEntry, updateBudgetEntry, uploadReceipt, getReceiptUrl } from '$lib/api';
  import type { BudgetEntry, BudgetKind, PaymentMethod, Setlist, IncomeEntry, ExpenseEntry, DebtEntry } from '$lib/types';

  type NewEntry<T> = Omit<T, 'id' | 'createdAt' | 'createdBy'>;

  let {
    kind,
    entry = null,
    setlists,
    onclose,
    onsaved,
  }: {
    kind: BudgetKind;
    entry?: BudgetEntry | null;
    setlists: Setlist[];
    onclose: () => void;
    onsaved: (e: BudgetEntry) => void;
  } = $props();

  // The entry prop is fixed for the lifetime of a modal instance (a fresh one is
  // mounted per open), so capture it as a plain const for the state initializers.
  const src = entry;
  const isEdit = !!src;

  // ─── Local draft fields ─────────────────────────────────────────────────────
  let amountInput = $state(src ? (src.amount / 100).toFixed(2).replace('.', ',') : '');
  let method = $state<PaymentMethod>(
    src && (src.kind === 'income' || src.kind === 'expense') ? src.method : 'cash'
  );
  let dateLocal = $state(toLocalInput(src?.date ?? new Date().toISOString()));
  let comment = $state(src?.comment ?? '');
  let setlistId = $state(src?.setlistId ?? suggestEvent());
  // income
  let person = $state(src?.kind === 'income' ? (src.person ?? '') : '');
  // expense
  let spentBy = $state(src?.kind === 'expense' ? (src.spentBy ?? '') : '');
  // debt
  let creditor = $state(src?.kind === 'debt' ? (src.creditor ?? '') : '');
  let paid = $state(src?.kind === 'debt' ? (src.paid ?? false) : false);
  // expense + debt
  let description = $state(
    src && (src.kind === 'expense' || src.kind === 'debt') ? (src.description ?? '') : ''
  );
  // receipt (expense only)
  let receiptKey = $state(src?.kind === 'expense' ? (src.receiptKey ?? '') : '');
  let receiptFile = $state<File | null>(null);

  let saving = $state(false);
  let error = $state('');

  const modalTitle = $derived(
    kind === 'income' ? (isEdit ? $t.budget.titles.editIncome : $t.budget.titles.addIncome)
    : kind === 'expense' ? (isEdit ? $t.budget.titles.editExpense : $t.budget.titles.addExpense)
    : (isEdit ? $t.budget.titles.editDebt : $t.budget.titles.addDebt)
  );

  const sortedSetlists = $derived(
    [...setlists].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  );

  /** Convert an ISO timestamp to a local "YYYY-MM-DDTHH:mm" value for datetime-local. */
  function toLocalInput(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** Suggest the event whose date is within −24h/+72h of now (the report window). */
  function suggestEvent(): string {
    const now = Date.now();
    for (const s of setlists) {
      if (!s.date) continue;
      const start = new Date(`${s.date}T${s.startTime ?? '00:00'}`).getTime();
      if (isNaN(start)) continue;
      if (now >= start - 24 * 3600e3 && now <= start + 72 * 3600e3) return s.id;
    }
    return '';
  }

  async function handleSave() {
    error = '';
    const amount = parseEUR(amountInput);
    if (amount <= 0) { error = '⚠'; return; }
    const dateIso = dateLocal ? new Date(dateLocal).toISOString() : new Date().toISOString();

    saving = true;
    try {
      const base = {
        amount,
        date: dateIso,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(setlistId ? { setlistId } : {}),
      };
      let payload: NewEntry<BudgetEntry>;
      if (kind === 'income') {
        const p: NewEntry<IncomeEntry> = { kind, method, ...(person.trim() ? { person: person.trim() } : {}), ...base };
        payload = p;
      } else if (kind === 'expense') {
        const p: NewEntry<ExpenseEntry> = {
          kind, method,
          ...(spentBy.trim() ? { spentBy: spentBy.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(receiptKey ? { receiptKey } : {}),
          ...base,
        };
        payload = p;
      } else {
        const p: NewEntry<DebtEntry> = {
          kind,
          ...(creditor.trim() ? { creditor: creditor.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          paid,
          ...(paid ? { paidAt: new Date().toISOString() } : {}),
          ...base,
        };
        payload = p;
      }

      let saved = isEdit
        ? await updateBudgetEntry({ ...(entry as BudgetEntry), ...payload } as BudgetEntry)
        : await addBudgetEntry(payload);

      // Upload a freshly-chosen receipt now that we have an id, then persist the key.
      if (kind === 'expense' && receiptFile) {
        const key = await uploadReceipt(saved.id, receiptFile);
        saved = await updateBudgetEntry({ ...saved, receiptKey: key } as BudgetEntry);
      }

      onsaved(saved);
      closeModal();
    } catch (e) {
      error = (e as Error).message;
      saving = false;
    }
  }

  async function openReceipt() {
    if (!entry || entry.kind !== 'expense' || !entry.receiptKey) return;
    const url = await getReceiptUrl(entry.id);
    window.open(url, '_blank');
  }

  function onReceiptPick(e: Event) {
    const input = e.target as HTMLInputElement;
    receiptFile = input.files?.[0] ?? null;
  }

  // ─── Modal chrome (backdrop click + mobile back button) ─────────────────────
  let closed = false;
  function closeModal() {
    if (closed) return;
    closed = true;
    onclose();
  }
  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) closeModal();
  }
  function handlePopstate() { closeModal(); }

  onMount(() => {
    if (!browser) return;
    document.body.style.overflow = 'hidden';
    if (window.innerWidth <= 700) {
      history.pushState({ kittenModal: true }, '');
      window.addEventListener('popstate', handlePopstate);
    }
  });
  onDestroy(() => {
    if (!browser) return;
    document.body.style.overflow = '';
    window.removeEventListener('popstate', handlePopstate);
  });
</script>

<div class="modal-backdrop" onclick={handleBackdrop} role="presentation">
  <div class="modal">
    <div class="modal-header">
      <h2>{modalTitle}</h2>
      <button class="close-btn" onclick={closeModal} aria-label="close">✕</button>
    </div>

    <div class="modal-body">
      <div class="field">
        <label for="b-amount">{$t.budget.amount}</label>
        <input id="b-amount" inputmode="decimal" bind:value={amountInput} placeholder="0,00" />
      </div>

      {#if kind === 'income' || kind === 'expense'}
        <div class="field">
          <span class="lbl">{$t.budget.method}</span>
          <div class="seg">
            <button class:active={method === 'cash'} onclick={() => method = 'cash'}>{$t.budget.methodCash}</button>
            <button class:active={method === 'transfer'} onclick={() => method = 'transfer'}>{$t.budget.methodTransfer}</button>
          </div>
        </div>
      {/if}

      {#if kind === 'income'}
        <div class="field">
          <label for="b-person">{$t.budget.person}</label>
          <input id="b-person" bind:value={person} />
        </div>
      {:else if kind === 'expense'}
        <div class="field">
          <label for="b-spent">{$t.budget.spentBy}</label>
          <input id="b-spent" bind:value={spentBy} />
        </div>
        <div class="field">
          <label for="b-desc">{$t.budget.description}</label>
          <input id="b-desc" bind:value={description} />
        </div>
      {:else}
        <div class="field">
          <label for="b-creditor">{$t.budget.creditor}</label>
          <input id="b-creditor" bind:value={creditor} />
        </div>
        <div class="field">
          <label for="b-debtdesc">{$t.budget.description}</label>
          <input id="b-debtdesc" bind:value={description} />
        </div>
        <label class="check">
          <input type="checkbox" bind:checked={paid} />
          {$t.budget.paid}
        </label>
      {/if}

      <div class="field">
        <label for="b-date">{$t.budget.date}</label>
        <input id="b-date" type="datetime-local" bind:value={dateLocal} />
      </div>

      <div class="field">
        <label for="b-event">{$t.budget.event}</label>
        <select id="b-event" bind:value={setlistId}>
          <option value="">{$t.budget.noEvent}</option>
          {#each sortedSetlists as s (s.id)}
            <option value={s.id}>{s.name}</option>
          {/each}
        </select>
      </div>

      <div class="field">
        <label for="b-comment">{$t.budget.comment}</label>
        <input id="b-comment" bind:value={comment} />
      </div>

      {#if kind === 'expense'}
        <div class="field">
          <span class="lbl">{$t.budget.receipt}</span>
          <input type="file" accept="image/*,application/pdf" onchange={onReceiptPick} />
          {#if receiptKey && !receiptFile}
            <button type="button" class="link-btn" onclick={openReceipt}>{$t.budget.viewReceipt}</button>
          {/if}
        </div>
      {/if}

      {#if error}<p class="err">{error}</p>{/if}
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" onclick={closeModal}>{$t.budget.cancel}</button>
      <button class="btn-primary" onclick={handleSave} disabled={saving}>
        {saving ? $t.budget.uploading : $t.budget.save}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
  .modal { background: var(--surface); border-radius: 12px; width: 100%; max-width: 480px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .modal-header h2 { font-size: 1.1rem; }
  .close-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: var(--text-muted); }
  .modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field label, .lbl { font-size: 0.8rem; color: var(--text-muted); }
  .field input, .field select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 0.9rem; }
  .seg { display: flex; gap: 8px; }
  .seg button { flex: 1; padding: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 6px; cursor: pointer; font-size: 0.88rem; }
  .seg button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .check { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; }
  .link-btn { align-self: flex-start; background: none; border: none; color: var(--accent); cursor: pointer; padding: 4px 0; font-size: 0.88rem; }
  .err { color: #e05252; font-size: 0.85rem; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .btn-primary { padding: 8px 18px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.88rem; }
  .btn-primary:disabled { opacity: 0.6; cursor: default; }
  .btn-secondary { padding: 8px 18px; border: 1px solid var(--border); background: transparent; border-radius: 6px; cursor: pointer; color: var(--text); font-size: 0.88rem; }

  @media (max-width: 700px) {
    .modal-backdrop { padding: 0; align-items: stretch; }
    .modal { max-width: none; max-height: none; border-radius: 0; height: 100dvh; }
    .field input, .field select { font-size: 16px; }
  }
</style>
