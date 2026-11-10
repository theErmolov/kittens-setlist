<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { currentUser } from '$lib/auth';
  import { notificationPreferencesQuery } from '$lib/query/queries';
  import { useUpdateNotificationPreferences } from '$lib/query/shell';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { Switch } from '$components/ui/switch';
  import { Label } from '$components/ui/label';

  const prefs = createQuery(() => ({
    ...notificationPreferencesQuery(),
    enabled: $currentUser?.status === 'approved' && !!$currentUser.telegramId,
    staleTime: 0,
  }));
  const update = useUpdateNotificationPreferences();
  const enabled = $derived(prefs.data?.enabled ?? true);
  const loading = $derived(prefs.isPending);
  const error = $derived(prefs.isError || update.isError ? $rt.notificationsError : '');
  const id = $props.id();
</script>

{#if $currentUser?.status === 'approved' && $currentUser.telegramId}
  <div class="reminder-setting min-w-0">
    <!-- Bordered chip around the switch and its label; the label wraps onto two lines. -->
    <div class="flex h-10 w-fit items-center gap-2.5 rounded-lg border bg-background px-2.5">
      <!-- Controlled: the visible state always follows the server value (reverts on failure). -->
      <Switch id="{id}-reminders" bind:checked={() => enabled, v => update.mutate(v)} disabled={loading || update.isPending} />
      <Label for="{id}-reminders" class="w-[8.75rem] cursor-pointer text-[0.78rem] leading-[1.15] font-normal whitespace-normal {loading || update.isPending ? 'opacity-50' : ''}">{$rt.personalReminders}</Label>
    </div>
    {#if error}<p class="mt-2 text-destructive" role="alert">{error}</p>{/if}
  </div>
{/if}
