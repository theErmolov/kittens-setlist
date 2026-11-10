<script lang="ts">
  import type { Song } from '$lib/types';
  import { INSTRUMENT_ICONS } from '$lib/utils';
  import { Badge } from '$components/ui/badge';
  import { guestTags } from '../songView';

  let { song, names }: { song: Song; names: string[] } = $props();
  let guests = $derived(guestTags(song, names));
</script>

{#if guests.length > 0}
  <div class="flex flex-wrap gap-2">
    {#each guests as g (g.name)}
      <Badge variant="secondary" class="gap-0.5 bg-neutral px-[7px] text-[0.7rem] font-normal text-neutral-ink"><span class="shrink-0">{#each g.instruments as inst (inst)}<span>{INSTRUMENT_ICONS[inst]}</span>{/each}</span><span class="max-w-[7ch] truncate">{g.name}</span></Badge>
    {/each}
  </div>
{/if}
