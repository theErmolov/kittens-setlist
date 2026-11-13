<script lang="ts">
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import PeopleManager from '$components/admin/PeopleManager.svelte';
  import { currentUser, authLoading } from '$lib/auth';
  import { createQuery } from '@tanstack/svelte-query';
  import { usersQuery } from '$lib/query/queries';

  const users = createQuery(() => ({ ...usersQuery(), enabled: $currentUser?.isAdmin === true }));

  $effect(() => {
    if ($authLoading) return;
    if (!$currentUser?.isAdmin) goto(`${base}/backlog`);
  });
</script>

{#if $currentUser?.isAdmin}
<div>
  {#if users.isPending}
    <LoadingCat />
  {:else}
    <PeopleManager />
  {/if}
</div>
{/if}
