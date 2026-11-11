<script lang="ts">
  /** Sortable column header: ghost Button with the ↑/↓ indicator; the sorting state lives in backlogStore. */
  import { Button } from '$components/ui/button';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';

  let { id, label }: { id: string; label: string } = $props();
  const sorting = useStore(backlogStore, s => s.sorting);
  let dir = $derived($sorting[0]?.id === id ? ($sorting[0].desc ? 'desc' : 'asc') : null);
</script>

<Button variant="ghost" class="-ml-1.5 h-auto gap-1 px-1.5 py-0 text-[0.75rem] leading-4 font-bold tracking-[0.05em] text-muted-foreground uppercase hover:text-primary-ink" onclick={() => backlogStore.getState().toggleSort(id)}>
  {label}{dir === 'asc' ? ' ↑' : dir === 'desc' ? ' ↓' : ''}
</Button>
