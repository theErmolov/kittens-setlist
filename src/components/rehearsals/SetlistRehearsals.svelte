<script lang="ts">
  import { base } from '$app/paths';
  import { canAccessRehearsals } from '$lib/auth';
  import { createQuery } from '@tanstack/svelte-query';
  import { rehearsalsQuery } from '$lib/query/queries';
  import { lang } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { formatDate } from '$lib/utils';
  import { isUpcoming } from '$lib/rehearsals';
  import { Button } from '$components/ui/button';
  let { setlistId }: { setlistId: string } = $props();
  const rehearsalsQ = createQuery(() => ({ ...rehearsalsQuery(), enabled: $canAccessRehearsals }));
  const rehearsals = $derived((rehearsalsQ.data ?? []).filter(r => r.setlistId === setlistId && isUpcoming(r)).sort((a,b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)));
  const error = $derived(rehearsalsQ.isError);
</script>
{#if $canAccessRehearsals}
<div class="flex flex-wrap items-center gap-2 pt-3 pb-4 text-[.8rem] text-muted-foreground">
  <span>{$rt.title}</span>
  {#each rehearsals as rehearsal}<Button variant="outline" href="{base}/rehearsals/{rehearsal.id}" class="bg-card px-2.5 text-[.8rem] font-normal">{formatDate(rehearsal.date, $lang)} · {rehearsal.startTime}</Button>{/each}
  {#if error}<span class="text-destructive">{$rt.error}</span>{/if}
  <Button variant="outline" href="{base}/rehearsals?new=1&setlist={encodeURIComponent(setlistId)}" class="bg-card px-2.5 text-[.8rem] font-normal text-primary-ink">+ {$rt.new}</Button>
</div>
{/if}
