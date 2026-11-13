<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { currentUser, authLoading } from '$lib/auth';
  import { t } from '$lib/i18n';
  import * as NavigationMenu from '$components/ui/navigation-menu';

  let { children } = $props();
  const path = $derived(page.url.pathname.slice(base.length));

  $effect(() => {
    if ($authLoading) return;
    if (!$currentUser?.isAdmin) goto(`${base}/backlog`);
  });
</script>

{#snippet navLink(href: string, label: string, active: boolean, external = false)}
  <NavigationMenu.Item>
    <NavigationMenu.Link {href} {active} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      class="px-3 py-2 text-body font-semibold text-muted-foreground hover:bg-accent hover:text-foreground data-active:bg-primary-soft data-active:text-primary-ink data-active:hover:bg-primary-soft">
      {label}{#if external}&nbsp;<span aria-hidden="true">↗</span>{/if}
    </NavigationMenu.Link>
  </NavigationMenu.Item>
{/snippet}

{#if $currentUser?.isAdmin}
  <div class="page-shell max-mid:px-0 [&_[data-slot=table-container]]:-mx-4 [&_[data-slot=table-container]]:w-[calc(100%+2rem)] max-mid:[&_[data-slot=table-container]]:mx-0 max-mid:[&_[data-slot=table-container]]:w-full">
    <header>
      <NavigationMenu.Root viewport={false} class="admin-nav max-w-none justify-start border-b pb-3" aria-label={$t.admin.title}>
        <NavigationMenu.List class="flex-wrap justify-start gap-1.5">
          {@render navLink(`${base}/admin`, $t.admin.users, path === '/admin' || path === '/admin/')}
          {@render navLink(`${base}/admin/audit`, $t.admin.auditLog, path.startsWith('/admin/audit'))}
          {@render navLink(`${base}/admin/budget`, $t.nav.budget, path.startsWith('/admin/budget'))}
          {@render navLink('https://antispam.kittens.band/', $t.nav.antispam, false, true)}
        </NavigationMenu.List>
      </NavigationMenu.Root>
    </header>
    <div class="admin-content pt-6">
      {@render children()}
    </div>
  </div>
{/if}
