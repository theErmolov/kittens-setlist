<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { t } from '$lib/i18n';
  import { currentUser, authLoading } from '$lib/auth';
  import { getUsers, patchUser, getMusicians, getAuditLog } from '$lib/api';
  import type { KittensUser, BandMusician, UserRole, AuditLogEntry } from '$lib/types';
  import { formatAuditSummary } from '$lib/utils';

  let users = $state<KittensUser[]>([]);
  let musicians = $state<BandMusician[]>([]);
  let loading = $state(true);
  let saving = $state<string | null>(null); // telegramId of user being saved

  // Map of telegramId → selected musicianId (local edit state)
  let musicianSelections = $state<Record<string, string>>({});
  // Map of telegramId → selected role
  let roleSelections = $state<Record<string, UserRole>>({});

  let dataLoaded = $state(false);

  $effect(() => {
    if ($authLoading || dataLoaded) return;
    if (!$currentUser?.isAdmin) { goto(`${base}/backlog`); return; }
    dataLoaded = true;
    Promise.all([getUsers(), getMusicians()]).then(([u, m]) => {
      users = u;
      musicians = m;
      for (const user of u) {
        musicianSelections[user.telegramId] = user.musicianId ?? '';
        roleSelections[user.telegramId] = user.role ?? 'reader';
      }
      loading = false;
    });
  });

  async function setStatus(user: KittensUser, status: 'approved' | 'rejected') {
    saving = user.telegramId;
    const musicianId = musicianSelections[user.telegramId] || null;
    const role = roleSelections[user.telegramId] ?? 'writer';
    const updated = await patchUser(user.telegramId, { status, role, ...(musicianId ? { musicianId } : { musicianId: null }) });
    users = users.map(u => u.telegramId === updated.telegramId ? updated : u);
    saving = null;
  }

  async function saveMusician(user: KittensUser) {
    saving = user.telegramId;
    const musicianId = musicianSelections[user.telegramId] || null;
    const updated = await patchUser(user.telegramId, { musicianId });
    users = users.map(u => u.telegramId === updated.telegramId ? updated : u);
    saving = null;
  }

  async function saveRole(user: KittensUser) {
    saving = user.telegramId;
    const role = roleSelections[user.telegramId] ?? 'writer';
    const updated = await patchUser(user.telegramId, { role });
    users = users.map(u => u.telegramId === updated.telegramId ? updated : u);
    saving = null;
  }

  let pending = $derived(users.filter(u => u.status === 'pending'));
  let approved = $derived(users.filter(u => u.status === 'approved'));
  let rejected = $derived(users.filter(u => u.status === 'rejected'));

  // ─── Audit log ────────────────────────────────────────────────────────────
  let auditPageSize = $state(20);
  let auditItems = $state<AuditLogEntry[]>([]);
  let auditCursorStack = $state<string[]>([]); // stack of cursors used to get to each page (for Prev)
  let auditNextCursor = $state<string | undefined>(undefined);
  let auditLoading = $state(false);

  async function loadAuditPage(cursor?: string) {
    auditLoading = true;
    try {
      const res = await getAuditLog(auditPageSize, cursor);
      auditItems = res.items;
      auditNextCursor = res.nextCursor;
    } finally {
      auditLoading = false;
    }
  }

  $effect(() => {
    const _size = auditPageSize; // track page size changes
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
    stack.pop(); // remove the cursor that brought us to the current page
    const cursor = stack[stack.length - 1]; // cursor before that = start of current page - 1
    auditCursorStack = stack;
    loadAuditPage(cursor);
  }

  function formatTimestamp(ts: string) {
    return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const entityTypeLabel: Record<AuditLogEntry['entityType'], string> = {
    song: 'Песня',
    setlist: 'Сетлист',
    musician: 'Музыкант',
    setlist_entry: 'Запись',
    user: 'Пользователь',
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
        {#each pending as user (user.telegramId)}
          <div class="user-row">
            {#if user.photoUrl}<img class="avatar" src={user.photoUrl} alt="" />{/if}
            <div class="user-info">
              <span class="name">{user.firstName}{user.lastName ? ' ' + user.lastName : ''}</span>
              {#if user.username}<span class="username">@{user.username}</span>{/if}
            </div>
            <select bind:value={musicianSelections[user.telegramId]} class="musician-select">
              <option value="">{$t.admin.noMusician}</option>
              {#each musicians as m}
                <option value={m.id}>{m.name}</option>
              {/each}
            </select>
            <select bind:value={roleSelections[user.telegramId]} class="role-select">
              <option value="writer">Writer</option>
              <option value="reader">Reader</option>
            </select>
            <button class="btn approve" disabled={saving === user.telegramId}
              onclick={() => setStatus(user, 'approved')}>{$t.admin.approve}</button>
            <button class="btn reject" disabled={saving === user.telegramId}
              onclick={() => setStatus(user, 'rejected')}>{$t.admin.reject}</button>
          </div>
        {/each}
      </section>
    {/if}

    <section>
      <h2>{$t.admin.approved}</h2>
      {#if approved.length === 0}
        <p class="hint">{$t.admin.empty}</p>
      {:else}
        {#each approved as user (user.telegramId)}
          <div class="user-row">
            {#if user.photoUrl}<img class="avatar" src={user.photoUrl} alt="" />{/if}
            <div class="user-info">
              <span class="name">{user.firstName}{user.lastName ? ' ' + user.lastName : ''}</span>
              {#if user.username}<span class="username">@{user.username}</span>{/if}
              {#if user.isAdmin}<span class="badge admin-badge">admin</span>{/if}
            </div>
            <select bind:value={musicianSelections[user.telegramId]} class="musician-select"
              onchange={() => saveMusician(user)}>
              <option value="">{$t.admin.noMusician}</option>
              {#each musicians as m}
                <option value={m.id}>{m.name}</option>
              {/each}
            </select>
            {#if !user.isAdmin}
              <select bind:value={roleSelections[user.telegramId]} class="role-select"
                onchange={() => saveRole(user)}>
                <option value="writer">Writer</option>
                <option value="reader">Reader</option>
              </select>
              <button class="btn reject" disabled={saving === user.telegramId}
                onclick={() => setStatus(user, 'rejected')}>{$t.admin.revoke}</button>
            {/if}
          </div>
        {/each}
      {/if}
    </section>

    {#if rejected.length > 0}
      <section>
        <h2>{$t.admin.rejected}</h2>
        {#each rejected as user (user.telegramId)}
          <div class="user-row">
            {#if user.photoUrl}<img class="avatar" src={user.photoUrl} alt="" />{/if}
            <div class="user-info">
              <span class="name">{user.firstName}{user.lastName ? ' ' + user.lastName : ''}</span>
              {#if user.username}<span class="username">@{user.username}</span>{/if}
            </div>
            <button class="btn approve" disabled={saving === user.telegramId}
              onclick={() => setStatus(user, 'approved')}>{$t.admin.approve}</button>
          </div>
        {/each}
      </section>
    {/if}

    <section class="audit-section">
      <div class="audit-header">
        <h2>{$t.admin.auditLog}</h2>
        <select bind:value={auditPageSize} class="page-size-select">
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      {#if auditLoading}
        <p class="hint">…</p>
      {:else if auditItems.length === 0}
        <p class="hint">{$t.admin.auditEmpty}</p>
      {:else}
        <div class="audit-table">
          <div class="audit-row audit-header-row">
            <span>{$t.admin.auditWhen}</span>
            <span>{$t.admin.auditWho}</span>
            <span>{$t.admin.auditEntity}</span>
            <span>{$t.admin.auditDetails}</span>
          </div>
          {#each auditItems as entry (entry.sk)}
            <div class="audit-row">
              <span class="audit-when">{formatTimestamp(entry.timestamp)}</span>
              <span class="audit-who">{entry.actorName}</span>
              <span class="audit-entity">
                <span class="entity-type">{entityTypeLabel[entry.entityType]}</span>
                {entry.entityName}
              </span>
              <span class="audit-details">{formatAuditSummary(entry.summary)}</span>
            </div>
          {/each}
        </div>

        <div class="audit-nav">
          <button class="btn btn-nav" disabled={auditCursorStack.length === 0} onclick={auditPrev}>
            {$t.admin.auditPrev}
          </button>
          <button class="btn btn-nav" disabled={!auditNextCursor} onclick={auditNext}>
            {$t.admin.auditNext}
          </button>
        </div>
      {/if}
    </section>

  {/if}
</div>

<style>
  .admin {
    max-width: 720px;
    margin: 0 auto;
    padding: 24px 16px;
  }

  h1 {
    font-size: 1.4rem;
    font-weight: 800;
    margin-bottom: 24px;
  }

  h2 {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  section {
    margin-bottom: 28px;
  }

  .user-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 6px;
  }

  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .user-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .username {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .badge {
    display: inline-block;
    font-size: 0.7rem;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .admin-badge {
    background: #6c63ff22;
    color: var(--accent);
    width: fit-content;
  }

  .musician-select, .role-select {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.85rem;
  }

  .btn {
    padding: 5px 12px;
    border-radius: 6px;
    border: none;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }
  .btn:disabled { opacity: 0.5; cursor: default; }

  .btn.approve {
    background: #22c55e;
    color: #fff;
  }

  .btn.reject {
    background: #e05252;
    color: #fff;
  }

  .hint {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .audit-section {
    margin-top: 36px;
  }

  .audit-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .audit-header h2 {
    margin-bottom: 0;
  }

  .page-size-select {
    padding: 3px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.82rem;
  }

  .audit-table {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .audit-row {
    display: grid;
    grid-template-columns: 9rem 7rem 1fr 1fr;
    gap: 8px;
    padding: 8px 12px;
    font-size: 0.83rem;
    border-bottom: 1px solid var(--border);
    align-items: baseline;
  }

  .audit-row:last-child {
    border-bottom: none;
  }

  .audit-header-row {
    background: var(--surface);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .audit-when {
    color: var(--text-muted);
    white-space: nowrap;
  }

  .audit-who {
    font-weight: 600;
  }

  .entity-type {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--accent);
    margin-right: 4px;
  }

  .audit-details {
    color: var(--text-muted);
    word-break: break-word;
  }

  .audit-nav {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .btn-nav {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 5px 14px;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-nav:disabled {
    opacity: 0.4;
    cursor: default;
  }

  @media (max-width: 600px) {
    .audit-row {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto;
    }

    .audit-header-row {
      display: none;
    }
  }
</style>
