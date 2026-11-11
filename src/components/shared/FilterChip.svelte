<script lang="ts">
  import { Toggle } from '$components/ui/toggle';

  import { cn } from '$lib/utils';

  let { label, active, disabled = false, onclick, class: className }: {
    label: string; active: boolean; disabled?: boolean; onclick: () => void; class?: string;
  } = $props();
</script>

<Toggle
  type="button"
  variant="outline"
  size="sm"
  class={cn("filter-chip px-3 text-[0.82rem] font-medium text-muted-foreground hover:border-primary hover:bg-transparent hover:text-primary-ink aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground", className)}
  pressed={active}
  {disabled}
  onPressedChange={() => onclick()}
>{label}</Toggle>
