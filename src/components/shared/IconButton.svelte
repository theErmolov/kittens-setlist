<script lang="ts">
  /**
   * Icon-only button: shadcn Button (or Toggle when `pressed` is given) showing an emoji `icon`, with the
   * `label` as tooltip and accessible name. Use it instead of text buttons in toolbars/rows. Emoji are the app's
   * icon system (rendered as local Noto SVGs; every new emoji needs its SVG in static/emoji/).
   */
  import type { Snippet } from 'svelte';
  import { Button, type ButtonVariant } from '$components/ui/button';
  import { Toggle } from '$components/ui/toggle';
  import * as Tooltip from '$components/ui/tooltip';
  import { cn } from '$lib/utils';

  let {
    icon, label, text, variant = 'outline', pressed, expanded, onpressedchange, onclick, href, disabled = false, class: className, children, ...rest
  }: {
    icon: string;
    /** Visible text next to the icon on the big tier (the button widens); smaller tiers stay icon-only. */
    text?: string;
    /** Tooltip text and aria-label (always required: the button has no visible text). */
    label: string;
    variant?: ButtonVariant;
    /** When defined the button is a toggle with this pressed state. */
    pressed?: boolean;
    /** Sets aria-expanded (disclosure buttons). */
    expanded?: boolean;
    onpressedchange?: (pressed: boolean) => void;
    onclick?: (event: MouseEvent) => void;
    href?: string;
    disabled?: boolean;
    class?: string;
    /** Optional extra content after the icon (e.g. a count). */
    children?: Snippet;
    /** Extra attributes (data-*, etc.) forwarded to the button. */
    [key: `data-${string}`]: string | undefined;
  } = $props();

  // The filter button: its glyph is never tinted (it keeps its own colours on every fill) and it has no border.
  const size = $derived(cn('size-10 min-w-10 p-0 text-lg leading-none', text && 'big:w-auto big:gap-2 big:px-3.5', icon === '🎛️' && 'no-tint border-0', icon === '⠿' && 'border-0', variant === 'default' && 'border-0 bg-clip-border'));
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      {#if pressed !== undefined}
        <Toggle {...props} {...rest} variant="outline" {pressed} onPressedChange={onpressedchange} {disabled} aria-label={label} class={cn(size, className)}>
          <span aria-hidden="true">{icon}</span>{#if text}<span class="max-big:hidden text-sm font-semibold">{text}</span>{/if}{@render children?.()}
        </Toggle>
      {:else}
        <Button {...props} {...rest} {variant} {href} {onclick} {disabled} aria-label={label} aria-expanded={expanded} class={cn(size, className)}>
          <span aria-hidden="true">{icon}</span>{#if text}<span class="max-big:hidden text-sm font-semibold">{text}</span>{/if}{@render children?.()}
        </Button>
      {/if}
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content>{label}</Tooltip.Content>
</Tooltip.Root>
