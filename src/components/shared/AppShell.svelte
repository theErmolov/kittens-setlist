<script lang="ts">
  /** True under `npm run dev` with `VITE_DEV_MOCK=1` (see src/hooks.client.ts). */
  const devMock = import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK === '1';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import twemoji from '@twemoji/api';
  import { createQuery } from '@tanstack/svelte-query';
  import LogoCat from '$components/shared/LogoCat.svelte';
  import { Button } from '$components/ui/button';
  import * as NavigationMenu from '$components/ui/navigation-menu';
  import * as Tooltip from '$components/ui/tooltip';
  import IconButton from '$components/shared/IconButton.svelte';
  import RowActions from '$components/shared/RowActions.svelte';
  import { Alert } from '$components/ui/alert';
  import { lang, t } from '$lib/i18n';
  import { currentUser, authLoading, canAccessRehearsals, initAuth, setCachedNavFlags } from '$lib/auth';
  import { usersQuery } from '$lib/query/queries';
  import { presenceIndicator } from '$lib/presence';
  import { useLogout } from '$lib/query/auth';
  import { useStore } from '$lib/store/bridge';
  import { accessDenied } from '$lib/query/client';
  import { settingsStore } from '$lib/store/settings';
  import { navStore } from '$lib/store/shell';

  let { children } = $props();

  const theme = useStore(settingsStore, s => s.theme);
  const navIsAdmin = useStore(navStore, s => s.isAdmin);
  const navCanAccessRehearsals = useStore(navStore, s => s.canAccessRehearsals);
  const navLoggedIn = useStore(navStore, s => s.loggedIn);
  const dark = $derived($theme === 'dark');

  // Nav extra (pending dot): a refusal must not raise the page-level "no access" notice.
  const users = createQuery(() => ({ ...usersQuery(), enabled: $currentUser?.isAdmin === true, meta: { ignoreForbidden: true } }));
  const hasPending = $derived(users.data?.some(u => u.status === 'pending') ?? false);

  onMount(() => {
    const opts = { base: `${base}/emoji/`, folder: '.', ext: '.svg' };
    const parse = (node: Element) => twemoji.parse(node as HTMLElement, opts);
    parse(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) parse(node as Element);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    void initAuth();
    return () => observer.disconnect();
  });

  // Normalize the pathname for active navigation checks.
  let path = $derived(page.url.pathname.slice(base.length) || '/');

  const presenceTitle = $derived(
    $presenceIndicator.state === 'withOthers'
      ? $t.common.presenceOthers
      : $t.common.presenceAlone,
  );

  // Auth guard: redirect to /login unless on login page or stage view
  $effect(() => {
    if (!browser || $authLoading) return;
    const isLoginPage = path.startsWith('/login');
    const isStage = path.includes('/stage');
    if (!isLoginPage && !isStage && $currentUser === null) {
      goto(`${base}/login`);
    }
  });

  // Sync the cached nav flags to the real auth state once it resolves, so the
  // first paint (from cache) is corrected if anything changed since last visit.
  $effect(() => {
    if (!browser || $authLoading) return;
    const u = $currentUser;
    const isAdmin = u?.isAdmin === true;
    const loggedIn = u !== null;
    navStore.getState().setFlags({ isAdmin, loggedIn, canAccessRehearsals: $canAccessRehearsals });
    setCachedNavFlags({ isAdmin, loggedIn, canAccessRehearsals: $canAccessRehearsals });
  });

  function toggleTheme() {
    settingsStore.getState().setTheme(dark ? 'light' : 'dark');
  }

  function toggleLang() {
    $lang = $lang === 'ru' ? 'en' : 'ru';
  }

  const logoutM = useLogout();
  async function handleLogout() {
    await logoutM.mutateAsync();
    goto(`${base}/login`);
  }

  $effect(() => {
    if (!browser) return;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.lang = $lang;
  });
</script>

