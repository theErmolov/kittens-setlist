<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import PeopleManager from '$components/admin/PeopleManager.svelte';
  import { lang, t } from '$lib/i18n';
  import { currentUser, authLoading } from '$lib/auth';
  import { getUsers, getAuditLog } from '$lib/api';
  import type { User, AuditLogEntry } from '$lib/types';
  import { formatAuditSummary } from '$lib/utils';

  let users = $state<User[]>([]);
  let loading = $state(true);
  let dataLoaded = $state(false);

  $effect(() => {
    if ($authLoading || dataLoaded) return;
    if (!$currentUser?.isAdmin) { goto(`${base}/backlog`); return; }
    dataLoaded = true;
    getUsers().then(loadedUsers => {
      users = loadedUsers;
      loading = false;
    });
  });

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
    return new Date(timestamp).toLocaleString($lang === 'ru' ? 'ru-RU' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

</script>

<div class="admin">
  <h1>{$t.admin.title}</h1>
  {#if loading}
    <p class="hint">…</p>
  {:else}
    <PeopleManager bind:users />

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
              <span><span class="entity-type">{$t.admin.auditEntities[entry.entityType]}</span>{entry.entityName}</span>
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
  .hint { font-size: 0.8rem; color: var(--text-muted); }
  .page-size-select { padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 0.85rem; }
  .audit-section { margin-top: 36px; }
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
    .audit-row { grid-template-columns: 1fr 1fr; }
    .audit-header-row { display: none; }
  }
</style>
