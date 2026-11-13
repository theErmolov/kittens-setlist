<script lang="ts">
  /**
   * A guest musician's tag next to a song title: the instrument icons and the name in a small chip.
   * One component for every list (catalog, setlist editor, rehearsal). A `stage` highlights it with that learning stage's
   * tint as the BACKGROUND only (text stays normal); without one it is the plain chip. `onclick` makes it a button.
   */
  import type { Instrument, LearningStage } from '$lib/types';
  import { Badge } from '$components/ui/badge';
  import { INSTRUMENT_ICONS, cn } from '$lib/utils';
  import { stageCellClass } from '$lib/palette';

  let { name, instruments, stage, base = 'surface', onclick, disabled = false, label, class: className }: {
    name: string;
    instruments: Instrument[];
    /** Learning stage to highlight with (omit for the plain chip). */
    stage?: LearningStage;
    /** What the tint is drawn over: the page (catalog) or the card surface (setlist tables). */
    base?: 'bg' | 'surface';
    onclick?: (el: HTMLElement) => void;
    disabled?: boolean;
    label?: string;
    class?: string;
  } = $props();

  const cls = $derived(cn('shrink-0 gap-0.5 rounded-soft border-0 bg-(--chip-bg) px-1.75 py-px text-tiny font-normal text-foreground', onclick && 'cursor-pointer hover:brightness-95', disabled && 'opacity-40 grayscale', stage && stageCellClass(stage, base), className));
</script>

{#snippet content()}<span>{#each instruments as inst (inst)}<span>{INSTRUMENT_ICONS[inst]}</span>{/each}</span> {name}{/snippet}

{#if onclick}
  <Badge
    role="button"
    tabindex={disabled ? -1 : 0}
    aria-disabled={disabled}
    aria-label={label}
    class={cls}
    onclick={(e: MouseEvent) => { e.stopPropagation(); if (!disabled) onclick(e.currentTarget as HTMLElement); }}
    onkeydown={(e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); e.stopPropagation(); onclick(e.currentTarget as HTMLElement); } }}
  >{@render content()}</Badge>
{:else}
  <Badge class={cls}>{@render content()}</Badge>
{/if}
