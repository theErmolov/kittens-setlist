<script lang="ts" generics="T">
  /**
   * Month calendar card shared by the setlists and rehearsals pages: one cell style (past / today / selected / hover ring),
   * items grouped by ISO date (`YYYY-MM-DD`) and rendered by the page through `dayContent`.
   * Selection is controlled (`selected` + `onselect`), so a page may ignore a click (e.g. to open an item instead).
   * The visible month is controlled through `placeholder` (an ISO date) + `onplaceholderchange`, or kept internally when omitted.
   */
  import type { Snippet } from 'svelte';
  import { parseDate, type DateValue } from '@internationalized/date';
  import { Calendar, Day as CalendarDay } from '$components/ui/calendar';
  import * as Card from '$components/ui/card';
  import { localDate } from '$lib/rehearsals';
  import { cn, isoDate } from '$lib/utils';
  import { useStore } from '$lib/store/bridge';
  import { calendarStore } from '$lib/store/calendar';

  let {
    items,
    selected = null,
    onselect,
    placeholder,
    onplaceholderchange,
    lang,
    label,
    prevLabel,
    nextLabel,
    dayLabel,
    dayContent,
    toolbar
  }: {
    /** Items per ISO date; days without an entry are empty. */
    items: Record<string, T[]>;
    /** The selected ISO date. */
    selected?: string | null;
    /** Called with the clicked ISO date, or null when the selected day is clicked again. */
    onselect?: (iso: string | null) => void;
    /** ISO date inside the visible month (the page keeps it in its store). */
    placeholder: string;
    onplaceholderchange: (iso: string) => void;
    lang: string;
    /** Accessible name of the card region. */
    label?: string;
    prevLabel?: string;
    nextLabel?: string;
    /** Accessible name of a day cell. */
    dayLabel: (iso: string, dayItems: T[]) => string;
    /** Content of a day cell under its number. */
    dayContent: Snippet<[{ items: T[]; iso: string; past: boolean }]>;
    /** Buttons laid over the month heading (the heading then leaves room for them). */
    toolbar?: Snippet;
  } = $props();

  const today = localDate();
  const toIso = (d: DateValue) => isoDate(d.year, d.month, d.day);

  // The pointer's date comes from the shared calendar store, so a page can link its list items to the days.
  const hoverIso = useStore(calendarStore, s => s.hoverIso);
  const { setHoverIso } = calendarStore.getState();
  const placeholderValue = $derived(parseDate(placeholder));
  const calendarValue = $derived(selected ? parseDate(selected) : undefined);
</script>

<Card.Root class="min-w-0 gap-3 p-4 max-mid:p-2" role="region" aria-label={label}>
  <div class="relative [--cell-size:--spacing(12)] max-mid:[--cell-size:--spacing(11)]">
    {#if toolbar}
      <div class="absolute top-[calc((var(--cell-size)-40px)/2)] right-[calc(var(--cell-size)+8px)] z-10">{@render toolbar()}</div>
    {/if}
    <Calendar
      type="single"
      bind:value={() => calendarValue, v => onselect?.(v ? toIso(v) : null)}
      bind:placeholder={() => placeholderValue, v => { if (v) onplaceholderchange(toIso(v)); }}
      fixedWeeks
      {prevLabel}
      {nextLabel}
      weekStartsOn={1}
      locale={lang === 'ru' ? 'ru-RU' : 'en-GB'}
      class={cn('w-full bg-transparent p-0 [--cell-size:--spacing(12)] max-mid:[--cell-size:--spacing(11)] [&_[data-calendar-header]]:capitalize [&_[role=gridcell]]:flex [&_[role=gridcell]]:h-auto [&_[role=gridcell]]:w-auto [&_[role=gridcell]]:flex-1 [&_th]:w-auto [&_th]:flex-1',
        toolbar && '[&_[data-calendar-header]]:justify-start [&_[data-calendar-header]]:pl-[calc(var(--cell-size)+8px)]')}
    >
      {#snippet day({ day: date })}
        {@const iso = toIso(date)}
        {@const dayItems = items[iso] ?? []}
        {@const past = iso < today}
        {@const isToday = iso === today}
        <CalendarDay
          onpointerenter={() => setHoverIso(dayItems.length ? iso : null)}
          onpointerleave={() => setHoverIso(null)}
          class={cn('group/day data-[selected]:hover:text-primary-foreground mx-auto h-auto min-h-(--cell-size) w-[calc(100%-4px)] justify-start gap-1 py-1.5 data-outside-month:opacity-45',
            past ? 'bg-neutral-soft/70 text-neutral-ink' : 'bg-card text-foreground ring-1 ring-border ring-inset',
            isToday && 'bg-primary/40 font-bold text-primary-ink ring-1 ring-primary-ink',
            dayItems.length > 0 && $hoverIso === iso && 'ring-2 ring-primary ring-inset')}
          aria-label={dayLabel(iso, dayItems)}
        >
          <span class="leading-none">{date.day}</span>
          {@render dayContent({ items: dayItems, iso, past })}
        </CalendarDay>
      {/snippet}
    </Calendar>
  </div>
</Card.Root>
