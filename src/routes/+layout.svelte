<script lang="ts">
  import { browser } from '$app/environment';
  import LogoCat from '$components/shared/LogoCat.svelte';
  import { lang } from '$lib/i18n';

  let { children } = $props();

  let dark = $state(browser ? localStorage.getItem('theme') === 'dark' : false);

  function toggleTheme() {
    dark = !dark;
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }

  function toggleLang() {
    $lang = $lang === 'ru' ? 'en' : 'ru';
  }

  $effect(() => {
    if (!browser) return;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  });
</script>

<svelte:head>
  <title>Музыкальные Котятки</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<nav class="nav">
  <a href="/backlog" class="nav-brand">
    <LogoCat size={50} />
    <span class="brand-text">
      <span class="brand-ru">Музыкальные</span>
      <span class="brand-en">Котятки</span>
    </span>
  </a>
  <a href="/backlog" class="nav-link">{$lang === 'ru' ? 'Каталог' : 'Backlog'}</a>
  <a href="/setlists" class="nav-link">{$lang === 'ru' ? 'Сетлисты' : 'Setlists'}</a>
  <a href="/musicians" class="nav-link">{$lang === 'ru' ? 'Музыканты' : 'Musicians'}</a>
  <button class="lang-toggle" onclick={toggleLang}>{$lang === 'ru' ? 'EN' : 'RU'}</button>
  <button class="theme-toggle" onclick={toggleTheme} title="Toggle theme">{dark ? '☀️' : '🌙'}</button>
</nav>

{@render children()}

<style>
  :global(*) { box-sizing: border-box; margin: 0; padding: 0; }

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
    height: 72px;
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
  .brand-en {
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    background: linear-gradient(90deg, #6c63ff, #c026d3);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .nav-link {
    text-decoration: none;
    color: var(--text-muted);
    font-size: 1.05rem;
    font-weight: 500;
    transition: color 0.15s;
  }
  .nav-link:hover { color: var(--text); }

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
</style>
