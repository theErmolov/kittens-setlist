<script lang="ts">
  /**
   * Date + time of an event as a breadcrumb page item (rehearsal detail, setlist editor): localized date in
   * foreground semibold, time to its right in the brand colour (a darker shade when the event is in the past).
   * Must live inside a shadcn `Breadcrumb.Item`.
   */
  import * as Breadcrumb from '$components/ui/breadcrumb';
  import { timeText } from '$components/rehearsals/classes';
  import { lang } from '$lib/i18n';
  import { cn, formatDate } from '$lib/utils';

  let { date, time, past = false, prefix = '', class: className }: {
    /** ISO date (YYYY-MM-DD). */
    date?: string;
    /** Time text, e.g. `19:00` or `19:00–21:00`. */
    time?: string;
    past?: boolean;
    /** Glyph shown before the time in the time's colour (e.g. ▶). */
    prefix?: string;
    class?: string;
  } = $props();
</script>

{#if date || time}
  <div class={cn('flex items-baseline gap-2 whitespace-nowrap', className)}>
    {#if date}<Breadcrumb.Page class="font-semibold">{formatDate(date, $lang)}</Breadcrumb.Page>{/if}
    {#if time}<span class={cn('font-semibold', timeText(past))}>{prefix}{time}</span>{/if}
  </div>
{/if}
