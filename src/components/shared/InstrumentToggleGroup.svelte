<script lang="ts">
  /** One icon toggle per instrument (name as tooltip and accessible label), used by the catalog filters. */
  import type { Instrument } from '$lib/types';
  import { t } from '$lib/i18n';
  import { INSTRUMENT_ICONS, INSTRUMENT_ORDER, cn } from '$lib/utils';
  import { Toggle } from '$components/ui/toggle';

  let { selected, onToggle, class: className, itemClass }: {
    selected: ReadonlySet<Instrument>;
    onToggle: (inst: Instrument) => void;
    /** Wrapper classes. */
    class?: string;
    /** Extra classes of every toggle (size). */
    itemClass?: string;
  } = $props();
</script>

<div class={className}>
  {#each INSTRUMENT_ORDER as inst (inst)}
    <Toggle
      type="button"
      variant="outline"
      size="sm"
      class={cn('hover:border-primary hover:bg-transparent on:border-primary on:bg-primary on:text-primary-foreground', itemClass)}
      pressed={selected.has(inst as Instrument)}
      onPressedChange={() => onToggle(inst as Instrument)}
      aria-label={$t.instrument[inst as Instrument]}
      title={$t.instrument[inst as Instrument]}
    ><span aria-hidden="true">{INSTRUMENT_ICONS[inst]}</span></Toggle>
  {/each}
</div>
