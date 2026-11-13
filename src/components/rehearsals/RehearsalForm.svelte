<script lang="ts">
  import RehearsalSelection from './RehearsalSelection.svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { mergeRehearsalSongs, closestUpcomingSetlist, upcomingSetlists } from '$lib/rehearsals';
  import { lang } from '$lib/i18n';
  import { formatDate } from '$lib/utils';
  import * as Dialog from '$components/ui/dialog';
  import * as Popover from '$components/ui/popover';
  import * as Select from '$components/ui/select';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Textarea } from '$components/ui/textarea';
  import * as Field from '$components/ui/field';
  import { Alert, AlertDescription } from '$components/ui/alert';
  import { Calendar } from '$components/ui/calendar';
  import { parseDate, type DateValue } from '@internationalized/date';
  import type { RehearsalDraft } from '$lib/types';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { setlistsQuery } from '$lib/query/queries';
  import { useStore } from '$lib/store/bridge';
  import { rehearsalFormStore as form, formatInputDate, parseInputDate, selectAttendees, sameList } from '$lib/store/rehearsals';
  let { initial = {}, title, onsubmit, onclose }: {
    initial?: Partial<RehearsalDraft>; title?: string;
    onsubmit: (draft: RehearsalDraft) => Promise<void>; onclose: () => void;
  } = $props();
  const setlistsQ = createQuery(() => setlistsQuery());
  const setlists = $derived(setlistsQ.data ?? []);
  form.getState().init(initial, setlistsQ.data ?? []);
  const { patch } = form.getState();
  const dateText = useStore(form, s => s.dateText);
  const startTime = useStore(form, s => s.startTime);
  const location = useStore(form, s => s.location);
  const note = useStore(form, s => s.note);
  const autoSelect = useStore(form, s => s.autoSelect);
  const setlistId = useStore(form, s => s.setlistId);
  const datePickerOpen = useStore(form, s => s.datePickerOpen);
  const busy = useStore(form, s => s.busy);
  const error = useStore(form, s => s.error);
  const attendees = useStore(form, selectAttendees, sameList);
  const date = $derived(parseInputDate($dateText));
  const sortedSetlists = $derived(upcomingSetlists(setlists));
  $effect(() => {
    if (!$autoSelect || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const next = closestUpcomingSetlist(upcomingSetlists(setlists), date, $startTime)?.id ?? '';
    if (form.getState().setlistId !== next) patch({ setlistId: next });
  });
  const NONE = '__none__';
  const toCalendarValue = (iso: string): DateValue | undefined => { try { return parseDate(iso); } catch { return undefined; } };
  const calendarValue = $derived(toCalendarValue(date));
  const currentSetlist = $derived(setlists.find(s => s.id === $setlistId));
  const setlistLabel = (s: { name: string; date?: string }) => `${s.name}${s.date ? ` · ${formatDate(s.date, $lang)}` : ''}`;
  const setlistTriggerText = $derived(!$setlistId ? $rt.noSetlist : currentSetlist ? setlistLabel(currentSetlist) : $rt.unavailableSetlist);
  // Same look as the song edit modal: muted uppercase labels, 1rem app-font controls on the page background.
  const labelClass = 'text-small font-semibold uppercase tracking-[.04em] text-muted-foreground leading-normal';
  const field = 'rounded-md bg-background px-2.25 text-base mid:text-base font-normal normal-case tracking-normal';
  async function save(event: SubmitEvent) {
    event.preventDefault();
    const s = form.getState();
    if (s.busy) return;
    patch({ error: '' });
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) { patch({ error: $rt.invalidDate }); return; }
    patch({ busy: true });
    try {
      await onsubmit({ date, startTime: s.startTime, endTime: undefined, timeZone: s.timeZone, location: s.location.trim() || undefined, note: s.note.trim() || undefined, setlistId: s.setlistId || undefined, attendees: selectAttendees(s), songs: mergeRehearsalSongs(s.seed.songs ?? [], s.songs), cancelled: s.seed.cancelled ?? false });
    } catch (e) { patch({ error: String(e).includes('409') ? $rt.conflict : $rt.saveError }); }
    finally { patch({ busy: false }); }
  }
</script>

