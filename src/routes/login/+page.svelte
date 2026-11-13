<script lang="ts">
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { PUBLIC_TELEGRAM_BOT_USERNAME } from '$env/static/public';
  import { lang, t } from '$lib/i18n';
  import { currentUser, authLoading, setToken, getToken, meQueryOptions } from '$lib/auth';
  import { queryClient } from '$lib/query/client';
  import { useTelegramLogin } from '$lib/query/auth';
  import { useStore } from '$lib/store/bridge';
  import { loginStore } from '$lib/store/shell';
  import LogoCat from '$components/shared/LogoCat.svelte';
  import { Card } from '$components/ui/card';
  import { Alert, AlertDescription } from '$components/ui/alert';

  const status = useStore(loginStore, s => s.status);
  const setStatus = loginStore.getState().setStatus;

  // Only this exact external callback is allowed — prevents /login?return= from
  // becoming an open redirect to an arbitrary origin.
  const ALLOWED_RETURN = 'https://media.kittens.band/callback';

  function allowedReturn(): string | null {
    const value = page.url.searchParams.get('return');
    return value === ALLOWED_RETURN ? value : null;
  }

  function afterLogin(token: string) {
    const returnTo = allowedReturn();
    if (returnTo) {
      window.location.href = `${returnTo}#token=${encodeURIComponent(token)}`;
    } else {
      goto(`${base}/backlog`);
    }
  }

  // Redirect away if already authenticated
  $effect(() => {
    if ($authLoading) return;
    if ($currentUser?.status !== 'approved') return;
    const token = getToken();
    if (token) afterLogin(token);
    else goto(`${base}/backlog`);
  });

  const telegramLogin = useTelegramLogin();

  // Called by Telegram widget via global callback
  async function onTelegramAuth(data: Record<string, string>) {
    setStatus('loading');
    try {
      const { token, user } = await telegramLogin.mutateAsync(data);
      setToken(token);
      queryClient.setQueryData(meQueryOptions.queryKey, user);
      if (user.status === 'approved') {
        afterLogin(token);
      } else if (user.status === 'rejected') {
        setStatus('rejected');
      } else {
        setStatus('pending');
      }
    } catch {
      setStatus('error');
    }
  }

  const showWidget = $derived($status === 'idle' || $status === 'loading');

  $effect(() => {
    const widgetLang = $lang;
    if (!browser || !showWidget) return;
    const container = document.getElementById('tg-widget');
    if (!container) return;
    // Expose callback for Telegram widget
    (window as unknown as Record<string, unknown>).onTelegramAuth = onTelegramAuth;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', PUBLIC_TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-lang', widgetLang);
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    container.replaceChildren(script);
    return () => {
      container.replaceChildren();
      delete (window as unknown as Record<string, unknown>).onTelegramAuth;
    };
  });
</script>

<div class="login-page flex min-h-screen items-center justify-center bg-background">
  <Card class="card w-full max-w-90 items-center gap-4 rounded-2xl px-10 py-12">
    <LogoCat size={72} />
    <h1 class="text-center text-[1.4rem] font-extrabold text-primary-ink">{$t.login.title}</h1>

    {#if showWidget}
      <p class="subtitle text-center text-body-lg text-muted-foreground">{$t.login.subtitle}</p>
      <div id="tg-widget" class="widget-wrap flex min-h-12 justify-center"></div>
      {#if $status === 'loading'}
        <LoadingCat />
      {/if}
    {:else if $status === 'pending'}
      <Alert class="status-msg text-center">
        <AlertDescription class="text-base text-foreground">{$t.login.pending}</AlertDescription>
        <AlertDescription class="hint text-body">{$t.login.pendingHint}</AlertDescription>
      </Alert>
    {:else if $status === 'rejected'}
      <Alert variant="destructive" class="status-msg rejected text-center"><AlertDescription class="text-base">{$t.login.rejected}</AlertDescription></Alert>
    {:else if $status === 'error'}
      <Alert variant="destructive" class="status-msg rejected text-center"><AlertDescription class="text-base">{$t.login.error}</AlertDescription></Alert>
    {/if}
  </Card>
</div>
