<script lang="ts">
  import type { Song } from '$lib/types';
  import { sortInstruments, INSTRUMENT_ICONS } from '$lib/utils';

  let { song, name }: { song: Song; name: string } = $props();
  let role = $derived(song.musicians[name]);
</script>

{#if role?.instruments?.length}
  <!-- Icons shrink to share the cell width (container query units), so 1-4 instruments always fit. -->
  <span class="flex w-full justify-center leading-none [container-type:inline-size]" style="--n: {role.instruments.length}">{#each sortInstruments(role.instruments) as inst (inst)}<span class="whitespace-nowrap [font-size:min(1.17rem,calc(92cqw/var(--n,1)/1.25))]">{INSTRUMENT_ICONS[inst]}</span>{/each}</span>
{/if}
