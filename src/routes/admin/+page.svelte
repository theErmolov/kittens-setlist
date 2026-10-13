<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import PeopleManager from '$components/admin/PeopleManager.svelte';
  import { t } from '$lib/i18n';
  import { currentUser, authLoading } from '$lib/auth';
  import { getUsers } from '$lib/api';
  import type { User } from '$lib/types';

  let users = $state<User[]>([]);
  let loading = $state(true);
  let dataLoaded = $state(false);

  $effect(() => {
    if ($authLoading || dataLoaded) return;
    if (!$currentUser?.isAdmin) { goto(`${base}/backlog`); return; }
    dataLoaded = true;
    getUsers().then(loadedUsers => {
      users = loadedUsers;
      loading = false;
    });
  });

</script>

{#if $currentUser?.isAdmin}
<div class="admin-users">
  <h1>{$t.admin.users}</h1>
  {#if loading}
    <p class="hint">…</p>
  {:else}
    <PeopleManager bind:users />
  {/if}
</div>
{/if}

<style>
  .admin-users { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 1.4rem; font-weight: 800; margin-bottom: 24px; }
  .hint { font-size: 0.8rem; color: var(--text-muted); }
</style>
