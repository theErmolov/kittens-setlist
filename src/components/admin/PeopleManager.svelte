<script lang="ts">
  import { browser } from '$app/environment';
  import { addMusician, deleteMusician, getUsers, patchUser, updateMusician } from '$lib/api';
  import { t } from '$lib/i18n';
  import type { BandMusician, Instrument, User, UserRole } from '$lib/types';
  import { INSTRUMENT_ICONS } from '$lib/utils';

  let { users = $bindable() }: { users: User[] } = $props();

  const allInstruments: Instrument[] = ['guitar', 'bass', 'drums', 'keys', 'cajon', 'violin', 'percussion', 'vocals'];

  let saving = $state<string | null>(null);
  let error = $state('');
  let roleSelections = $state<Record<string, UserRole>>({});
  let approvalMusicianSelections = $state<Record<string, string>>({});
  let approvalMusicianNames = $state<Record<string, string>>({});
  let approvalMusicianInstruments = $state<Record<string, Instrument[]>>({});

  let editorKind = $state<'standalone' | 'attach' | 'edit' | null>(null);
  let editorUserId = $state<string | null>(null);
  let draftName = $state('');
  let draftInstruments = $state<Instrument[]>([]);
  let draftMergeTargetId = $state('');

  let dragId = $state<string | null>(null);
  let dragOverId = $state<string | null>(null);
  let canDrag = $state(false);

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

  $effect(() => {
    canDrag = browser && !('ontouchstart' in window);
  });

  $effect(() => {
    for (const user of users) {
      if (approvalMusicianSelections[user.id] === undefined) approvalMusicianSelections[user.id] = '';
      if (approvalMusicianNames[user.id] === undefined) approvalMusicianNames[user.id] = '';
      if (approvalMusicianInstruments[user.id] === undefined) approvalMusicianInstruments[user.id] = [];
    }
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
    const loaded = await getUsers();
    for (const user of loaded) roleSelections[user.id] = user.role ?? 'reader';
    users = loaded;
  }

  function message(errorValue: unknown): string {
    return errorValue instanceof Error ? errorValue.message : String(errorValue);
  }

  function toggleApprovalInstrument(userId: string, instrument: Instrument) {
    const current = approvalMusicianInstruments[userId] ?? [];
    approvalMusicianInstruments[userId] = current.includes(instrument)
      ? current.filter(item => item !== instrument)
      : [...current, instrument];
  }

  function toggleDraftInstrument(instrument: Instrument) {
    draftInstruments = draftInstruments.includes(instrument)
      ? draftInstruments.filter(item => item !== instrument)
      : [...draftInstruments, instrument];
  }

  async function setStatus(user: User, status: 'approved' | 'rejected') {
    saving = user.id;
    error = '';
    try {
      const patch: Parameters<typeof patchUser>[1] = {
        status,
        role: roleSelections[user.id] ?? user.role ?? 'reader',
      };
      const choice = approvalMusicianSelections[user.id] ?? '';
      if (status === 'approved' && !user.musicianName && choice === '__new__') {
        const name = approvalMusicianNames[user.id]?.trim();
        if (!name) return;
        patch.musicianName = name;
        patch.defaultInstruments = approvalMusicianInstruments[user.id] ?? [];
        patch.sortOrder = musicians.length;
      } else if (status === 'approved' && !user.musicianName && choice) {
        patch.mergeIntoUserId = choice;
      }
      await patchUser(user.id, patch);
      await refresh();
    } catch (errorValue) {
      error = message(errorValue);
    } finally {
      saving = null;
    }
  }

  async function saveRole(user: User, role: UserRole) {
    saving = user.id;
    error = '';
    try {
      await patchUser(user.id, { role });
      await refresh();
    } catch (errorValue) {
      roleSelections[user.id] = user.role ?? 'reader';
      error = message(errorValue);
    } finally {
      saving = null;
    }
  }

  function handleRoleChange(user: User, event: Event) {
    const role = (event.currentTarget as HTMLSelectElement).value as UserRole;
    roleSelections[user.id] = role;
    if (user.status === 'approved') void saveRole(user, role);
  }

  function startStandaloneMusician() {
    editorKind = 'standalone';
    editorUserId = null;
    draftName = '';
    draftInstruments = [];
    draftMergeTargetId = '';
  }

  function startAttachMusician(user: User) {
    editorKind = 'attach';
    editorUserId = user.id;
    draftName = '';
    draftInstruments = [];
    draftMergeTargetId = '';
  }

  function startEditMusician(user: User & { musicianName: string }) {
    editorKind = 'edit';
    editorUserId = user.id;
    draftName = user.musicianName;
    draftInstruments = [...(user.defaultInstruments ?? [])];
    draftMergeTargetId = '';
  }

  function cancelEditor() {
    editorKind = null;
    editorUserId = null;
  }

  async function saveMusician() {
    if (!editorKind) return;
    const operationId = editorUserId ?? '__new__';
    saving = operationId;
    error = '';
    try {
      if (editorKind === 'standalone') {
        if (!draftName.trim()) return;
        await addMusician({
          name: draftName.trim(),
          defaultInstruments: draftInstruments,
          sortOrder: musicians.length,
        });
      } else if (editorKind === 'attach' && editorUserId) {
        if (draftMergeTargetId) {
          await patchUser(editorUserId, { mergeIntoUserId: draftMergeTargetId });
        } else {
          if (!draftName.trim()) return;
          await patchUser(editorUserId, {
            musicianName: draftName.trim(),
            defaultInstruments: draftInstruments,
            sortOrder: musicians.length,
          });
        }
      } else if (editorKind === 'edit' && editorUserId) {
        const user = users.find(item => item.id === editorUserId);
        if (!user?.musicianName || !draftName.trim()) return;
        await updateMusician({
          ...asMusician(user as User & { musicianName: string }),
          name: draftName.trim(),
          defaultInstruments: draftInstruments,
        });
      }
      cancelEditor();
      await refresh();
    } catch (errorValue) {
      error = message(errorValue);
    } finally {
      saving = null;
    }
  }

  async function removeMusician(user: User & { musicianName: string }) {
    const confirmation = user.telegramId ? $t.musicians.removeConfirm : $t.musicians.deleteConfirm;
    if (!confirm(confirmation)) return;
    saving = user.id;
    error = '';
    try {
      await deleteMusician(user.id);
      await refresh();
    } catch (errorValue) {
      error = message(errorValue);
    } finally {
      saving = null;
    }
  }

  function onDragOver(event: DragEvent, id: string) {
    event.preventDefault();
    dragOverId = id;
  }

  async function onDrop(event: DragEvent) {
    event.preventDefault();
    if (!dragId || !dragOverId || dragId === dragOverId) {
      dragId = null;
      dragOverId = null;
      return;
    }
    const reordered = [...musicians];
    const from = reordered.findIndex(user => user.id === dragId);
    const to = reordered.findIndex(user => user.id === dragOverId);
    if (from < 0 || to < 0) return;
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const orderById = new Map(reordered.map((user, index) => [user.id, index]));
    users = users.map(user => orderById.has(user.id) ? { ...user, sortOrder: orderById.get(user.id) } : user);
    dragId = null;
    dragOverId = null;
    error = '';
    try {
      await Promise.all(reordered.map((user, index) => updateMusician({ ...asMusician(user), sortOrder: index })));
      await refresh();
    } catch (errorValue) {
      error = message(errorValue);
      await refresh();
    }
  }

  function statusLabel(user: User): string {
    if (user.status === 'pending') return $t.admin.pending;
    if (user.status === 'rejected') return $t.admin.rejected;
    return $t.admin.approved;
  }
</script>

<section class="people-section">
  <div class="people-title">
    <h2>{$t.admin.users}</h2>
    <button class="btn primary" onclick={startStandaloneMusician}>{$t.musicians.addBtn}</button>
  </div>

  {#if error}<p class="error">{error}</p>{/if}

  {#if editorKind === 'standalone'}
    <div class="standalone-editor">
      <MusicianEditor />
    </div>
  {/if}

  {#if users.length === 0}
    <p class="hint">{$t.admin.empty}</p>
  {:else}
    <div class="people-table">
      <div class="people-header">
        <span>{$t.admin.person}</span>
        <span>{$t.admin.role}</span>
        <span>{$t.admin.telegramAccess}</span>
        <span>{$t.musicians.title}</span>
      </div>
      {#each orderedUsers as user (user.id)}
        <div
          class="people-row"
          role="group"
          class:drag-over={dragOverId === user.id && dragId !== user.id}
          draggable={canDrag && Boolean(user.musicianName) && !editorKind}
          ondragstart={canDrag && user.musicianName ? () => { dragId = user.id; } : undefined}
          ondragover={canDrag && user.musicianName ? event => onDragOver(event, user.id) : undefined}
          ondrop={canDrag && user.musicianName ? onDrop : undefined}
          ondragend={canDrag && user.musicianName ? () => { dragId = null; dragOverId = null; } : undefined}
        >
          <div class="identity">
            {#if canDrag && user.musicianName}<span class="drag-handle" title="Drag to reorder">⠿</span>{/if}
            {#if user.photoUrl}<img class="avatar" src={user.photoUrl} alt="" />{/if}
            <div class="identity-text">
              <span class="name">{displayName(user)}</span>
              {#if user.username}<span class="hint">@{user.username}</span>{/if}
              {#if user.isAdmin}
                <span class="badge admin-badge">admin</span>
              {:else if user.telegramId}
                <span class="badge status" class:pending={user.status === 'pending'} class:rejected={user.status === 'rejected'}>{statusLabel(user)}</span>
              {/if}
            </div>
          </div>

          <div class="role-cell">
            {#if user.telegramId && !user.isAdmin}
              <select value={roleSelections[user.id] ?? user.role ?? 'reader'} class="role-select" disabled={saving === user.id}
                onchange={event => handleRoleChange(user, event)}>
                <option value="writer">Writer</option><option value="reader">Reader</option>
              </select>
            {/if}
          </div>

          <div class="access-cell">
            {#if user.telegramId && !user.isAdmin}
              {#if user.status === 'pending'}
                <button class="btn approve" disabled={saving === user.id || (approvalMusicianSelections[user.id] === '__new__' && !approvalMusicianNames[user.id]?.trim())}
                  onclick={() => setStatus(user, 'approved')}>{$t.admin.approve}</button>
                <button class="btn reject" disabled={saving === user.id} onclick={() => setStatus(user, 'rejected')}>{$t.admin.reject}</button>
              {:else if user.status === 'approved'}
                <button class="btn reject" disabled={saving === user.id} onclick={() => setStatus(user, 'rejected')}>{$t.admin.revoke}</button>
              {:else}
                <button class="btn approve" disabled={saving === user.id} onclick={() => setStatus(user, 'approved')}>{$t.admin.approve}</button>
              {/if}
            {:else if !user.telegramId}
              <span class="hint">{$t.admin.noTelegramAccess}</span>
            {/if}
          </div>

          <div class="musician-cell">
            {#if editorUserId === user.id}
              <MusicianEditor />
            {:else if user.musicianName}
              <div class="musician-summary">
                <span class="musician-name">{user.musicianName}</span>
                <span class="instrument-list">
                  {#if user.defaultInstruments?.length}
                    {#each user.defaultInstruments as instrument}
                      <span title={$t.instrument[instrument]}>{INSTRUMENT_ICONS[instrument]}</span>
                    {/each}
                  {:else}
                    <span class="hint">{$t.musicians.free}</span>
                  {/if}
                </span>
              </div>
              <div class="musician-actions">
                <button class="icon-btn" disabled={saving === user.id} onclick={() => startEditMusician(user as User & { musicianName: string })}>✏️</button>
                <button class="icon-btn delete" disabled={saving === user.id} onclick={() => removeMusician(user as User & { musicianName: string })}>🗑</button>
              </div>
            {:else if user.status === 'pending'}
              <div class="approval-musician">
                <select bind:value={approvalMusicianSelections[user.id]} class="musician-select">
                  <option value="">{$t.admin.accessOnly}</option>
                  <option value="__new__">{$t.admin.newMusician}</option>
                  {#each mergeTargets as musician}
                    <option value={musician.id}>{$t.admin.mergeMusician}: {musician.musicianName}</option>
                  {/each}
                </select>
                {#if approvalMusicianSelections[user.id] === '__new__'}
                  <input bind:value={approvalMusicianNames[user.id]} placeholder={$t.musicians.name} />
                  <div class="instrument-buttons">
                    {#each allInstruments as instrument}
                      <button class="instrument-btn" class:active={(approvalMusicianInstruments[user.id] ?? []).includes(instrument)}
                        onclick={() => toggleApprovalInstrument(user.id, instrument)} title={$t.instrument[instrument]}>{INSTRUMENT_ICONS[instrument]}</button>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else}
              <button class="btn secondary" onclick={() => startAttachMusician(user)}>{$t.admin.makeMusician}</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

{#snippet MusicianEditor()}
  <div class="musician-editor">
    {#if editorKind === 'attach' && mergeTargets.length > 0}
      <select bind:value={draftMergeTargetId} class="musician-select">
        <option value="">{$t.admin.newMusician}</option>
        {#each mergeTargets as musician}
          <option value={musician.id}>{$t.admin.mergeMusician}: {musician.musicianName}</option>
        {/each}
      </select>
    {/if}
    {#if !draftMergeTargetId}
      <input bind:value={draftName} placeholder={$t.musicians.name} />
      <div class="instrument-buttons">
        {#each allInstruments as instrument}
          <button class="instrument-btn" class:active={draftInstruments.includes(instrument)}
            onclick={() => toggleDraftInstrument(instrument)} title={$t.instrument[instrument]}>{INSTRUMENT_ICONS[instrument]}</button>
        {/each}
      </div>
    {/if}
    <div class="editor-actions">
      <button class="btn secondary" onclick={cancelEditor}>{$t.musicians.cancel}</button>
      <button class="btn primary" disabled={saving !== null || (!draftMergeTargetId && !draftName.trim())} onclick={saveMusician}>{$t.musicians.save}</button>
    </div>
  </div>
{/snippet}

<style>
  .people-section { margin-bottom: 28px; }
  .people-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  h2 { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
  .people-table { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .people-header, .people-row { display: grid; grid-template-columns: minmax(190px, 1.2fr) minmax(90px, 0.5fr) minmax(120px, 0.65fr) minmax(250px, 1.35fr); gap: 12px; align-items: center; }
  .people-header { padding: 8px 12px; background: var(--surface); color: var(--text-muted); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .people-row { padding: 11px 12px; border-top: 1px solid var(--border); background: var(--bg); }
  .people-row.drag-over { box-shadow: inset 0 2px var(--accent); }
  .identity, .role-cell, .musician-cell, .musician-summary, .musician-actions, .instrument-list, .editor-actions { display: flex; align-items: center; }
  .identity { gap: 9px; min-width: 0; }
  .identity-text { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
  .avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
  .name, .musician-name { font-weight: 650; font-size: 0.9rem; overflow-wrap: anywhere; }
  .hint { color: var(--text-muted); font-size: 0.78rem; }
  .drag-handle { color: var(--text-muted); cursor: grab; opacity: 0.55; user-select: none; }
  .badge { display: inline-block; width: fit-content; font-size: 0.65rem; padding: 2px 6px; border-radius: 5px; font-weight: 700; text-transform: uppercase; }
  .admin-badge { background: #6c63ff22; color: var(--accent); }
  .status { background: #22c55e22; color: #16a34a; }
  .status.pending { background: #f59e0b22; color: #d97706; }
  .status.rejected { background: #ef444422; color: #dc2626; }
  .role-cell { min-width: 0; }
  .access-cell, .approval-musician, .musician-editor { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; min-width: 0; }
  .musician-actions, .editor-actions { gap: 6px; }
  .musician-cell { justify-content: space-between; gap: 8px; min-width: 0; }
  .musician-summary { min-width: 0; gap: 9px; flex-wrap: wrap; }
  .instrument-list { gap: 4px; flex-wrap: wrap; }
  .standalone-editor { padding: 12px; margin-bottom: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  .musician-editor, .approval-musician { width: 100%; }
  .musician-editor input, .approval-musician input, .musician-select, .role-select { width: 100%; box-sizing: border-box; padding: 7px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 0.82rem; }
  .role-select { width: auto; }
  .instrument-buttons { display: flex; gap: 5px; flex-wrap: wrap; }
  .instrument-btn { width: 32px; height: 32px; border: 1px solid var(--border); border-radius: 7px; background: transparent; cursor: pointer; }
  .instrument-btn.active { background: var(--accent); border-color: var(--accent); }
  .btn { padding: 6px 11px; border-radius: 6px; border: 0; font-size: 0.79rem; font-weight: 650; cursor: pointer; white-space: nowrap; }
  .btn:disabled, .icon-btn:disabled { opacity: 0.45; cursor: default; }
  .btn.primary { background: var(--accent); color: #fff; }
  .btn.secondary { color: var(--text); background: var(--surface); border: 1px solid var(--border); }
  .btn.approve { background: #22c55e; color: #fff; }
  .btn.reject { background: #e05252; color: #fff; }
  .icon-btn { width: 50px; height: 50px; box-sizing: border-box; background: none; border: 0; cursor: pointer; padding: 6px; font-size: 2.4rem; line-height: 1; opacity: 0.7; }
  .icon-btn:hover { opacity: 1; }
  .icon-btn.delete:hover { color: #ef4444; }
  .error { color: #dc2626; font-size: 0.82rem; margin-bottom: 8px; }

  @media (max-width: 760px) {
    .people-section { margin-bottom: 18px; }
    .people-title { gap: 8px; margin-bottom: 8px; }
    .people-title .btn { padding: 5px 8px; font-size: 0.7rem; }
    .people-header { display: none; }
    .people-row {
      grid-template-columns: minmax(0, 1fr) auto auto;
      grid-template-areas:
        "identity role access"
        "musician musician musician";
      column-gap: 6px;
      row-gap: 7px;
      padding: 8px 9px;
    }
    .people-row:first-child { border-top: 0; }
    .identity { grid-area: identity; gap: 7px; }
    .avatar { width: 32px; height: 32px; }
    .identity-text { gap: 0; }
    .name, .musician-name { font-size: 0.82rem; }
    .identity .hint { font-size: 0.7rem; line-height: 1.1; }
    .badge { padding: 1px 5px; font-size: 0.56rem; }
    .role-cell { grid-area: role; align-self: start; }
    .access-cell { grid-area: access; align-self: start; gap: 4px; }
    .musician-cell { grid-area: musician; min-height: 30px; padding-left: 0; }
    .musician-summary { gap: 7px; }
    .instrument-list { gap: 3px; font-size: 0.95rem; }
    .musician-actions { gap: 2px; }
    .icon-btn { width: 30px; height: 30px; padding: 4px; font-size: 1.2rem; }
    .access-cell .btn { min-height: 30px; padding: 4px 7px; font-size: 0.7rem; }
    .musician-editor input, .approval-musician input, .musician-select { font-size: 16px; }
    .role-select { width: 78px; height: 30px; padding: 2px 5px; font-size: 16px; }
  }
</style>
