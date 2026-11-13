<script lang="ts">
  /** Readiness percent pill. Always the same width (fits "100%") so columns of them line up; `null` shows a dash. */
  import type { HTMLAttributes } from 'svelte/elements';
  import { Badge } from '$components/ui/badge';
  import { cn, pctBubbleClass } from '$lib/utils';

  let { value, class: className, ...rest }: { value: number | null; class?: string } & HTMLAttributes<HTMLElement> = $props();
</script>

<Badge
  variant="outline"
  class={cn('box-border w-[3.7em] min-w-[3.7em] max-w-[3.7em] shrink-0 justify-center px-0 font-semibold tabular-nums', value === null ? 'border-border text-muted-foreground' : pctBubbleClass(value), className)}
  {...rest}
>{value === null ? '—' : `${value}%`}</Badge>
