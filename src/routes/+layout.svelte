<script lang="ts">
  import '../app.css';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { queryClient } from '$lib/query/client';
  import AppShell from '$components/shared/AppShell.svelte';

  let { children } = $props();
</script>

<QueryClientProvider client={queryClient}>
  <AppShell>{@render children()}</AppShell>
</QueryClientProvider>
