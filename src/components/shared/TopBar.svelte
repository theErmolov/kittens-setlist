<script lang="ts">
  import ButtonRow from '$components/shared/ButtonRow.svelte';
  let { title, children }: { title: string; children?: import('svelte').Snippet } = $props();
</script>

<header class="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3">
  <span class="text-[1.1rem] font-bold text-foreground">{title}</span>
  <ButtonRow>{@render children?.()}</ButtonRow>
</header>
