<script lang="ts">
  /**
   * The actions of a table row behind ONE icon button («⋯» → DropdownMenu). Use it instead of a row of action buttons.
   * Items: `{ icon (emoji), label, onselect | href, destructive?, disabled?, separatorBefore? }`.
   * Emoji and label are separate elements so a language switch can update the label text (the emoji→image converter
   * would otherwise freeze a text node that contains an emoji).
   */
  import * as DropdownMenu from '$components/ui/dropdown-menu';
  import { Button } from '$components/ui/button';
  import { t } from '$lib/i18n';
  import { cn } from '$lib/utils';

  export interface RowAction {
    icon?: string;
    label: string;
    onselect?: () => void;
    href?: string;
    destructive?: boolean;
    disabled?: boolean;
    separatorBefore?: boolean;
  }

  let { actions, label, class: className, disabled = false }: {
    actions: RowAction[];
    /** Accessible name / tooltip of the trigger (default: «Действия»). */
    label?: string;
    class?: string;
    disabled?: boolean;
  } = $props();

  // Some i18n labels start with their own emoji («🎤 Сцена»); the item already shows its icon, so drop a leading emoji from the text.
  const plain = (text: string) => text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');
  const visible = $derived(actions.filter(a => a.label).map(a => ({ ...a, label: plain(a.label) })));
</script>

{#if visible.length}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="outline"
          {disabled}
          aria-label={label ?? $t.common.actions}
          title={label ?? $t.common.actions}
          class={cn('size-10 min-w-10 p-0 text-lg leading-none', className)}
          onclick={(e: MouseEvent) => { e.stopPropagation(); (props as { onclick?: (e: MouseEvent) => void }).onclick?.(e); }}
        ><span aria-hidden="true">⋯</span></Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-max min-w-44 max-w-[calc(100vw-1rem)]" onclick={(e: MouseEvent) => e.stopPropagation()}>
      {#each visible as action (action.label)}
        {#if action.separatorBefore}<DropdownMenu.Separator />{/if}
        <DropdownMenu.Item
          variant={action.destructive ? 'destructive' : 'default'}
          disabled={action.disabled}
          onSelect={() => action.onselect?.()}
          class="gap-2.5 py-2 text-[0.9rem] whitespace-nowrap"
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
