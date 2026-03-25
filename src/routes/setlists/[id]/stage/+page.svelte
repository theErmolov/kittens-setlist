<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import StageView from '$components/stage/StageView.svelte';
  import { getSetlist, getMusicians } from '$lib/api';
  import { t } from '$lib/i18n';
  import { currentUser, authLoading } from '$lib/auth';
  import type { Setlist, BandMusician } from '$lib/types';

  let id = $derived(page.params.id);
  let setlist = $state<Setlist | undefined>(undefined);
  let musicians = $state<BandMusician[]>([]);

  let canMark = $derived($currentUser?.status === 'approved');
  // Authenticated users poll every 2s; unauthenticated every 10s
  let pollInterval = $derived(canMark ? 2000 : 30000);

  onMount(async () => {
    setlist = await getSetlist(id!);
    if ($currentUser?.status === 'approved') {
      try { musicians = await getMusicians(); } catch { /* ignore */ }
    }
  });

  // Load musicians once auth resolves (in case auth finished after mount)
  $effect(() => {
    if ($authLoading || !$currentUser || $currentUser.status !== 'approved') return;
    if (musicians.length === 0) {
      getMusicians().then(m => { musicians = m; }).catch(() => {});
    }
  });
</script>

{#if setlist}
  <StageView {setlist} {musicians} {canMark} {pollInterval} />
{:else}
  <div class="not-found">
    <p>{$t.notFound.message}</p>
    <a href="{base}/setlists">{$t.notFound.back}</a>
  </div>
{/if}

<style>
  .not-found { text-align: center; padding: 60px 20px; color: var(--text-muted); }
  .not-found a { color: var(--accent); text-decoration: none; }
</style>
