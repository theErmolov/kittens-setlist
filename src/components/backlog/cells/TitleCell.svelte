<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Song } from '$lib/types';
  import { t } from '$lib/i18n';
  import IconButton from '$components/shared/IconButton.svelte';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';

  let { song }: { song: Song } = $props();
  const flashing = useStore(backlogStore, s => s.flashing);
  let flashAdded = $derived($flashing.has(song.id));
</script>

{#if flashAdded}
  <span transition:fade={{ duration: 250 }} class="pointer-events-none absolute inset-0 z-5 flex items-center justify-center bg-success/80 text-[1.7rem] font-extrabold text-success-ink" aria-hidden="true">✓</span>
{/if}
<!-- The lyrics button sits at the right end of the cell, vertically centred (the same place as in the setlist editor). -->
<div class="relative flex min-h-10 items-center {song.lyrics ? 'pr-12' : ''}">
  <span class="min-w-0 min-mid:truncate">{song.title}</span>
  {#if song.lyrics}<IconButton class="no-tint absolute top-1/2 right-0 -translate-y-1/2" variant="secondary" icon="📝" label={$t.common.lyrics} onclick={(e) => { e.stopPropagation(); backlogStore.getState().setLyricsViewSong(song.id); }} />{/if}
</div>
