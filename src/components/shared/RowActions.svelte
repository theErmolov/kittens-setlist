<script lang="ts">
  /**
   * The actions of a table row behind ONE icon button (🔧 → DropdownMenu or, on small and mid screens, a bottom drawer). Use it instead of a row of action buttons.
   * Items: `{ icon (emoji), label, onselect | href, destructive?, disabled?, separatorBefore? }`.
   * Emoji and label are separate elements so a language switch can update the label text (the emoji→image converter
   * would otherwise freeze a text node that contains an emoji).
   */
  import * as DropdownMenu from '$components/ui/dropdown-menu';
  import { Button, buttonVariants } from '$components/ui/button';
  import * as Drawer from '$components/ui/drawer';
  import IconButton from './IconButton.svelte';
  import { useStore } from '$lib/store/bridge';
  import { noteStore } from '$lib/store/shell';
  import { t } from '$lib/i18n';
  import { cn, stripLeadingEmoji } from '$lib/utils';

  export interface RowAction {
    icon?: string;
    label: string;
    onselect?: () => void;
    href?: string;
    destructive?: boolean;
    /** Highlighted in the primary colour (the main action of the menu). */
    primary?: boolean;
    disabled?: boolean;
    separatorBefore?: boolean;
  }

  let { actions, label, class: className, disabled = false, drawer = false, icon = '🔧', variant = 'outline', text, inline = false, showText = false }: {
    actions: RowAction[];
    /** Accessible name / tooltip of the trigger (default: «Действия»). */
    label?: string;
    class?: string;
    disabled?: boolean;
    /** Always open in the bottom drawer (otherwise only below the big tier). */
    drawer?: boolean;
    /** Trigger glyph (default 🔧). */
    icon?: string;
    /** Trigger colour: a plain outlined button (default), the secondary accent fill or the solid primary fill. */
    variant?: 'secondary' | 'default' | 'outline';
    /** Visible text next to the glyph on the big tier (the trigger widens); smaller tiers stay icon-only. */
    text?: string;
    /** On the big tier show every action as its own icon button (`'bare'` = no wrapper, the buttons take `class`) instead of one menu. */
    inline?: boolean | 'bare';
    /** Inline buttons also show the action's label next to the icon on the big tier. */
    showText?: boolean;
  } = $props();

  // Some i18n labels start with their own emoji («🎤 Сцена»); the item already shows its icon, so drop a leading emoji from the text.
  /** Small and mid screens: the actions open in a bottom drawer instead of a dropdown menu. */
  const narrow = useStore(noteStore, s => s.narrow);
  const visible = $derived(actions.filter(a => a.label).map(a => ({ ...a, label: stripLeadingEmoji(a.label) })));
</script>

{#if visible.length && inline && !$narrow && !drawer}
  {#snippet buttons()}
    {#each visible as action (action.label)}
      <IconButton
        icon={action.icon ?? icon}
        text={showText ? action.label : undefined}
        label={action.label}
        {variant}
        href={action.href}
        disabled={disabled || action.disabled}
        class={cn('border-0 bg-transparent hover:bg-foreground/5', action.destructive && 'hover:text-destructive', inline === 'bare' && className)}
        onclick={(e) => { e.stopPropagation(); action.onselect?.(); }}
      />
    {/each}
  {/snippet}
  {#if inline === 'bare'}{@render buttons()}{:else}<div class={cn('flex items-center gap-2', className)}>{@render buttons()}</div>{/if}
{:else if visible.length && ($narrow || drawer)}
  <Drawer.Root>
    <Drawer.Trigger
      {disabled}
      aria-label={label ?? $t.common.actions}
      title={label ?? $t.common.actions}
      class={cn(buttonVariants({ variant }), 'size-10 min-w-10 p-0 text-lg leading-none', variant === 'outline' ? 'border-0 bg-transparent hover:bg-foreground/5' : 'border-0 bg-clip-border', className)}
      onclick={(e: MouseEvent) => e.stopPropagation()}
    ><span aria-hidden="true">{icon}</span></Drawer.Trigger>
    <!-- z-70: above the pages' bottom bars (z-40…60), which would otherwise cover the last actions. -->
    <Drawer.Content class="z-70" overlayClass="z-70" onclick={(e: MouseEvent) => e.stopPropagation()}>
      <Drawer.Header class="sr-only"><Drawer.Title>{label ?? $t.common.actions}</Drawer.Title></Drawer.Header>
      <div class="flex flex-col gap-1 p-2 pb-4">
        {#each visible as action (action.label)}
          {#if action.separatorBefore}<div class="my-1 h-px bg-border" role="separator"></div>{/if}
          {#if action.href}
            <a href={action.href} class="flex h-12 items-center gap-3 rounded-lg px-3 text-base no-underline hover:bg-accent {action.destructive ? 'text-destructive' : action.primary ? 'font-semibold text-primary-ink' : 'text-foreground'}">
              {#if action.icon}<span aria-hidden="true" class="w-6 text-center text-lg">{action.icon}</span>{/if}<span>{action.label}</span>
            </a>
          {:else}
            <Drawer.Close
              disabled={action.disabled}
              class="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base hover:bg-accent disabled:opacity-50 {action.destructive ? 'text-destructive' : action.primary ? 'font-semibold text-primary-ink' : 'text-foreground'}"
              onclick={() => action.onselect?.()}
            >
              {#if action.icon}<span aria-hidden="true" class="w-6 text-center text-lg">{action.icon}</span>{/if}<span>{action.label}</span>
            </Drawer.Close>
          {/if}
        {/each}
      </div>
    </Drawer.Content>
  </Drawer.Root>
{:else if visible.length}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          {variant}
          {disabled}
          aria-label={label ?? $t.common.actions}
          title={label ?? $t.common.actions}
          class={cn('size-10 min-w-10 p-0 text-lg leading-none', text && 'big:w-auto big:gap-2 big:px-3.5 big:text-sm big:font-semibold', variant === 'outline' ? 'border-0 bg-transparent hover:bg-foreground/5' : 'border-0 bg-clip-border', className)}
          onclick={(e: MouseEvent) => { e.stopPropagation(); (props as { onclick?: (e: MouseEvent) => void }).onclick?.(e); }}
        ><span aria-hidden="true" class="text-lg">{icon}</span>{#if text}<span class="max-big:hidden">{text}</span>{/if}</Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-max min-w-44 max-w-[calc(100vw-1rem)]" onclick={(e: MouseEvent) => e.stopPropagation()}>
      {#each visible as action (action.label)}
        {#if action.separatorBefore}<DropdownMenu.Separator />{/if}
        <DropdownMenu.Item
          variant={action.destructive ? 'destructive' : 'default'}
          disabled={action.disabled}
          onSelect={() => action.onselect?.()}
          class="gap-2.5 py-2 text-body-lg whitespace-nowrap {action.primary ? 'font-semibold text-primary-ink' : ''}"
        >
          {#if action.href}
            <a href={action.href} class="flex w-full items-center gap-2.5 whitespace-nowrap">
              {#if action.icon}<span aria-hidden="true" class="w-5 text-center">{action.icon}</span>{/if}<span>{action.label}</span>
            </a>
          {:else}
            {#if action.icon}<span aria-hidden="true" class="w-5 text-center">{action.icon}</span>{/if}<span>{action.label}</span>
          {/if}
        </DropdownMenu.Item>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/if}
