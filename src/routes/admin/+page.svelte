<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import RosterManager from '$components/admin/RosterManager.svelte';
  import { t } from '$lib/i18n';
  import { currentUser, authLoading } from '$lib/auth';
  import { getUsers, patchUser, getMusicians, getAuditLog } from '$lib/api';
  import type { User, BandMusician, Instrument, UserRole, AuditLogEntry } from '$lib/types';
  import { formatAuditSummary, INSTRUMENT_ICONS } from '$lib/utils';

  const allInstruments: Instrument[] = ['guitar', 'bass', 'drums', 'keys', 'cajon', 'violin', 'percussion', 'vocals'];

  let users = $state<User[]>([]);
  let musicians = $state<BandMusician[]>([]);
  let loading = $state(true);
  let saving = $state<string | null>(null);
  let roleSelections = $state<Record<string, UserRole>>({});
  let musicianSelections = $state<Record<string, string>>({});
  let newMusicianNames = $state<Record<string, string>>({});
  let newMusicianInstruments = $state<Record<string, Instrument[]>>({});
  let dataLoaded = $state(false);

  $effect(() => {
    if ($authLoading || dataLoaded) return;
    if (!$currentUser?.isAdmin) { goto(`${base}/backlog`); return; }
    dataLoaded = true;
    Promise.all([getUsers(), getMusicians()]).then(([loadedUsers, loadedMusicians]) => {
      users = loadedUsers;
      musicians = loadedMusicians;
      for (const user of loadedUsers) {
        roleSelections[user.id] = user.role ?? 'reader';
        musicianSelections[user.id] = '';
        newMusicianNames[user.id] = '';
        newMusicianInstruments[user.id] = [];
      }
      loading = false;
    });
  });

  function displayName(user: User): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.musicianName || user.id;
  }

  function replaceUsers(sourceId: string, updated: User) {
    users = [...users.filter(user => user.id !== sourceId && user.id !== updated.id), updated];
    roleSelections[updated.id] = updated.role ?? 'reader';
  }

  function toggleNewInstrument(userId: string, instrument: Instrument) {
    const current = newMusicianInstruments[userId] ?? [];
    newMusicianInstruments[userId] = current.includes(instrument)
      ? current.filter(item => item !== instrument)
      : [...current, instrument];
  }

  async function setStatus(user: User, status: 'approved' | 'rejected') {
    saving = user.id;
    try {
      const choice = musicianSelections[user.id] ?? '';
      const patch = { status, role: roleSelections[user.id] ?? 'reader' } as Parameters<typeof patchUser>[1];
      if (status === 'approved' && choice === '__new__') {
        const name = newMusicianNames[user.id]?.trim();
        if (!name) return;
        patch.musicianName = name;
        patch.defaultInstruments = newMusicianInstruments[user.id] ?? [];
        patch.sortOrder = musicians.length;
      } else if (status === 'approved' && choice) {
        patch.mergeIntoUserId = choice;
      }
      const updated = await patchUser(user.id, patch);
      replaceUsers(user.id, updated);
      if (patch.musicianName || patch.mergeIntoUserId) musicians = await getMusicians();
    } finally {
      saving = null;
    }
  }

  async function saveRole(user: User) {
    saving = user.id;
    try {
      const updated = await patchUser(user.id, { role: roleSelections[user.id] ?? 'reader' });
      replaceUsers(user.id, updated);
    } finally {
      saving = null;
    }
  }

  async function refreshUsers() {
    users = await getUsers();
  }

  let accessUsers = $derived(users.filter(user => Boolean(user.telegramId)));
  let pending = $derived(accessUsers.filter(user => user.status === 'pending'));
  let approved = $derived(accessUsers.filter(user => user.status === 'approved'));
  let rejected = $derived(accessUsers.filter(user => user.status === 'rejected'));
  let mergeTargets = $derived(users.filter(user => user.musicianName && !user.telegramId));

  let auditPageSize = $state(20);
  let auditItems = $state<AuditLogEntry[]>([]);
  let auditCursorStack = $state<string[]>([]);
  let auditNextCursor = $state<string | undefined>(undefined);
  let auditLoading = $state(false);

  async function loadAuditPage(cursor?: string) {
    auditLoading = true;
    try {
      const result = await getAuditLog(auditPageSize, cursor);
      auditItems = result.items;
      auditNextCursor = result.nextCursor;
    } finally {
      auditLoading = false;
    }
  }

  $effect(() => {
    const _size = auditPageSize;
    if ($authLoading || !$currentUser?.isAdmin) return;
    auditCursorStack = [];
    auditNextCursor = undefined;
    loadAuditPage();
  });

  function auditNext() {
    if (!auditNextCursor) return;
    auditCursorStack = [...auditCursorStack, auditNextCursor];
    loadAuditPage(auditNextCursor);
  }

  function auditPrev() {
    const stack = [...auditCursorStack];
    stack.pop();
    auditCursorStack = stack;
    loadAuditPage(stack[stack.length - 1]);
  }

  function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  const entityTypeLabel: Record<AuditLogEntry['entityType'], string> = {
    song: 'Песня', setlist: 'Сетлист', musician: 'Музыкант', setlist_entry: 'Запись', user: 'Пользователь'
  };
