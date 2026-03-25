<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { t } from '$lib/i18n';
  import { currentUser, authLoading } from '$lib/auth';
  import { getUsers, patchUser, getMusicians } from '$lib/api';
  import type { KittensUser, BandMusician } from '$lib/types';

  let users = $state<KittensUser[]>([]);
  let musicians = $state<BandMusician[]>([]);
  let loading = $state(true);
  let saving = $state<string | null>(null); // telegramId of user being saved

  // Map of telegramId → selected musicianId (local edit state)
  let musicianSelections = $state<Record<string, string>>({});

  let dataLoaded = $state(false);

  $effect(() => {
    if ($authLoading || dataLoaded) return;
    if (!$currentUser?.isAdmin) { goto(`${base}/backlog`); return; }
    dataLoaded = true;
    Promise.all([getUsers(), getMusicians()]).then(([u, m]) => {
      users = u;
      musicians = m;
      for (const user of u) musicianSelections[user.telegramId] = user.musicianId ?? '';
      loading = false;
    });
  });

  async function setStatus(user: KittensUser, status: 'approved' | 'rejected') {
    saving = user.telegramId;
    const musicianId = musicianSelections[user.telegramId] || null;
    const updated = await patchUser(user.telegramId, { status, ...(musicianId ? { musicianId } : { musicianId: null }) });
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

  let pending = $derived(users.filter(u => u.status === 'pending'));
  let approved = $derived(users.filter(u => u.status === 'approved'));
  let rejected = $derived(users.filter(u => u.status === 'rejected'));
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

  .musician-select {
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
</style>
