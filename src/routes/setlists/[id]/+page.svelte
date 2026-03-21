<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import SetlistEditor from '$components/setlist/SetlistEditor.svelte';
  import { getSetlist, getSongs, getMusicians } from '$lib/api';
  import { t } from '$lib/i18n';
  import type { Setlist, Song, BandMusician } from '$lib/types';

  let id = $derived(page.params.id);
  let setlist = $state<Setlist | undefined>(undefined);
  let allSongs = $state<Song[]>([]);
  let musicians = $state<BandMusician[]>([]);

  onMount(async () => {
    [setlist, allSongs, musicians] = await Promise.all([
      getSetlist(id!),
      getSongs(),
      getMusicians()
    ]);
  });
</script>

{#if setlist}
  <SetlistEditor {setlist} {allSongs} {musicians} />
{:else}
  <div class="not-found">
    <p>{$t.notFound.message}</p>
    <a href="/setlists">{$t.notFound.backToSetlists}</a>
  </div>
{/if}

<style>
  .not-found { text-align: center; padding: 60px 20px; color: var(--text-muted); }
  .not-found a { color: var(--accent); text-decoration: none; }
</style>
