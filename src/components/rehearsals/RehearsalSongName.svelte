<script lang="ts">
  import { cn } from '$lib/utils';
  let { artist, title, dimmed = false }: { artist: string; title: string; dimmed?: boolean } = $props();
</script>

<span class={cn('text-lead leading-[1.35] wrap-anywhere text-foreground', dimmed && 'text-muted-foreground')}>{artist}<span class="mx-1 text-muted-foreground">–</span><strong class="font-semibold">{title}</strong></span>
