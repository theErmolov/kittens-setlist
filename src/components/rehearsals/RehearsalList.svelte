<script lang="ts">
  /** Side-panel list of rehearsals as shadcn Items (date + time, then setlist · attendees · songs). Sorted by date + time. */
  import { base } from '$app/paths';
  import { createQuery } from '@tanstack/svelte-query';
  import * as Item from '$components/ui/item';
  import { Badge } from '$components/ui/badge';
  import { lang } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { cn, formatDate, orderMusicianNames } from '$lib/utils';
  import type { Rehearsal } from '$lib/types';
  import { musiciansQuery, setlistsQuery } from '$lib/query/queries';
  import { isPastRehearsal, rehearsalTime, timeText } from './classes';
  import { rehearsalCoverage } from '$lib/rehearsals';

  let { rehearsals }: { rehearsals: Rehearsal[] } = $props();
  const musiciansQ = createQuery(() => musiciansQuery());
  const setlistsQ = createQuery(() => setlistsQuery());
  const sorted = $derived([...rehearsals].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)));
  const setlistName = (r: Rehearsal) => setlistsQ.data?.find(s => s.id === r.setlistId)?.name;
  /** Attendees plus the people the songs need who are not coming (shown struck through). */
  const people = (r: Rehearsal) => {
    const needed = r.songs.flatMap(item => rehearsalCoverage(item.song, []).needed);
    return orderMusicianNames([...new Set([...r.attendees, ...needed])], musiciansQ.data ?? []).map(name => ({ name, absent: !r.attendees.includes(name) }));
  };
</script>

<Item.Group class="gap-2">
  {#each sorted as r (r.id)}
    {@const name = setlistName(r)}
    <Item.Root variant="outline" class={cn('cursor-pointer bg-card hover:bg-card hover:ring-2 hover:ring-primary-ink', r.cancelled && 'opacity-65')}>
      {#snippet child({ props })}
        <a {...props} href="{base}/rehearsals/{r.id}" class={cn(props.class as string, 'no-underline')}>
          <Item.Content class="min-w-0">
            <Item.Title class={cn('line-clamp-none flex w-full flex-wrap items-baseline gap-x-2', r.cancelled && 'line-through')}>
              <span class="font-semibold">{formatDate(r.date, $lang)}</span>
              <span class={cn('font-semibold', !r.cancelled && timeText(isPastRehearsal(r)))}>{rehearsalTime(r)}</span>
              {#if r.cancelled}<Badge class="bg-danger text-danger-ink no-underline">{$rt.cancelled}</Badge>{/if}
            </Item.Title>
            <Item.Description class="line-clamp-none flex flex-wrap gap-x-2 text-[.8rem]">
              {#if name}<span class="text-primary-ink"><span aria-hidden="true">🎪</span> {name}</span>{/if}
              {#if people(r).length}
                <span class="max-w-full truncate">{#each people(r) as p, i (p.name)}{#if i > 0}<span class="mx-1">·</span>{/if}<span class={p.absent ? 'line-through opacity-70' : ''}>{p.name}</span>{/each}</span>
              {/if}
            </Item.Description>
            {#if r.songs.length}
              <!-- The actual songs, as a bullet list (columns as room allows; always two on small screens, in a smaller font). -->
              <ul class="m-0 mt-2 grid list-disc grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-x-6 gap-y-2 pl-5 text-[.85rem] marker:text-primary-ink max-[1101px]:grid-cols-2 max-[1101px]:gap-x-4 max-[1101px]:pl-4 max-[1101px]:text-[.72rem]" aria-label={$rt.colSongs}>
                {#each r.songs as item, i (`${item.sourceSetlistId ?? ''}:${item.songId}:${i}`)}
                  <li class={cn('min-w-0 leading-tight', item.played && 'text-muted-foreground line-through')} title="{item.song.artist} – {item.song.title}">
                    <!-- Always two lines: the artist, then the song name; neither wraps (long text is cut with an ellipsis). -->
                    <span class="block truncate text-muted-foreground">{item.song.artist}</span>
                    <span class="block truncate font-medium">{item.song.title}</span>
                  </li>
                {/each}
              </ul>
            {/if}
          </Item.Content>
        </a>
      {/snippet}
    </Item.Root>
  {/each}
</Item.Group>
