<script lang="ts">
  import { page } from '$app/state';
  import SetlistEditor from '$components/setlist/SetlistEditor.svelte';
  import { getSetlist, getSongs, getMusicians } from '$lib/api';
  import { t } from '$lib/i18n';
  import type { Setlist, Song, BandMusician } from '$lib/types';

  let id = $derived(page.params.id);
  let setlist = $state<Setlist | undefined>(undefined);
  let allSongs = $state<Song[]>([]);
  let musicians = $state<BandMusician[]>([]);
  let loading = $state(true);

  $effect(() => {
    const targetId = id;
    if (!targetId) return;
    loading = true;
    Promise.all([
      getSetlist(targetId),
      getSongs().catch(() => []),
      getMusicians().catch(() => [])
    ]).then(([s, songs, mus]) => {
      if (id !== targetId) return; // ignore stale responses
      setlist = s;
      allSongs = songs;
      musicians = mus;
      loading = false;
    }).catch(() => {
      if (id === targetId) {
        setlist = undefined;
        loading = false;
      }
    });
  });
</script>

{#if loading}
  <div class="not-found"><p>…</p></div>
{:else if setlist}
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