</script>

<div class="admin">
  <h1>{$t.admin.title}</h1>
  {#if loading}
    <p class="hint">…</p>
  {:else}
    {#if pending.length > 0}
      <section>
        <h2>{$t.admin.pending}</h2>
        {#each pending as user (user.id)}
          <div class="user-row pending-row">
            <div class="identity">
              {#if user.photoUrl}<img class="avatar" src={user.photoUrl} alt="" />{/if}
              <div class="user-info">
                <span class="name">{displayName(user)}</span>
                {#if user.username}<span class="username">@{user.username}</span>{/if}
              </div>
            </div>
            <div class="approval-options">
              <select bind:value={musicianSelections[user.id]} class="musician-select">
                <option value="">{$t.admin.accessOnly}</option>
                <option value="__new__">{$t.admin.newMusician}</option>
                {#each mergeTargets as musician}
                  <option value={musician.id}>{$t.admin.mergeMusician}: {musician.musicianName}</option>
                {/each}
              </select>
              {#if musicianSelections[user.id] === '__new__'}
                <input class="musician-name" bind:value={newMusicianNames[user.id]} placeholder={$t.musicians.name} />
                <div class="inst-row">
                  {#each allInstruments as instrument}
                    <button class="inst-btn" class:active={(newMusicianInstruments[user.id] ?? []).includes(instrument)}
                      onclick={() => toggleNewInstrument(user.id, instrument)} title={$t.instrument[instrument]}>{INSTRUMENT_ICONS[instrument]}</button>
                  {/each}
                </div>
              {/if}
            </div>
            <select bind:value={roleSelections[user.id]} class="role-select">
              <option value="writer">Writer</option><option value="reader">Reader</option>
            </select>
            <div class="actions">
              <button class="btn approve" disabled={saving === user.id || (musicianSelections[user.id] === '__new__' && !newMusicianNames[user.id]?.trim())}
                onclick={() => setStatus(user, 'approved')}>{$t.admin.approve}</button>
              <button class="btn reject" disabled={saving === user.id}
                onclick={() => setStatus(user, 'rejected')}>{$t.admin.reject}</button>
            </div>
          </div>
        {/each}
      </section>
    {/if}

    <section>
      <h2>{$t.admin.approved}</h2>
      {#if approved.length === 0}<p class="hint">{$t.admin.empty}</p>{/if}
      {#each approved as user (user.id)}
        <div class="user-row">
          {#if user.photoUrl}<img class="avatar" src={user.photoUrl} alt="" />{/if}
          <div class="user-info">
            <span class="name">{displayName(user)}</span>
            {#if user.username}<span class="username">@{user.username}</span>{/if}
            {#if user.musicianName}<span class="username">{user.musicianName}</span>{/if}
            {#if user.isAdmin}<span class="badge admin-badge">admin</span>{/if}
          </div>
          {#if !user.isAdmin}
            <select bind:value={roleSelections[user.id]} class="role-select" onchange={() => saveRole(user)}>
              <option value="writer">Writer</option><option value="reader">Reader</option>
            </select>
            <button class="btn reject" disabled={saving === user.id} onclick={() => setStatus(user, 'rejected')}>{$t.admin.revoke}</button>
          {/if}
        </div>
      {/each}
    </section>

    {#if rejected.length > 0}
      <section>
        <h2>{$t.admin.rejected}</h2>
        {#each rejected as user (user.id)}
          <div class="user-row">
            {#if user.photoUrl}<img class="avatar" src={user.photoUrl} alt="" />{/if}
            <div class="user-info"><span class="name">{displayName(user)}</span>{#if user.username}<span class="username">@{user.username}</span>{/if}</div>
            <button class="btn approve" disabled={saving === user.id} onclick={() => setStatus(user, 'approved')}>{$t.admin.approve}</button>
          </div>
        {/each}
      </section>
    {/if}

    <section class="roster-section"><RosterManager bind:musicians onchange={refreshUsers} /></section>

    <section class="audit-section">
      <div class="audit-header">
        <h2>{$t.admin.auditLog}</h2>
        <select bind:value={auditPageSize} class="page-size-select"><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select>
      </div>
      {#if auditLoading}<p class="hint">…</p>
      {:else if auditItems.length === 0}<p class="hint">{$t.admin.auditEmpty}</p>
      {:else}
        <div class="audit-table">
          <div class="audit-row audit-header-row"><span>{$t.admin.auditWhen}</span><span>{$t.admin.auditWho}</span><span>{$t.admin.auditEntity}</span><span>{$t.admin.auditDetails}</span></div>
          {#each auditItems as entry (entry.sk)}
            <div class="audit-row">
              <span class="audit-when">{formatTimestamp(entry.timestamp)}</span><span class="audit-who">{entry.actorName}</span>
              <span><span class="entity-type">{entityTypeLabel[entry.entityType]}</span>{entry.entityName}</span>
              <span class="audit-details">{formatAuditSummary(entry.summary)}</span>
            </div>
          {/each}
        </div>
        <div class="audit-nav">
          <button class="btn btn-nav" disabled={auditCursorStack.length === 0} onclick={auditPrev}>{$t.admin.auditPrev}</button>
          <button class="btn btn-nav" disabled={!auditNextCursor} onclick={auditNext}>{$t.admin.auditNext}</button>
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .admin { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 1.4rem; font-weight: 800; margin-bottom: 24px; }
  h2 { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 8px; }
  section { margin-bottom: 28px; }
  .user-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 6px; }
  .pending-row { align-items: flex-start; }
  .identity { display: flex; align-items: center; gap: 10px; min-width: 180px; }
  .avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
  .user-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .name { font-weight: 600; font-size: 0.95rem; }
  .username, .hint { font-size: 0.8rem; color: var(--text-muted); }
  .badge { display: inline-block; font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
  .admin-badge { background: #6c63ff22; color: var(--accent); width: fit-content; }
  .approval-options { flex: 1; display: flex; flex-direction: column; gap: 7px; }
  .musician-select, .role-select, .page-size-select, .musician-name { padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 0.85rem; }
  .inst-row { display: flex; gap: 5px; flex-wrap: wrap; }
  .inst-btn { width: 32px; height: 32px; border: 1px solid var(--border); border-radius: 7px; background: transparent; cursor: pointer; }
  .inst-btn.active { background: var(--accent); border-color: var(--accent); }
  .actions { display: flex; gap: 6px; }
  .btn { padding: 5px 12px; border-radius: 6px; border: none; font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn.approve { background: #22c55e; color: #fff; }
  .btn.reject { background: #e05252; color: #fff; }
  .roster-section, .audit-section { margin-top: 36px; }
  .audit-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .audit-header h2 { margin: 0; }
  .audit-table { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .audit-row { display: grid; grid-template-columns: 9rem 7rem 1fr 1fr; gap: 8px; padding: 8px 12px; font-size: 0.83rem; border-bottom: 1px solid var(--border); }
  .audit-row:last-child { border-bottom: 0; }
  .audit-header-row { background: var(--surface); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); }
  .audit-when, .audit-details { color: var(--text-muted); }
  .audit-when { white-space: nowrap; }
  .audit-who { font-weight: 600; }
  .entity-type { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: var(--accent); margin-right: 4px; }
  .audit-details { word-break: break-word; }
  .audit-nav { display: flex; gap: 8px; margin-top: 10px; }
  .btn-nav { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
  @media (max-width: 700px) {
    .user-row, .identity { flex-wrap: wrap; }
    .pending-row { flex-direction: column; }
    .identity, .approval-options { width: 100%; }
    .actions { align-self: stretch; }
    .actions .btn { flex: 1; }
    .audit-row { grid-template-columns: 1fr 1fr; }
    .audit-header-row { display: none; }
  }
</style>