<Dialog.Root open={true} onOpenChange={value => { if (!value && !$busy) onclose(); }}>
  <Dialog.Content
    aria-describedby={undefined}
    onOpenAutoFocus={event => event.preventDefault()}
    class="rehearsal-dialog flex h-[min(820px,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-full flex-col gap-0 overflow-hidden rounded-2xl bg-card p-5.5 mid:max-w-[min(1100px,calc(100%-2rem))] max-mid:top-0 max-mid:left-0 max-mid:h-dvh max-mid:max-h-none max-mid:w-dvw max-mid:max-w-none max-mid:translate-x-0 max-mid:translate-y-0 max-mid:rounded-none max-mid:p-4"
  >
    <Dialog.Title class="mb-5 shrink-0 text-title font-bold leading-normal">{title ?? $rt.new}</Dialog.Title>
    <form onsubmit={save} class="flex min-h-0 flex-1 flex-col">
        {#snippet details()}
          <Field.Group class="min-w-0 gap-3.5">
            <div class="flex flex-wrap gap-2.5">
              <Field.Field class="flex-[1_1_160px] gap-1.5">
                <Field.Label for="rehearsal-date" class={labelClass}>{$rt.date}</Field.Label>
                <div class="relative">
                  <Input id="rehearsal-date" type="text" inputmode="decimal" value={$dateText} oninput={event => patch({ dateText: event.currentTarget.value })} placeholder="08.10.2026" pattern={'[0-9]{2}[.][0-9]{2}[.][0-9]{4}'} maxlength={10} required class="{field} pr-11" />
                  <Popover.Root open={$datePickerOpen} onOpenChange={value => patch({ datePickerOpen: value })}>
                    <Popover.Trigger>
                      {#snippet child({ props })}
                        <Button {...props} variant="ghost" size="icon" class="absolute top-0 right-0" aria-label={$rt.chooseDate}>📅</Button>
                      {/snippet}
                    </Popover.Trigger>
                    <Popover.Content class="w-auto p-0" align="start">
                      <Calendar type="single" value={calendarValue} locale={$lang === 'ru' ? 'ru-RU' : 'en-GB'} weekStartsOn={1} prevLabel={$rt.previous} nextLabel={$rt.next} onValueChange={value => { if (value) patch({ dateText: formatInputDate(value.toString()), datePickerOpen: false }); }} />
                    </Popover.Content>
                  </Popover.Root>
                </div>
              </Field.Field>
              <Field.Field class="flex-[1_1_110px] gap-1.5">
                <Field.Label for="rehearsal-start" class={labelClass}>{$rt.start}</Field.Label>
                <Input id="rehearsal-start" type="time" value={$startTime} oninput={event => patch({ startTime: event.currentTarget.value })} required class={field} />
              </Field.Field>
            </div>
            <Field.Field class="gap-1.5">
              <Field.Label for="rehearsal-location" class={labelClass}>{$rt.location}</Field.Label>
              <Input id="rehearsal-location" value={$location} oninput={event => patch({ location: event.currentTarget.value })} maxlength={500} class={field} />
            </Field.Field>
            <Field.Field class="gap-1.5">
              <Field.Label for="rehearsal-setlist" class={labelClass}>{$rt.setlist}</Field.Label>
              <Select.Root type="single" value={$setlistId || NONE} onValueChange={value => patch({ setlistId: value === NONE ? '' : value, autoSelect: false })}>
                <Select.Trigger id="rehearsal-setlist" class="{field} w-full min-w-0">
                  <span class="truncate">{setlistTriggerText}</span>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={NONE} label={$rt.noSetlist} />
                  {#if $setlistId && !sortedSetlists.some(s => s.id === $setlistId)}
                    <Select.Item value={$setlistId} label={setlistTriggerText} disabled />
                  {/if}
                  {#each sortedSetlists as setlist (setlist.id)}<Select.Item value={setlist.id} label={setlistLabel(setlist)} />{/each}
                </Select.Content>
              </Select.Root>
            </Field.Field>
            <Field.Field class="gap-1.5">
              <Field.Label for="rehearsal-note" class={labelClass}>{$rt.note}</Field.Label>
              <Textarea id="rehearsal-note" value={$note} oninput={event => patch({ note: event.currentTarget.value })} rows={6} maxlength={4000} class="{field} field-sizing-fixed min-h-36 resize-none py-2.25" />
            </Field.Field>
          </Field.Group>
        {/snippet}
      <Field.Set class="m-0 min-h-0 min-w-0 flex-1 gap-0 overflow-hidden border-0 p-0 [@media(max-height:550px)]:overflow-y-auto max-mid:overflow-y-auto max-mid:overscroll-contain" disabled={$busy}>
        <RehearsalSelection {details} />
      </Field.Set>
      <Dialog.Footer class="m-0 mt-3 shrink-0 flex-col gap-2 rounded-none border-t bg-transparent p-0 pt-3 mid:flex-col">
        {#if $error}<Alert variant="destructive" class="py-1.5"><AlertDescription>{$error}</AlertDescription></Alert>{/if}
        <div class="flex justify-end gap-2">
          <Button type="button" variant="outline" onclick={onclose} disabled={$busy}>{$rt.cancel}</Button>
          <Button type="submit" class="font-semibold" disabled={$busy}>{$busy ? $rt.pending : $rt.save}</Button>
        </div>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
