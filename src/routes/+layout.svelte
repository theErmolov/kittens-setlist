<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import twemoji from '@twemoji/api';
  import LogoCat from '$components/shared/LogoCat.svelte';
  import { lang } from '$lib/i18n';
  import { currentUser, authLoading, initAuth, logout } from '$lib/auth';
  import { getUsers } from '$lib/api';

  let { children } = $props();

  let dark = $state(browser ? localStorage.getItem('theme') === 'dark' : false);
  let hasPending = $state(false);

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
    initAuth().then(() => {
      if ($currentUser?.isAdmin) {
        getUsers().then(users => { hasPending = users.some(u => u.status === 'pending'); });
      }
    });
    return () => observer.disconnect();
  });

  // Strip base prefix so active checks work on both local and GitHub Pages
  let path = $derived(page.url.pathname.slice(base.length) || '/');

  // Auth guard: redirect to /login unless on login page or stage view
  $effect(() => {
    if (!browser || $authLoading) return;
    const isLoginPage = path.startsWith('/login');
    const isStage = path.includes('/stage');
    if (!isLoginPage && !isStage && $currentUser === null) {
      goto(`${base}/login`);
    }
  });

  function toggleTheme() {
    dark = !dark;
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }

  function toggleLang() {
    $lang = $lang === 'ru' ? 'en' : 'ru';
  }

  async function handleLogout() {
    await logout();
    goto(`${base}/login`);
  }

  $effect(() => {
    if (!browser) return;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  });
</script>

<svelte:head>
  <title>Центр Управления Котят</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<nav class="nav">
  <a href="{base}/backlog" class="nav-brand">
    <LogoCat size={52} />
    <span class="brand-text">
      <span class="brand-ru">Центр</span>
      <span class="brand-ru">управления</span>
      <span class="brand-en">Котят</span>
    </span>
  </a>
  <a href="{base}/backlog" class="nav-link" class:active={path.startsWith('/backlog')}>
    <span class="link-icon">🎵</span><span class="link-label">{$lang === 'ru' ? 'Каталог' : 'Backlog'}</span>
  </a>
  <a href="{base}/setlists" class="nav-link" class:active={path.startsWith('/setlists')}>
    <span class="link-icon">🎪</span><span class="link-label">{$lang === 'ru' ? 'Сетлисты' : 'Setlists'}</span>
  </a>
  <a href="{base}/musicians" class="nav-link" class:active={path.startsWith('/musicians')}>
    <span class="link-icon">🎸</span><span class="link-label">{$lang === 'ru' ? 'Музыканты' : 'Musicians'}</span>
  </a>
  {#if $currentUser?.isAdmin}
    <a href="{base}/admin" class="nav-link" class:active={path.startsWith('/admin')}>
      <span class="link-icon">🔑</span><span class="link-label">{$lang === 'ru' ? 'Админ' : 'Admin'}</span>
      {#if hasPending}<span class="pending-dot"></span>{/if}
    </a>
  {/if}
  <button class="lang-toggle" onclick={toggleLang}>{$lang === 'ru' ? 'EN' : 'RU'}</button>
  <button class="theme-toggle" onclick={toggleTheme} title="Toggle theme">{#key dark}<span>{dark ? '☀️' : '🌙'}</span>{/key}</button>
  {#if $currentUser}
    <button class="logout-btn" onclick={handleLogout} title="Log out">🚪</button>
  {/if}
</nav>

{@render children()}

<style>
  :global(*) { box-sizing: border-box; margin: 0; padding: 0; }

  /* Prevent automatic small zoom on focus in iOS Safari by forcing font-size to be at least 16px on mobile */
  @media (max-width: 900px) {
    :global(input:not([type="checkbox"]):not([type="radio"]), textarea, select) {
      font-size: 16px !important;
    }
  }

  :global(:root), :global([data-theme="light"]) {
    --bg: #f5f4f8;
    --surface: #ffffff;
    --border: #e2e0ea;
    --text: #1a1830;
    --text-muted: #7a7890;
    --accent: #6c63ff;
    --row-hover: #f0effe;
    --chip-bg: #eceaf8;
    --musician-alt-bg: #edeaf8;
    color-scheme: light;
  }

  :global([data-theme="dark"]) {
    --bg: #0f1117;
    --surface: #1a1d26;
    --border: #2a2d3a;
    --text: #e8eaf0;
    --text-muted: #7a7d90;
    --accent: #6c63ff;
    --row-hover: #1f2230;
    --chip-bg: #23263a;
    --musician-alt-bg: #1e2133;
    color-scheme: dark;
  }

  :global(img.emoji) {
    height: 1em;
    width: 1em;
    vertical-align: -0.1em;
    display: inline-block;
  }

  :global(body) {
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: background 0.2s, color 0.2s;
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 16px;
    height: 56px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 20;
    transition: background 0.2s, border-color 0.2s;
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: var(--text);
    margin-right: 8px;
  }
  .brand-text { display: flex; flex-direction: column; line-height: 1.15; }
  .brand-ru {
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .brand-ru:first-child { margin-bottom: 3px; }
  .brand-en {
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    background: linear-gradient(90deg, #6c63ff, #c026d3);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 5px;
    text-decoration: none;
    color: var(--text-muted);
    font-size: 0.95rem;
    font-weight: 500;
    padding: 0 14px;
    align-self: stretch;
    transition: color 0.15s, background 0.15s;
  }
  .nav-link:hover { color: var(--text); background: var(--chip-bg); }
  .nav-link.active { color: #fff; background: #6c63ff; }

  .link-icon { font-size: 1rem; line-height: 1; }

  .pending-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #ef4444;
    flex-shrink: 0;
    box-shadow: 0 0 0 0 #ef444480;
    animation: pending-pulse 1.6s ease-out infinite;
  }
  @keyframes pending-pulse {
    0%   { box-shadow: 0 0 0 0 #ef444480; }
    70%  { box-shadow: 0 0 0 6px #ef444400; }
    100% { box-shadow: 0 0 0 0 #ef444400; }
  }

  .lang-toggle {
    margin-left: auto;
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    transition: border-color 0.15s, color 0.15s;
  }
  .lang-toggle:hover { border-color: var(--accent); color: var(--accent); }

  .theme-toggle {
    margin-left: 0;
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    transition: border-color 0.15s;
  }
  .theme-toggle:hover { border-color: var(--accent); }

  .logout-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    color: var(--text-muted);
    transition: border-color 0.15s, color 0.15s;
  }
  .logout-btn:hover { border-color: #e05252; color: #e05252; }

  @media (max-width: 900px) {
    .nav { gap: 0; padding: 0 10px; }
    .brand-text { display: none; }
    .nav-brand { margin-right: 4px; }
    .link-label { display: none; }
    .nav-link { padding: 0 16px; font-size: 1.2rem; }
    .link-icon { font-size: 1.45rem; }
    .lang-toggle { margin-left: auto; padding: 4px 7px; }
  }
</style>
