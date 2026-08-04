<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authLoading, currentUser } from '$lib/auth';

  $effect(() => {
    if ($authLoading) return;
    goto($currentUser?.isAdmin ? `${base}/admin` : `${base}/backlog`, { replaceState: true });
  });
</script>
