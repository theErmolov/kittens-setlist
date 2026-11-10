<script lang="ts">
  import { base } from '$app/paths';
  import { lang } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { cn, formatDate, orderMusicianNames } from '$lib/utils';
  import { createQuery } from '@tanstack/svelte-query';
  import { musiciansQuery, setlistsQuery } from '$lib/query/queries';
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$components/ui/card';
  import { Badge } from '$components/ui/badge';
  import type { Rehearsal } from '$lib/types';
  import { isPastRehearsal, rehearsalTime, timeText } from './classes';
  let { rehearsal }: { rehearsal: Rehearsal } = $props();
  const musiciansQ = createQuery(() => musiciansQuery());
  const setlistsQ = createQuery(() => setlistsQuery());
  const musicians = $derived(musiciansQ.data ?? []);
  const past = $derived(isPastRehearsal(rehearsal));
  const setlistName = $derived(setlistsQ.data?.find(s => s.id === rehearsal.setlistId)?.name);
</script>
<a class="group block rounded-xl no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href="{base}/rehearsals/{rehearsal.id}">
  <Card class={cn('transition-shadow group-hover:ring-primary-ink', rehearsal.cancelled && 'opacity-65')}>
    <CardHeader class="gap-1">
      <CardTitle class="flex items-center justify-between gap-2 text-[.95rem] font-semibold">
        {formatDate(rehearsal.date, $lang)}
        {#if rehearsal.cancelled}<Badge variant="outline" class="text-muted-foreground">{$rt.cancelled}</Badge>{/if}
      </CardTitle>
      <CardDescription class={cn('text-[1.15rem] font-medium', timeText(past))}>{rehearsalTime(rehearsal)}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-2">
      {#if rehearsal.location}<div class="text-[.9rem] break-words">{rehearsal.location}</div>{/if}
      {#if setlistName}<div class="text-[.8rem] break-words text-muted-foreground">{setlistName}</div>{/if}
      <div class="text-[.8rem] break-words text-muted-foreground">{orderMusicianNames(rehearsal.attendees, musicians).join(' · ') || '—'}</div>
      <div class="text-[.8rem] text-muted-foreground">{$rt.songs}: {rehearsal.songs.length}</div>
    </CardContent>
  </Card>
</a>
