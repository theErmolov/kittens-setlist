<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { PUBLIC_API_URL, PUBLIC_TELEGRAM_BOT_USERNAME } from '$env/static/public';
  import { t } from '$lib/i18n';
  import { currentUser, setToken } from '$lib/auth';
  import type { KittensUser } from '$lib/types';
  import LogoCat from '$components/shared/LogoCat.svelte';

  let status: 'idle' | 'loading' | 'pending' | 'rejected' | 'error' = $state('idle');

  // Called by Telegram widget via global callback
  async function onTelegramAuth(data: Record<string, string>) {
    status = 'loading';
    try {
      const res = await fetch(`${PUBLIC_API_URL}/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        status = 'error';
        return;
      }
      const { token, user } = await res.json() as { token: string; user: KittensUser };
      setToken(token);
      currentUser.set(user);
      if (user.status === 'approved') {
        goto(`${base}/backlog`);
      } else if (user.status === 'rejected') {
        status = 'rejected';
      } else {
        status = 'pending';
      }
    } catch {
      status = 'error';
    }
  }

  onMount(() => {
    if (!browser) return;
    // Expose callback for Telegram widget
    (window as unknown as Record<string, unknown>).onTelegramAuth = onTelegramAuth;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', PUBLIC_TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    document.getElementById('tg-widget')?.appendChild(script);
  });
</script>

<div class="login-page">
  <div class="card">
    <LogoCat size={72} />
    <h1>{$t.login.title}</h1>

    {#if status === 'idle' || status === 'loading'}
      <p class="subtitle">{$t.login.subtitle}</p>
      <div id="tg-widget" class="widget-wrap"></div>
      {#if status === 'loading'}
        <p class="hint">…</p>
      {/if}
    {:else if status === 'pending'}
      <p class="status-msg">{$t.login.pending}</p>
      <p class="hint">{$t.login.pendingHint}</p>
    {:else if status === 'rejected'}
      <p class="status-msg rejected">{$t.login.rejected}</p>
    {:else if status === 'error'}
      <p class="status-msg rejected">Something went wrong. Try again.</p>
    {/if}
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 48px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 360px;
    width: 100%;
  }

  h1 {
    font-size: 1.4rem;
    font-weight: 800;
    background: linear-gradient(90deg, #6c63ff, #c026d3);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-align: center;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 0.95rem;
    text-align: center;
  }

  .widget-wrap {
    display: flex;
    justify-content: center;
    min-height: 48px;
  }

  .status-msg {
    font-size: 1rem;
    text-align: center;
    color: var(--text);
  }

  .status-msg.rejected {
    color: #e05252;
  }

  .hint {
    color: var(--text-muted);
    font-size: 0.85rem;
    text-align: center;
  }
</style>
