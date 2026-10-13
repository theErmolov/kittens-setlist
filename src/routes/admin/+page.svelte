<script lang="ts">
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import PeopleManager from '$components/admin/PeopleManager.svelte';
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
<div>
  {#if loading}
    <p class="loading"><LoadingCat /></p>
  {:else}
    <PeopleManager bind:users />
  {/if}
</div>
{/if}

<style>
  .loading { padding: 40px 20px; }
</style>
