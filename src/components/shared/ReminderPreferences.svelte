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
    <label><input type="checkbox" checked={enabled} disabled={loading || busy} onchange={event => toggle(event.currentTarget)} /> {$rt.personalReminders}</label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
{/if}

<style>
  .reminder-setting { margin-bottom: 20px; }
  label { display: flex; align-items: center; gap: 8px; font-size: .9rem; }
  .error { color: #dc2626; margin: 8px 0 0; }
</style>
