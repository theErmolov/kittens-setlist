<script lang="ts">
  import type { Song } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import PctBadge from '$components/shared/PctBadge.svelte';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import { overallPct } from '../songView';

  let { song, names }: { song: Song; names: string[] } = $props();
  const showProgress = useStore(backlogStore, s => s.showProgress);
  let pct = $derived(overallPct(song, names));
</script>

{#if $showProgress && pct !== null}
  <PctBadge value={pct} class="text-[0.9rem]" />
{:else}
  <CategoryBadge category={song.category} iconOnly />
{/if}
