<script lang="ts">
  import { Toggle } from '$components/ui/toggle';

  import { cn } from '$lib/utils';

  let { label, icon, iconOnlyOnMid = false, active, disabled = false, onclick, class: className }: {
    label: string; active: boolean; disabled?: boolean; onclick: () => void; class?: string;
    /** Leading emoji; with `iconOnlyOnMid` the text is hidden on mid-size screens (kept as the accessible name). */
    icon?: string; iconOnlyOnMid?: boolean;
  } = $props();
</script>

<Toggle
  type="button"
  variant="outline"
  size="sm"
  class={cn("filter-chip px-3 text-small font-medium text-muted-foreground hover:border-primary hover:bg-transparent hover:text-primary-ink aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground on:border-primary on:bg-primary on:text-primary-foreground on:hover:bg-primary/90 on:hover:text-primary-foreground", className)}
  pressed={active}
  aria-label={icon && iconOnlyOnMid ? label : undefined}
  title={icon && iconOnlyOnMid ? label : undefined}
  {disabled}
  onPressedChange={() => onclick()}
>{#if icon}<span aria-hidden="true">{icon}</span><span class={cn(iconOnlyOnMid && 'mid:max-big:hidden')}>{' '}{label}</span>{:else}{label}{/if}</Toggle>
