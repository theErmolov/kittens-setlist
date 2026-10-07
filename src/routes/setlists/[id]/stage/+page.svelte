<script lang="ts">
  import { afterNavigate } from '$app/navigation';
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
  let loading = $state(true);

  let canMark = $derived($currentUser?.isAdmin === true || ($currentUser?.status === 'approved' && $currentUser?.role === 'writer'));
  // admin/writer: 2s, reader: 10s, anonymous: 30s
  let pollInterval = $derived(
    canMark ? 2000 : $currentUser?.status === 'approved' ? 10000 : 30000
  );

  afterNavigate(() => { window.scrollTo(0, 0); });

  $effect(() => {
    const authorId = $currentUser?.id;
    const targetId = id;
    if (!targetId) return;
    loading = true;
    getSetlist(targetId).then(s => {
      if (id !== targetId || $currentUser?.id !== authorId) return;
      setlist = s;
      loading = false;
    }).catch(() => {
      if (id === targetId) {
        setlist = undefined;
        loading = false;
      }
    });
  });

  // Load musicians once auth resolves (in case auth finished after mount)
  $effect(() => {
    if ($authLoading || !$currentUser || $currentUser.status !== 'approved') return;
    if (musicians.length === 0) {
      getMusicians().then(m => { musicians = m; }).catch(() => {});
    }
  });
</script>

{#if loading}
  <div class="not-found"><p>…</p></div>
{:else if setlist}
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
