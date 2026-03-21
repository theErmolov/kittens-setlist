<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import StageView from '$components/stage/StageView.svelte';
  import { getSetlist, getMusicians } from '$lib/api';
  import { t } from '$lib/i18n';
  import type { Setlist, BandMusician } from '$lib/types';

  let id = $derived(page.params.id);
  let setlist = $state<Setlist | undefined>(undefined);
  let musicians = $state<BandMusician[]>([]);

  onMount(async () => {
    [setlist, musicians] = await Promise.all([getSetlist(id!), getMusicians()]);
  });
</script>

{#if setlist}
  <StageView {setlist} {musicians} />
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
