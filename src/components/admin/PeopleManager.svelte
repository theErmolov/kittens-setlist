<script lang="ts">
  import OnlineUsersPanel from './OnlineUsersPanel.svelte';
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import { Input } from '$components/ui/input';
  import * as Select from '$components/ui/select';
  import { Toggle } from '$components/ui/toggle';
  import * as Table from '$components/ui/table';
  import { getCoreRowModel, type ColumnDef } from '@tanstack/table-core';
  import { createSvelteTable, FlexRender, renderSnippet } from '$components/ui/data-table';
  import { Alert } from '$components/ui/alert';
  import { Card } from '$components/ui/card';
  import * as Empty from '$components/ui/empty';
  import RowActions, { type RowAction } from '$components/shared/RowActions.svelte';
  import ButtonRow from '$components/shared/ButtonRow.svelte';
  import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { t } from '$lib/i18n';
  import type { BandMusician, Instrument, User, UserRole } from '$lib/types';
  import { INSTRUMENT_ICONS } from '$lib/utils';
  import type { UserPatch } from '$lib/api';
  import { keys, usersQuery } from '$lib/query/queries';
  import { useAdminUserMutations } from '$lib/query/shell';
  import { useStore } from '$lib/store/bridge';
  import { peopleStore } from '$lib/store/shell';

  const allInstruments: Instrument[] = ['guitar', 'bass', 'drums', 'keys', 'cajon', 'violin', 'saxophone', 'trumpet', 'percussion', 'vocals'];

  const qc = useQueryClient();
  const usersResult = createQuery(() => usersQuery());
  const users = $derived(usersResult.data ?? []);
  const mutations = useAdminUserMutations();
  const ps = peopleStore.getState;

  const saving = useStore(peopleStore, s => s.saving);
  const error = useStore(peopleStore, s => s.error);
  const roleSelections = useStore(peopleStore, s => s.roleSelections);
  const approvalMusicianSelections = useStore(peopleStore, s => s.approvalSelections);
  const approvalMusicianNames = useStore(peopleStore, s => s.approvalNames);
  const approvalMusicianInstruments = useStore(peopleStore, s => s.approvalInstruments);
  const editorKind = useStore(peopleStore, s => s.editorKind);
  const editorUserId = useStore(peopleStore, s => s.editorUserId);
  const draftName = useStore(peopleStore, s => s.draftName);
  const draftInstruments = useStore(peopleStore, s => s.draftInstruments);
  const draftMergeTargetId = useStore(peopleStore, s => s.draftMergeTargetId);
  const dragId = useStore(peopleStore, s => s.dragId);
  const dragOverId = useStore(peopleStore, s => s.dragOverId);
  const canDrag = useStore(peopleStore, s => s.canDrag);
  const removeTarget = useStore(peopleStore, s => s.removeTarget);

  let musicians = $derived(
    users
      .filter((user): user is User & { musicianName: string } => Boolean(user.musicianName))
      .sort((a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
          || a.musicianName.localeCompare(b.musicianName)
      )
  );
  let mergeTargets = $derived(musicians.filter(user => !user.telegramId));
  let orderedUsers = $derived([...users].sort(comparePeople));

  // Data Table: rows are the users in their stored display order; the cells are snippets below.
  const cellBase = 'min-w-0';
  const columns = $derived<ColumnDef<User>[]>([
    { id: 'person', header: $t.admin.person, meta: { cellClass: `identity ${cellBase} whitespace-normal max-[760px]:p-0` }, cell: ({ row }) => renderSnippet(personCell, row.original) },
    { id: 'role', header: $t.admin.role, meta: { cellClass: `role-cell ${cellBase} max-[760px]:self-start max-[760px]:p-0` }, cell: ({ row }) => renderSnippet(roleCell, row.original) },
    { id: 'musician', header: $t.musicians.title, meta: { cellClass: `musician-cell ${cellBase} whitespace-normal max-[760px]:col-span-2 max-[760px]:min-h-[30px] max-[760px]:p-0` }, cell: ({ row }) => renderSnippet(musicianCell, row.original) },
    { id: 'actions', header: '', meta: { cellClass: `actions-cell ${cellBase} w-16 max-[760px]:self-start max-[760px]:p-0` }, cell: ({ row }) => renderSnippet(actionsCell, row.original) },
  ]);
  const table = createSvelteTable<User>({
    get data() { return orderedUsers; },
    get columns() { return columns; },
    getRowId: user => user.id,
    getCoreRowModel: getCoreRowModel(),
  });

  function comparePeople(a: User, b: User): number {
    const rank = (user: User) => {
      if (user.status === 'pending') return 0;
      if (user.musicianName) return 1;
      if (user.status === 'approved') return 2;
      return 3;
    };
    const rankDiff = rank(a) - rank(b);
    if (rankDiff) return rankDiff;
    if (a.musicianName && b.musicianName) {
      const orderDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
      if (orderDiff) return orderDiff;
    }
    return displayName(a).localeCompare(displayName(b));
  }

  function displayName(user: User): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.musicianName || user.id;
  }

  function asMusician(user: User & { musicianName: string }): BandMusician {
    return {
      id: user.id,
      name: user.musicianName,
      ...(user.defaultInstruments ? { defaultInstruments: user.defaultInstruments } : {}),
      ...(user.sortOrder !== undefined ? { sortOrder: user.sortOrder } : {}),
      ...(user.guest !== undefined ? { guest: user.guest } : {}),
    };
  }

  async function refresh() {
    await mutations.refresh();
    ps().clearRoles();
  }

  async function setStatus(user: User, status: 'approved' | 'rejected') {
    const s = ps();
    s.setSaving(user.id);
    s.setError(false);
    try {
      const patch: UserPatch = {
        status,
        role: s.roleSelections[user.id] ?? user.role ?? 'reader',
      };
      const choice = s.approvalSelections[user.id] ?? '';
      if (status === 'approved' && !user.musicianName && choice === '__new__') {
        const name = s.approvalNames[user.id]?.trim();
        if (!name) return;
        patch.musicianName = name;
        patch.defaultInstruments = s.approvalInstruments[user.id] ?? [];
        patch.sortOrder = musicians.length;
      } else if (status === 'approved' && !user.musicianName && choice) {
        patch.mergeIntoUserId = choice;
      }
      await mutations.patchUser.mutateAsync({ id: user.id, patch });
      await refresh();
    } catch {
      ps().setError(true);
    } finally {
      ps().setSaving(null);
    }
  }

  async function saveRole(user: User, role: UserRole) {
    ps().setSaving(user.id);
    ps().setError(false);
    try {
      await mutations.patchUser.mutateAsync({ id: user.id, patch: { role } });
      await refresh();
    } catch {
      ps().setRole(user.id, user.role ?? 'reader');
      ps().setError(true);
    } finally {
      ps().setSaving(null);
    }
  }

  function handleRoleChange(user: User, role: UserRole) {
    ps().setRole(user.id, role);
    if (user.status === 'approved') void saveRole(user, role);
  }

  async function saveMusician() {
    const s = ps();
    const kind = s.editorKind;
    if (!kind) return;
    const userId = s.editorUserId;
    const name = s.draftName.trim();
    s.setSaving(userId ?? '__new__');
    s.setError(false);
    try {
      if (kind === 'standalone') {
        if (!name) return;
        await mutations.addMusician.mutateAsync({
          name,
          defaultInstruments: s.draftInstruments,
          sortOrder: musicians.length,
        });
      } else if (kind === 'attach' && userId) {
        if (s.draftMergeTargetId) {
          await mutations.patchUser.mutateAsync({ id: userId, patch: { mergeIntoUserId: s.draftMergeTargetId } });
        } else {
          if (!name) return;
          await mutations.patchUser.mutateAsync({
            id: userId,
            patch: { musicianName: name, defaultInstruments: s.draftInstruments, sortOrder: musicians.length },
          });
        }
      } else if (kind === 'edit' && userId) {
        const user = users.find(item => item.id === userId);
        if (!user?.musicianName || !name) return;
        await mutations.updateMusician.mutateAsync({
          ...asMusician(user as User & { musicianName: string }),
          name,
          defaultInstruments: s.draftInstruments,
        });
      }
      ps().cancelEditor();
      await refresh();
    } catch {
      ps().setError(true);
    } finally {
      ps().setSaving(null);
    }
  }

  async function removeMusician(id: string) {
    ps().setRemoveTarget(null);
    ps().setSaving(id);
    ps().setError(false);
    try {
      await mutations.deleteMusician.mutateAsync(id);
      await refresh();
    } catch {
      ps().setError(true);
    } finally {
      ps().setSaving(null);
    }
  }

  function onDragOver(event: DragEvent, id: string) {
    event.preventDefault();
    ps().setDragOver(id);
  }

  async function onDrop(event: DragEvent) {
    event.preventDefault();
    const { dragId: from_, dragOverId: to_ } = ps();
    if (!from_ || !to_ || from_ === to_) {
      ps().resetDrag();
      return;
    }
    const reordered = [...musicians];
    const from = reordered.findIndex(user => user.id === from_);
    const to = reordered.findIndex(user => user.id === to_);
    if (from < 0 || to < 0) return;
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const orderById = new Map(reordered.map((user, index) => [user.id, index]));
    qc.setQueryData<User[]>(keys.users, old => (old ?? []).map(user => orderById.has(user.id) ? { ...user, sortOrder: orderById.get(user.id) } : user));
    ps().resetDrag();
    ps().setError(false);
    try {
      await Promise.all(reordered.map((user, index) => mutations.updateMusician.mutateAsync({ ...asMusician(user), sortOrder: index })));
      await refresh();
    } catch {
      ps().setError(true);
      await refresh();
    }
  }

  // Row actions («⋯» menu): the same actions the inline buttons offered, by user state; destructive ones last.
  function rowActions(user: User): RowAction[] {
    const out: RowAction[] = [];
    const canAct = Boolean(user.telegramId) && !user.isAdmin;
    const approveBlocked = user.status === 'pending' && $approvalMusicianSelections[user.id] === '__new__' && !$approvalMusicianNames[user.id]?.trim();
    if (canAct && user.status !== 'approved') out.push({ icon: '✅', label: $t.admin.approve, disabled: approveBlocked, onselect: () => void setStatus(user, 'approved') });
    if ($editorUserId !== user.id) {
      if (user.musicianName) out.push({ icon: '✏️', label: $t.common.edit, onselect: () => ps().startEdit(user.id, user.musicianName ?? '', user.defaultInstruments ?? []) });
      else if (user.status !== 'pending') out.push({ icon: '🎸', label: $t.admin.makeMusician, onselect: () => ps().startAttach(user.id) });
    }
    const destructive: RowAction[] = [];
    if (canAct && user.status === 'pending') destructive.push({ icon: '❌', label: $t.admin.reject, destructive: true, onselect: () => void setStatus(user, 'rejected') });
    if (canAct && user.status === 'approved') destructive.push({ icon: '🚫', label: $t.admin.revoke, destructive: true, onselect: () => void setStatus(user, 'rejected') });
    if (user.musicianName && $editorUserId !== user.id) destructive.push({ icon: '🗑️', label: $t.budget.delete, destructive: true, onselect: () => ps().setRemoveTarget({ id: user.id, linked: Boolean(user.telegramId) }) });
    if (destructive.length && out.length) destructive[0].separatorBefore = true;
    return [...out, ...destructive];
  }

  const btnCls = 'whitespace-nowrap';
  const NONE = '__none__';
  const roleLabel = (role: string) => role === 'writer' ? $t.admin.roleWriter : $t.admin.roleReader;

  function statusLabel(user: User): string {
    if (user.status === 'pending') return $t.admin.pending;
    if (user.status === 'rejected') return $t.admin.rejected;
    return $t.admin.approved;
  }
