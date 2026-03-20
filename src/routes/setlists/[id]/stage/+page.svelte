<script lang="ts">
  import { page } from '$app/state';
  import { setlistsStore } from '$lib/stores/setlists';
  import { songsStore } from '$lib/stores/songs';
  import StageView from '$components/stage/StageView.svelte';
  import { t } from '$lib/i18n';

  let id = $derived(page.params.id);
  let setlists = $derived($setlistsStore);
  let allSongs = $derived($songsStore);
  let setlist = $derived(setlists.find(s => s.id === id));
</script>

{#if setlist}
  <StageView {setlist} allSongs={allSongs} />
{:else}
  <div class="not-found">
    <p>{$t.notFound.message}</p>
    <a href="/setlists">{$t.notFound.back}</a>
  </div>
{/if}

<style>
  .not-found { text-align: center; padding: 60px 20px; color: var(--text-muted); }
  .not-found a { color: var(--accent); text-decoration: none; }
</style>
