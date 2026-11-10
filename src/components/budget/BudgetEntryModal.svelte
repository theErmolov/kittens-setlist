<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { createQuery } from '@tanstack/svelte-query';
  import { t } from '$lib/i18n';
  import * as Dialog from '$components/ui/dialog';
  import * as Select from '$components/ui/select';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import { Checkbox } from '$components/ui/checkbox';
  import { parseEUR } from '$lib/utils';
  import { setlistsQuery, budgetQuery } from '$lib/query/queries';
  import { useBudgetMutations } from '$lib/query/shell';
  import { queryClient } from '$lib/query/client';
  import { useStore } from '$lib/store/bridge';
  import { budgetStore } from '$lib/store/shell';
  import type { BudgetEntry, BudgetKind, Setlist, IncomeEntry, ExpenseEntry, DebtEntry } from '$lib/types';

  type NewEntry<T> = Omit<T, 'id' | 'createdAt' | 'createdBy'>;

  const bs = budgetStore.getState;
  const mutations = useBudgetMutations();
  const setlistsResult = createQuery(() => setlistsQuery());
  const setlists = $derived(setlistsResult.data ?? []);

  // The open entry is fixed for the lifetime of a modal instance (a fresh one is
  // mounted per open): seed the draft in the store once, before the first render.
  const kind = bs().modalKind as BudgetKind;
  const budgetResult = createQuery(() => budgetQuery());
  const editId = bs().editEntryId;
  const entry = editId ? (budgetResult.data ?? []).find(e => e.id === editId) ?? null : null;
  const isEdit = !!entry;

  const draft = useStore(budgetStore, s => s.draft);
  const setDraft = (patch: Parameters<ReturnType<typeof bs>['setDraft']>[0]) => bs().setDraft(patch);

  /** Convert an ISO timestamp to a local "YYYY-MM-DDTHH:mm" value for datetime-local. */
  function toLocalInput(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** Suggest the event whose date is within −24h/+72h of now (the report window). */
  function suggestEvent(list: Setlist[]): string {
    const now = Date.now();
    for (const s of list) {
      if (!s.date) continue;
      const start = new Date(`${s.date}T${s.startTime ?? '00:00'}`).getTime();
      if (isNaN(start)) continue;
      if (now >= start - 24 * 3600e3 && now <= start + 72 * 3600e3) return s.id;
    }
    return '';
  }

  const src = entry;
  bs().resetDraft({
    amountInput: src ? (src.amount / 100).toFixed(2).replace('.', ',') : '',
    method: src && (src.kind === 'income' || src.kind === 'expense') ? src.method : 'cash',
    dateLocal: toLocalInput(src?.date ?? new Date().toISOString()),
    comment: src?.comment ?? '',
    setlistId: src?.setlistId ?? suggestEvent(queryClient.getQueryData<Setlist[]>(setlistsQuery().queryKey) ?? []),
    person: src?.kind === 'income' ? (src.person ?? '') : '',
    spentBy: src?.kind === 'expense' ? (src.spentBy ?? '') : '',
    creditor: src?.kind === 'debt' ? (src.creditor ?? '') : '',
    paid: src?.kind === 'debt' ? (src.paid ?? false) : false,
    description: src && (src.kind === 'expense' || src.kind === 'debt') ? (src.description ?? '') : '',
    receiptKey: src?.kind === 'expense' ? (src.receiptKey ?? '') : '',
    receiptFile: null,
    saving: false,
    error: null,
  });

  const modalTitle = $derived(
    kind === 'income' ? (isEdit ? $t.budget.titles.editIncome : $t.budget.titles.addIncome)
    : kind === 'expense' ? (isEdit ? $t.budget.titles.editExpense : $t.budget.titles.addExpense)
    : (isEdit ? $t.budget.titles.editDebt : $t.budget.titles.addDebt)
  );

  const sortedSetlists = $derived(
    [...setlists].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  );

  async function handleSave() {
    setDraft({ error: null });
    const d = bs().draft;
    const amount = parseEUR(d.amountInput);
    if (amount <= 0) { setDraft({ error: 'invalidAmount' }); return; }
    const dateIso = d.dateLocal ? new Date(d.dateLocal).toISOString() : new Date().toISOString();

    setDraft({ saving: true });
    try {
      const base = {
        amount,
        date: dateIso,
        ...(d.comment.trim() ? { comment: d.comment.trim() } : {}),
        ...(d.setlistId ? { setlistId: d.setlistId } : {}),
      };
      let payload: NewEntry<BudgetEntry>;
      if (kind === 'income') {
        const p: NewEntry<IncomeEntry> = { kind, method: d.method, ...(d.person.trim() ? { person: d.person.trim() } : {}), ...base };
        payload = p;
      } else if (kind === 'expense') {
        const p: NewEntry<ExpenseEntry> = {
          kind, method: d.method,
          ...(d.spentBy.trim() ? { spentBy: d.spentBy.trim() } : {}),
          ...(d.description.trim() ? { description: d.description.trim() } : {}),
          ...(d.receiptKey ? { receiptKey: d.receiptKey } : {}),
          ...base,
        };
        payload = p;
      } else {
        const p: NewEntry<DebtEntry> = {
          kind,
          ...(d.creditor.trim() ? { creditor: d.creditor.trim() } : {}),
          ...(d.description.trim() ? { description: d.description.trim() } : {}),
          paid: d.paid,
          ...(d.paid ? { paidAt: new Date().toISOString() } : {}),
          ...base,
        };
        payload = p;
      }

      let saved = isEdit
        ? await mutations.update.mutateAsync({ ...(entry as BudgetEntry), ...payload } as BudgetEntry)
        : await mutations.add.mutateAsync(payload);

      // Upload a freshly-chosen receipt now that we have an id, then persist the key.
      if (kind === 'expense' && d.receiptFile) {
        const key = await mutations.uploadReceipt.mutateAsync({ entryId: saved.id, file: d.receiptFile });
        saved = await mutations.update.mutateAsync({ ...saved, receiptKey: key } as BudgetEntry);
      }

      closeModal();
    } catch {
      setDraft({ error: 'requestFailed', saving: false });
    }
  }

  function openReceipt() {
    if (!entry || entry.kind !== 'expense' || !entry.receiptKey) return;
    mutations.openReceipt.mutate(entry.id);
  }

  function onReceiptPick(e: Event) {
    const input = e.target as HTMLInputElement;
    setDraft({ receiptFile: input.files?.[0] ?? null });
  }

  // ─── Modal chrome (dialog handles backdrop/Escape/scroll lock; mobile back button closes) ──
  let closed = false;
  function closeModal() {
    if (closed) return;
    closed = true;
    bs().closeModal();
  }
  function handlePopstate() { closeModal(); }

  onMount(() => {
    if (!browser) return;
    if (window.innerWidth <= 700) {
      history.pushState({ kittenModal: true }, '');
      window.addEventListener('popstate', handlePopstate);
    }
  });
  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('popstate', handlePopstate);
  });

  const NO_EVENT = '__none__';
  const eventName = $derived(sortedSetlists.find(s => s.id === $draft.setlistId)?.name ?? $t.budget.noEvent);
