<script lang="ts">
  /**
   * The setlist "vibe" state as a Badge: «+вайб» (vibe on, green) / «-вайб» (off, orange), with the explanation as tooltip.
   * The one place that defines how vibe looks — use it wherever the state is shown (editor header, tables, lists).
   */
  import { Badge } from '$components/ui/badge';
  import { t } from '$lib/i18n';
  import { cn } from '$lib/utils';

  let { vibe, class: className }: { vibe: boolean | undefined; class?: string } = $props();
</script>

<Badge
  class={cn('cursor-default font-bold tracking-[0.04em] normal-case', vibe ? 'bg-vibe-on-bg text-vibe-on-ink' : 'bg-vibe-off-bg text-vibe-off-ink', className)}
  title={$t.setlists.vibeTooltip}
>{vibe ? $t.setlists.vibeOn : $t.setlists.vibeOff}</Badge>
