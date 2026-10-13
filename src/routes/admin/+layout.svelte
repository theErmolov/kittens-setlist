<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { currentUser, authLoading } from '$lib/auth';
  import { t } from '$lib/i18n';

  let { children } = $props();
  const path = $derived(page.url.pathname.slice(base.length));

  $effect(() => {
    if ($authLoading) return;
    if (!$currentUser?.isAdmin) goto(`${base}/backlog`);
  });
</script>

{#if $currentUser?.isAdmin}
  <div class="admin-shell">
    <header>
      <nav class="admin-nav" aria-label={$t.admin.title}>
        <a href="{base}/admin" class:active={path === '/admin' || path === '/admin/'} aria-current={path === '/admin' || path === '/admin/' ? 'page' : undefined}>{$t.admin.users}</a>
        <a href="{base}/admin/audit" class:active={path.startsWith('/admin/audit')} aria-current={path.startsWith('/admin/audit') ? 'page' : undefined}>{$t.admin.auditLog}</a>
        <a href="{base}/admin/budget" class:active={path.startsWith('/admin/budget')} aria-current={path.startsWith('/admin/budget') ? 'page' : undefined}>{$t.nav.budget}</a>
        <a href="https://antispam.kittens.band/" target="_blank" rel="noopener noreferrer">{$t.nav.antispam} <span aria-hidden="true">↗</span></a>
      </nav>
    </header>
    <div class="admin-content">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .admin-shell { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
  .admin-content { padding-top: 24px; }
  .admin-nav { display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  a { padding: 8px 12px; border-radius: 6px; color: var(--text-muted); text-decoration: none; font-size: 0.85rem; font-weight: 600; }
  a:hover { background: var(--row-hover); color: var(--text); }
  a.active { background: var(--chip-bg); color: var(--accent); }
  a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