</script>

{#snippet field(id: string, label: string, key: 'person' | 'spentBy' | 'description' | 'creditor' | 'comment')}
  <div class="field flex flex-col gap-1">
    <Label for={id} class="text-[0.8rem] font-normal text-muted-foreground">{label}</Label>
    <Input {id} class="bg-background" value={$draft[key]} oninput={e => setDraft({ [key]: e.currentTarget.value })} />
  </div>
{/snippet}

<Dialog.Root open={true} onOpenChange={open => { if (!open) closeModal(); }}>
  <Dialog.Content
    showCloseButton={false}
    aria-describedby={undefined}
    class="modal flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-[480px] max-[700px]:top-0 max-[700px]:left-0 max-[700px]:h-dvh max-[700px]:max-h-none max-[700px]:w-full max-[700px]:max-w-none max-[700px]:translate-x-0 max-[700px]:translate-y-0 max-[700px]:rounded-none max-[700px]:ring-0"
  >
    <Dialog.Header class="modal-header flex-row items-center justify-between border-b px-5 py-4">
      <Dialog.Title class="text-[1.1rem] font-bold">{modalTitle}</Dialog.Title>
      <Button variant="ghost" size="icon-sm" class="text-[1.1rem] text-muted-foreground" onclick={closeModal} aria-label={$t.common.close}>✕</Button>
    </Dialog.Header>

    <div class="modal-body flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
      <div class="field flex flex-col gap-1">
        <Label for="b-amount" class="text-[0.8rem] font-normal text-muted-foreground">{$t.budget.amount}</Label>
        <Input id="b-amount" class="bg-background" inputmode="decimal" value={$draft.amountInput} oninput={e => setDraft({ amountInput: e.currentTarget.value })} placeholder="0,00" />
      </div>

      {#if kind === 'income' || kind === 'expense'}
        <div class="field flex flex-col gap-1" role="group" aria-labelledby="b-method">
          <span id="b-method" class="lbl text-[0.8rem] text-muted-foreground">{$t.budget.method}</span>
          <div class="seg flex gap-2">
            <Button class="flex-1" variant={$draft.method === 'cash' ? 'default' : 'outline'} aria-pressed={$draft.method === 'cash'} onclick={() => setDraft({ method: 'cash' })}>{$t.budget.methodCash}</Button>
            <Button class="flex-1" variant={$draft.method === 'transfer' ? 'default' : 'outline'} aria-pressed={$draft.method === 'transfer'} onclick={() => setDraft({ method: 'transfer' })}>{$t.budget.methodTransfer}</Button>
          </div>
        </div>
      {/if}

      {#if kind === 'income'}
        {@render field('b-person', $t.budget.person, 'person')}
      {:else if kind === 'expense'}
        {@render field('b-spent', $t.budget.spentBy, 'spentBy')}
        {@render field('b-desc', $t.budget.description, 'description')}
      {:else}
        {@render field('b-creditor', $t.budget.creditor, 'creditor')}
        {@render field('b-debtdesc', $t.budget.description, 'description')}
        <div class="check flex items-center gap-2">
          <Checkbox id="b-paid" bind:checked={() => $draft.paid, v => setDraft({ paid: v })} />
          <Label for="b-paid" class="cursor-pointer text-[0.9rem] font-normal">{$t.budget.paid}</Label>
        </div>
      {/if}

      <div class="field flex flex-col gap-1">
        <Label for="b-date" class="text-[0.8rem] font-normal text-muted-foreground">{$t.budget.date}</Label>
        <Input id="b-date" class="bg-background" type="datetime-local" value={$draft.dateLocal} oninput={e => setDraft({ dateLocal: e.currentTarget.value })} />
      </div>

      <div class="field flex flex-col gap-1">
        <Label for="b-event" class="text-[0.8rem] font-normal text-muted-foreground">{$t.budget.event}</Label>
        <Select.Root type="single" value={$draft.setlistId || NO_EVENT} onValueChange={v => setDraft({ setlistId: v === NO_EVENT ? '' : v })}>
          <Select.Trigger id="b-event" class="w-full bg-background text-[0.9rem] max-[700px]:text-base"><span class="truncate">{eventName}</span></Select.Trigger>
          <Select.Content>
            <Select.Item value={NO_EVENT} label={$t.budget.noEvent} />
            {#each sortedSetlists as s (s.id)}
              <Select.Item value={s.id} label={s.name} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      {@render field('b-comment', $t.budget.comment, 'comment')}

      {#if kind === 'expense'}
        <div class="field flex flex-col gap-1">
          <Label for="b-receipt" class="text-[0.8rem] font-normal text-muted-foreground">{$t.budget.receipt}</Label>
          <Input id="b-receipt" type="file" class="bg-background" accept="image/*,application/pdf" onchange={onReceiptPick} />
          {#if $draft.receiptKey && !$draft.receiptFile}
            <Button variant="link" class="self-start px-0 text-[0.88rem]" onclick={openReceipt}>{$t.budget.viewReceipt}</Button>
          {/if}
        </div>
      {/if}

      {#if $draft.error}<p class="err text-[0.85rem] text-destructive" role="alert">{$t.common[$draft.error]}</p>{/if}
    </div>

    <Dialog.Footer class="modal-footer m-0 shrink-0 flex-row justify-end gap-2 rounded-none px-5 py-3">
      <Button variant="outline" class="px-[18px]" onclick={closeModal}>{$t.budget.cancel}</Button>
      <Button class="px-[18px]" onclick={handleSave} disabled={$draft.saving}>
        {$draft.saving ? $t.budget.uploading : $t.budget.save}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