<svelte:head>
  <title>{$t.common.appTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="apple-mobile-web-app-title" content={$t.common.bandName} />
</svelte:head>

{#snippet tip(label: string, trigger: import('svelte').Snippet<[Record<string, unknown>]>)}
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}{@render trigger(props)}{/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>{label}</Tooltip.Content>
  </Tooltip.Root>
{/snippet}

{#snippet navItem(href: string, active: boolean, icon: string, label: string, inIcon?: import('svelte').Snippet, after?: import('svelte').Snippet, external = false)}
  <NavigationMenu.Item class="h-full max-mid:min-w-0 max-mid:flex-1">
    <NavigationMenu.Link
      {href}
      active={active}
      class="h-full gap-1.25 rounded-none px-3.5 text-body-lg font-medium text-muted-foreground hover:bg-primary-soft hover:text-foreground focus:bg-transparent focus-visible:ring-inset data-active:bg-primary data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground data-active:focus:bg-primary max-mid:w-full max-mid:justify-center max-mid:p-0 max-mid:text-title"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <span class="link-icon relative shrink-0 text-base leading-none max-mid:text-[1.25rem]">{icon}{@render inIcon?.()}</span>
      <span class="link-label max-mid:hidden">{label}</span>
      <!-- A link that leaves the app gets the same ↗ as the admin tabs. -->
      {#if external}<span class="text-muted-foreground max-mid:hidden" aria-hidden="true">↗</span>{/if}
      {@render after?.()}
    </NavigationMenu.Link>
  </NavigationMenu.Item>
{/snippet}

{#snippet presenceDot(scope: 'backlog' | 'setlist')}
  {#if $presenceIndicator.scope === scope && $presenceIndicator.state !== 'off'}
    {@const alone = $presenceIndicator.state === 'alone'}
    {#snippet dot(props: Record<string, unknown>)}
      <span {...props} class="presence-dot absolute bottom-[-6px] left-1/2 size-1.25 -translate-x-1/2 rounded-full {alone ? 'alone bg-presence-alone animate-[presence-pulse-alone_1.8s_ease-out_infinite]' : 'bg-presence-online animate-[presence-pulse_1.8s_ease-out_infinite]'}"></span>
    {/snippet}
    {@render tip(presenceTitle, dot)}
  {/if}
{/snippet}

{#snippet backlogDot()}{@render presenceDot('backlog')}{/snippet}
{#snippet setlistDot()}{@render presenceDot('setlist')}{/snippet}
{#snippet pendingDot()}{#if hasPending}<span class="pending-dot size-2 shrink-0 animate-[pending-pulse_1.6s_ease-out_infinite] rounded-full bg-danger"></span>{/if}{/snippet}
<!-- Light duotone tints for icons sitting on accent fills (the base accent tint on plain emoji is gone: they keep their native colours). -->
<svg width="0" height="0" aria-hidden="true" class="absolute">
  <!-- Duotone filters: "tint-on-primary" for icons on a solid accent fill (selected tab, primary buttons; light colours, detail intact), "tint-light" for a medium-light violet (the wrench on the secondary buttons). -->
  {#each [['tint-on-primary', 'icon-on-primary'], ['tint-light', 'icon-on-secondary']] as [id, vars] (id)}
    <filter {id} color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
      <feColorMatrix type="saturate" values="0" result="gray" />
      <feFlood style="flood-color: var(--{vars}-hi)" result="hi" />
      <feFlood style="flood-color: var(--{vars}-lo)" result="lo" />
      <feBlend in="gray" in2="hi" mode="multiply" result="light" />
      <feComposite in="gray" in2="lo" operator="arithmetic" k1="-1" k2="0" k3="1" k4="0" result="dark" />
      <feComposite in="light" in2="dark" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="duo" />
      <feComposite in="duo" in2="SourceAlpha" operator="in" />
    </filter>
  {/each}
</svg>
<Tooltip.Provider delayDuration={150}>
<header class="nav sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-card pr-3 pl-4 transition-colors max-mid:gap-2.5 max-mid:pl-2.5">
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <a {...props} href="{base}/backlog" aria-label={$t.common.brandLines.join(' ')} class="nav-brand relative flex items-center text-foreground no-underline">
          <LogoCat size={52} />
          <!-- Dev only (VITE_DEV_MOCK=1): the backend is replaced by mock data. -->
          {#if devMock}<span class="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-fit rounded-sm bg-primary px-1 text-micro leading-none font-bold tracking-wider text-primary-foreground uppercase">mock</span>{/if}
        </a>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="bottom" align="start" sideOffset={6} arrowClasses="hidden" class="border bg-card px-3 py-2 text-foreground">
      <span class="brand-text flex flex-col leading-compact">
        <span class="brand-ru mb-0.75 text-tiny font-medium uppercase tracking-wider text-muted-foreground">{$t.common.brandLines[0]}</span>
        <span class="brand-ru text-tiny font-medium uppercase tracking-wider text-muted-foreground">{$t.common.brandLines[1]}</span>
        <span class="brand-en text-title-sm font-extrabold tracking-[-0.01em] text-primary-ink">{$t.common.brandLines[2]}</span>
      </span>
    </Tooltip.Content>
  </Tooltip.Root>
  <NavigationMenu.Root viewport={false} class="h-full max-w-none flex-1 justify-start [&>div]:h-full [&>div]:flex-1">
    <NavigationMenu.List class="h-full w-full flex-1 justify-start">
      {@render navItem(`${base}/backlog`, path.startsWith('/backlog'), '🎵', $t.nav.backlog, backlogDot)}
      {@render navItem(`${base}/setlists`, path.startsWith('/setlists'), '🎪', $t.nav.setlists, setlistDot)}
      {#if $authLoading ? $navCanAccessRehearsals : $canAccessRehearsals}
        {@render navItem(`${base}/rehearsals`, path.startsWith('/rehearsals'), '📅', $t.nav.rehearsals)}
      {/if}
      {#if $navIsAdmin}
        {@render navItem(`${base}/admin`, path.startsWith('/admin'), '🔑', $t.nav.admin, undefined, pendingDot)}
      {/if}
      {@render navItem('https://media.kittens.band', false, '📷', $t.nav.media, undefined, undefined, true)}
    </NavigationMenu.List>
  </NavigationMenu.Root>
  <!-- Big tier: language, theme and logout as separate icon buttons. Smaller screens: one settings button (bottom drawer). -->
  <div class="hidden items-center gap-2 big:flex">
    <IconButton icon={$lang.toUpperCase()} label={$lang === 'ru' ? 'English' : 'Русский'} class="text-body font-semibold" onclick={toggleLang} />
    {#key dark}<IconButton icon={dark ? '☀️' : '🌙'} label={$t.common.themeToggle} onclick={toggleTheme} />{/key}
    {#if $navLoggedIn}<IconButton icon="🚪" label={$t.common.logout} class="hover:border-destructive hover:text-destructive" onclick={handleLogout} />{/if}
  </div>
  <div class="big:hidden">
    <RowActions drawer variant="outline" icon="⚙️" label={$t.common.settings} actions={[
      { icon: '🌐', label: $lang === 'ru' ? 'English' : 'Русский', onselect: toggleLang },
      { icon: dark ? '☀️' : '🌙', label: $t.common.themeToggle, onselect: toggleTheme },
      ...($navLoggedIn ? [{ icon: '🚪', label: $t.common.logout, destructive: true, separatorBefore: true, onselect: handleLogout }] : []),
    ]} />
  </div>
</header>

{#if $accessDenied && path.startsWith('/admin')}
  <Alert class="access-denied rounded-none border-x-0 border-t-0 bg-primary-soft px-4 py-2.5 text-center text-body font-semibold text-muted-foreground">{$t.common.accessDenied}</Alert>
{/if}
{@render children()}
</Tooltip.Provider>
