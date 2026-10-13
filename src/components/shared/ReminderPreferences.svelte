<script lang="ts">
  import { currentUser } from '$lib/auth';
  import { getNotificationPreferences, updateNotificationPreferences } from '$lib/api';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  let enabled = $state(true), loading = $state(true), busy = $state(false), error = $state('');
  $effect(() => {
    if ($currentUser?.status !== 'approved' || !$currentUser.telegramId) return;
    let active = true;
    loading = true; error = '';
    getNotificationPreferences().then(value => { if (active) enabled = value.enabled; })
      .catch(() => { if (active) error = $rt.notificationsError; })
      .finally(() => { if (active) loading = false; });
    return () => { active = false; };
  });
  async function toggle(input: HTMLInputElement) {
    busy = true; error = '';
    try { enabled = (await updateNotificationPreferences(input.checked)).enabled; }
    catch { error = $rt.notificationsError; }
    finally { busy = false; input.checked = enabled; }
  }
</script>

{#if $currentUser?.status === 'approved' && $currentUser.telegramId}
  <div class="reminder-setting">
    <label>
      <input type="checkbox" role="switch" checked={enabled} disabled={loading || busy} onchange={event => toggle(event.currentTarget)} />
      <span class="switch" aria-hidden="true"></span>
      <span>{$rt.personalReminders}</span>
    </label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
{/if}

<style>
  .reminder-setting { min-width: 0; }
  label { position: relative; display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: .9rem; cursor: pointer; }
  input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  .switch { position: relative; flex: 0 0 46px; height: 28px; border-radius: 999px; background: var(--border); transition: background .18s ease; }
  .switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px #0003; transition: transform .18s ease; }
  input:checked + .switch { background: #34c759; }
  input:checked + .switch::after { transform: translateX(18px); }
  input:focus-visible + .switch { outline: 2px solid var(--accent); outline-offset: 3px; }
  input:disabled ~ span { opacity: .5; }
  label:has(input:disabled) { cursor: default; }
  .error { color: #dc2626; margin: 8px 0 0; }
  @media (prefers-reduced-motion: reduce) { .switch, .switch::after { transition: none; } }
</style>
