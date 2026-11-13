<script lang="ts">
  import { fade } from 'svelte/transition';
  import SongName from '$components/shared/SongName.svelte';
  import type { Song, LearningStage } from '$lib/types';
  import { t } from '$lib/i18n';
  import IconButton from '$components/shared/IconButton.svelte';
  import GuestBadge from '$components/shared/GuestBadge.svelte';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import { guestTags } from '../songView';

  let { song, names }: { song: Song; names: string[] } = $props();
  const flashing = useStore(backlogStore, s => s.flashing);
  let flashAdded = $derived($flashing.has(song.id));
  const showProgress = useStore(backlogStore, s => s.showProgress);
  let guests = $derived(guestTags(song, names));
</script>

{#if flashAdded}
  <span transition:fade={{ duration: 250 }} class="pointer-events-none absolute inset-0 z-5 flex items-center justify-center bg-add-flash-bg text-glyph font-extrabold text-add-flash-ink" aria-hidden="true">✓</span>
{/if}
<!-- "Artist – Title" exactly as in the small view's rows, with the guest tags right after it; the lyrics button sits at the right end of the cell. -->
<div class="relative flex min-h-10 items-center gap-2 leading-tight {song.lyrics ? 'pr-12' : ''}">
  <SongName artist={song.artist} title={song.title} class="truncate" />
  {#each guests as g (g.name)}
    <GuestBadge name={g.name} instruments={g.instruments} base="bg" stage={$showProgress ? ((song.progress?.[g.name] ?? 'queue') as LearningStage) : undefined} />
  {/each}
  {#if song.lyrics}<IconButton class="no-tint absolute top-1/2 right-0 -translate-y-1/2" variant="secondary" icon="📝" label={$t.common.lyrics} onclick={(e) => { e.stopPropagation(); backlogStore.getState().setLyricsViewSong(song.id); }} />{/if}
</div>
