<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { currentUser } from '$lib/auth';
  import { notificationPreferencesQuery } from '$lib/query/queries';
  import { useUpdateNotificationPreferences } from '$lib/query/shell';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { Switch } from '$components/ui/switch';
  import { Label } from '$components/ui/label';
  import TelegramIcon from './TelegramIcon.svelte';

  const prefs = createQuery(() => ({
    ...notificationPreferencesQuery(),
    enabled: $currentUser?.status === 'approved' && !!$currentUser.telegramId,
  }));
  const update = useUpdateNotificationPreferences();
  const enabled = $derived(prefs.data?.enabled ?? true);
  const loading = $derived(prefs.isPending);
  const error = $derived(prefs.isError || update.isError ? $rt.notificationsError : '');
  const id = $props.id();
</script>

{#if $currentUser?.status === 'approved' && $currentUser.telegramId}
  <div class="reminder-setting min-w-0">
    <!-- Bordered chip around the switch and its two-line label. -->
    <div class="flex h-10 w-fit items-center gap-2.5 rounded-lg border bg-background px-2.5">
      <!-- Controlled: the visible state always follows the server value (reverts on failure). -->
      <Switch id="{id}-reminders" bind:checked={() => enabled, v => update.mutate(v)} disabled={loading || update.isPending} />
<!-- «Напоминать / мне в [Telegram]» on two lines at every size (the full text stays as the tooltip). -->
      <Label for="{id}-reminders" title={$rt.personalReminders} class="cursor-pointer text-small leading-compact font-normal whitespace-nowrap {loading || update.isPending ? 'opacity-50' : ''}"><span class="flex flex-col">{$rt.remindShort}<span class="inline-flex items-center gap-1">{$rt.remindShortMe} <TelegramIcon class="size-3.5 shrink-0" /></span></span></Label>
    </div>
    {#if error}<p class="mt-2 text-destructive" role="alert">{error}</p>{/if}
  </div>
{/if}