</script>

<OnlineUsersPanel />

<section class="people-section mb-7 max-[760px]:mb-[18px]">
  <div class="people-title mb-2.5 flex items-center justify-end max-[760px]:mb-2 max-[760px]:gap-2">
    <Button class="add-musician px-3 text-[0.79rem] font-semibold max-[760px]:px-2 max-[760px]:text-[0.7rem]" onclick={() => ps().startStandalone()}>{$t.musicians.addBtn}</Button>
  </div>

  {#if $error}<Alert variant="destructive" class="error mb-2 border-0 bg-transparent p-0 text-[0.82rem]">{$t.common.requestFailed}</Alert>{/if}

  {#if $editorKind === 'standalone'}
    <Card class="standalone-editor mb-2.5 gap-0 rounded-[10px] p-3">
      {@render MusicianEditor()}
    </Card>
  {/if}

  {#if users.length === 0}
    <Empty.Root class="border">
      <Empty.Header><Empty.Description>{$t.admin.empty}</Empty.Description></Empty.Header>
    </Empty.Root>
  {:else}
    <div class="people-table">
      <Table.Root class="max-[760px]:block max-[760px]:[&_tbody]:grid max-[760px]:[&_tbody]:gap-[3px] max-[760px]:[&_thead]:hidden">
        <Table.Header>
          {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
            <Table.Row class="people-header">
              {#each headerGroup.headers as header (header.id)}
                <Table.Head>
                  <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
                </Table.Head>
              {/each}
            </Table.Row>
          {/each}
        </Table.Header>
        <Table.Body>
          {#each table.getRowModel().rows as row (row.id)}
            {@const user = row.original}
            <Table.Row
              class="people-row max-[760px]:grid max-[760px]:grid-cols-[minmax(0,1fr)_auto_auto] max-[760px]:gap-x-1.5 max-[760px]:gap-y-[7px] max-[760px]:px-[9px] max-[760px]:py-2 {$dragOverId === user.id && $dragId !== user.id ? 'drag-over shadow-[inset_0_2px_var(--accent)]' : ''}"
              role="group"
              draggable={$canDrag && Boolean(user.musicianName) && !$editorKind}
              ondragstart={$canDrag && user.musicianName ? () => ps().setDrag(user.id) : undefined}
              ondragover={$canDrag && user.musicianName ? (event: DragEvent) => onDragOver(event, user.id) : undefined}
              ondrop={$canDrag && user.musicianName ? onDrop : undefined}
              ondragend={$canDrag && user.musicianName ? () => ps().resetDrag() : undefined}
            >
              {#each row.getVisibleCells() as cell (cell.id)}
                <Table.Cell class="max-[760px]:not-last:border-r-0 {(cell.column.columnDef.meta as { cellClass?: string } | undefined)?.cellClass ?? ''}">
                  <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                </Table.Cell>
              {/each}
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/if}
</section>

<ConfirmDialog
  open={$removeTarget !== null}
  description={$removeTarget?.linked ? $t.musicians.removeConfirm : $t.musicians.deleteConfirm}
  confirmLabel={$removeTarget?.linked ? $t.editor.remove : $t.budget.delete}
  onopenchange={open => { if (!open) ps().setRemoveTarget(null); }}
  onconfirm={() => { const target = ps().removeTarget; if (target) return removeMusician(target.id); }}
/>

{#snippet personCell(user: User)}
                <div class="flex min-w-0 items-center gap-[9px] max-[760px]:gap-[7px]">
                  {#if $canDrag && user.musicianName}<span class="drag-handle cursor-grab select-none text-muted-foreground opacity-55" title={$t.admin.dragToReorder}>⠿</span>{/if}
                  {#if user.photoUrl}<img class="avatar size-9 shrink-0 rounded-full max-[760px]:size-8" src={user.photoUrl} alt="" />{/if}
                  <div class="identity-text flex min-w-0 flex-col items-start gap-0.5 max-[760px]:gap-0">
                    <span class="name text-[0.9rem] font-semibold [overflow-wrap:anywhere] max-[760px]:text-[0.82rem]">{displayName(user)}</span>
                    {#if !user.telegramId}<span class="hint text-[0.78rem] text-muted-foreground">{$t.admin.noTelegramAccess}</span>{/if}
                    {#if user.username}<span class="hint text-[0.78rem] text-muted-foreground max-[760px]:text-[0.7rem] max-[760px]:leading-[1.1]">@{user.username}</span>{/if}
                    {#if user.isAdmin}
                      <Badge variant="secondary" class="badge admin-badge bg-primary px-1.5 text-[0.65rem] font-bold uppercase text-primary-foreground-ink max-[760px]:px-[5px] max-[760px]: max-[760px]:text-[0.56rem]">{$t.admin.adminBadge}</Badge>
                    {:else if user.telegramId}
                      <Badge variant="secondary" class="badge status px-1.5 text-[0.65rem] font-bold uppercase max-[760px]:px-[5px] max-[760px]: max-[760px]:text-[0.56rem] {user.status === 'pending' ? 'pending bg-warning text-warning-ink' : user.status === 'rejected' ? 'rejected bg-danger text-danger-ink' : 'bg-success text-success-ink'}">{statusLabel(user)}</Badge>
                    {/if}
                  </div>
                </div>
{/snippet}

{#snippet roleCell(user: User)}
                {#if user.telegramId && !user.isAdmin}
                  {@const role = $roleSelections[user.id] ?? user.role ?? 'reader'}
                  <Select.Root type="single" value={role} disabled={$saving === user.id} onValueChange={v => handleRoleChange(user, v as UserRole)}>
                    <Select.Trigger class="role-select bg-card text-[0.82rem] max-md:text-base" aria-label={$t.admin.role}>{roleLabel(role)}</Select.Trigger>
                    <Select.Content>
                      <Select.Item value="writer" label={$t.admin.roleWriter} />
                      <Select.Item value="reader" label={$t.admin.roleReader} />
                    </Select.Content>
                  </Select.Root>
                {/if}
{/snippet}

{#snippet actionsCell(user: User)}
  {@const actions = rowActions(user)}
  {#if actions.length}<RowActions {actions} disabled={$saving === user.id} />{/if}
{/snippet}

{#snippet musicianCell(user: User)}
                {#if $editorUserId === user.id}
                  {@render MusicianEditor()}
                {:else if user.musicianName}
                  <div class="flex min-w-0 items-center justify-between gap-2">
                    <div class="musician-summary flex min-w-0 flex-wrap items-center gap-[9px] max-[760px]:gap-[7px]">
                      <span class="musician-name text-[0.9rem] font-semibold [overflow-wrap:anywhere] max-[760px]:text-[0.82rem]">{user.musicianName}</span>
                      <span class="instrument-list flex flex-wrap items-center gap-1 max-[760px]:gap-[3px] max-[760px]:text-[0.95rem]">
                        {#if user.defaultInstruments?.length}
                          {#each user.defaultInstruments as instrument}
                            <span title={$t.instrument[instrument]}>{INSTRUMENT_ICONS[instrument]}</span>
                          {/each}
                        {:else}
                          <span class="hint text-[0.78rem] text-muted-foreground">{$t.musicians.free}</span>
                        {/if}
                      </span>
                    </div>
                  </div>
                {:else if user.status === 'pending'}
                  <div class="approval-musician flex w-full min-w-0 flex-col items-start gap-[7px]">
                    {@render musicianSelect($approvalMusicianSelections[user.id] ?? '', v => ps().setApprovalSelection(user.id, v), $t.admin.accessOnly, true)}
                    {#if $approvalMusicianSelections[user.id] === '__new__'}
                      <Input class="bg-card text-[0.82rem] max-md:text-base" value={$approvalMusicianNames[user.id] ?? ''} oninput={event => ps().setApprovalName(user.id, event.currentTarget.value)} placeholder={$t.musicians.name} aria-label={$t.musicians.name} />
                      {@render instrumentToggles($approvalMusicianInstruments[user.id] ?? [], instrument => ps().toggleApprovalInstrument(user.id, instrument))}
                    {/if}
                  </div>
                {/if}
{/snippet}

{#snippet musicianSelect(value: string, onChange: (value: string) => void, noneLabel: string, withNew: boolean)}
  {@const current = value || NONE}
  <Select.Root type="single" value={current} onValueChange={v => onChange(v === NONE ? '' : v)}>
    <Select.Trigger class="musician-select w-full bg-card text-[0.82rem] max-md:text-base" aria-label={$t.musicians.title}>
      {current === NONE ? noneLabel : current === '__new__' ? $t.admin.newMusician : `${$t.admin.mergeMusician}: ${musicians.find(m => m.id === current)?.musicianName ?? ''}`}
    </Select.Trigger>
    <Select.Content>
      <Select.Item value={NONE} label={noneLabel} />
      {#if withNew}<Select.Item value="__new__" label={$t.admin.newMusician} />{/if}
      {#each mergeTargets as musician (musician.id)}
        <Select.Item value={musician.id} label="{$t.admin.mergeMusician}: {musician.musicianName}" />
      {/each}
    </Select.Content>
  </Select.Root>
{/snippet}

{#snippet instrumentToggles(selected: Instrument[], toggle: (instrument: Instrument) => void)}
  <div class="instrument-buttons flex flex-wrap gap-2">
    {#each allInstruments as instrument}
      <Toggle variant="outline" class="instrument-btn p-0 data-[state=on]:border-primary-ink data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/90"
        pressed={selected.includes(instrument)} onPressedChange={() => toggle(instrument)} title={$t.instrument[instrument]} aria-label={$t.instrument[instrument]}>{INSTRUMENT_ICONS[instrument]}</Toggle>
    {/each}
  </div>
{/snippet}

{#snippet MusicianEditor()}
  <div class="musician-editor flex w-full min-w-0 flex-col items-start gap-[7px]">
    {#if $editorKind === 'attach' && mergeTargets.length > 0}
      {@render musicianSelect($draftMergeTargetId, v => ps().setDraftMergeTarget(v), $t.admin.newMusician, false)}
    {/if}
    {#if !$draftMergeTargetId}
      <Input class="bg-card text-[0.82rem] max-md:text-base" value={$draftName} oninput={event => ps().setDraftName(event.currentTarget.value)} placeholder={$t.musicians.name} aria-label={$t.musicians.name} />
      {@render instrumentToggles($draftInstruments, instrument => ps().toggleDraftInstrument(instrument))}
    {/if}
    <ButtonRow class="editor-actions">
      <Button variant="outline" class={btnCls} onclick={() => ps().cancelEditor()}>{$t.musicians.cancel}</Button>
      <Button class={btnCls} disabled={$saving !== null || (!$draftMergeTargetId && !$draftName.trim())} onclick={saveMusician}>{$t.musicians.save}</Button>
    </ButtonRow>
  </div>
{/snippet}
