<script lang="ts">
  import VibeBadge from '$components/shared/VibeBadge.svelte';
  import { Button } from '$components/ui/button';
  import * as Dialog from '$components/ui/dialog';
  import { Textarea } from '$components/ui/textarea';
  import { mobileFullscreen } from '../dialogClasses';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import { Switch } from '$components/ui/switch';
  import { Badge } from '$components/ui/badge';
  import * as NavigationMenu from '$components/ui/navigation-menu';
  import * as Breadcrumb from '$components/ui/breadcrumb';
  import IconButton from '$components/shared/IconButton.svelte';
  import EditorMetaButtons from './EditorMetaButtons.svelte';
  import EditorActionsMenu from './EditorActionsMenu.svelte';
  import LinkifiedText from '$components/shared/LinkifiedText.svelte';
  import DateTimeCrumb from '$components/shared/DateTimeCrumb.svelte';
  import PageControlsDivider from '$components/shared/PageControlsDivider.svelte';
  import PageControls from '$components/shared/PageControls.svelte';
  import { pressedOn } from '../classes';
  import { base } from '$app/paths';
  import { lang, t } from '$lib/i18n';
  import { canWrite } from '$lib/auth';
  import { formatDuration, formatDate } from '$lib/utils';
  import { useStore } from '$lib/store/bridge';
  import { setlistEditorStore } from '$lib/store/setlistEditor';
    import { useEditorData } from './editorData.svelte';
  import { useStore as useZustand } from '$lib/store/bridge';
  import { dragModeStore } from '$lib/store/drag';
  import { notePopoverStore } from '$lib/store/notePopover';
  const dragEnabled = useZustand(dragModeStore, s => s.enabled);

  const data = useEditorData();
  const actions = setlistEditorStore.getState();
  const setlistId = useStore(setlistEditorStore, s => s.setlistId);
  const draftMeta = useStore(setlistEditorStore, s => s.draftMeta);
  const editingMeta = useStore(setlistEditorStore, s => s.editingMeta);
  const filterOpen = useStore(setlistEditorStore, s => s.filterOpen);

  // The event (date + start time) is already behind us, in local time.
  const past = $derived.by(() => {
    if (!data.meta.date) return false;
    const at = new Date(`${data.meta.date}T${data.meta.startTime || '23:59'}`);
    return !isNaN(at.getTime()) && at.getTime() < Date.now();
  });


</script>

<!-- Sticky NavigationMenu bar under the top tabs. Small tier shows a slim version: breadcrumb + comment/edit; the rest lives in the bottom bar + filter drawer. -->
<h1 class="sr-only">{data.meta.name}</h1>
<!-- Small screens: no top bar — the controls live in the bottom bar (see EditorFilters) and the date / name in the line below. -->
<div class="contents max-mid:hidden">
  <PageControls label={data.meta.name}>
    {#snippet start()}
      <NavigationMenu.Item class="min-w-0">
        <Breadcrumb.Root>
          <Breadcrumb.List class="flex-nowrap text-[0.88rem]">
            <Breadcrumb.Item class="max-mid:hidden"><Breadcrumb.Link href="{base}/setlists">{$t.nav.setlists}</Breadcrumb.Link></Breadcrumb.Item>
            <Breadcrumb.Separator class="max-mid:hidden" />
            <Breadcrumb.Item class="min-w-0 flex-col items-start gap-0.5 py-0.5">
              <!-- Title first (bigger, bolder), the date and time under it. -->
              <span class="block max-w-[28ch] truncate text-[1.05rem] leading-tight font-extrabold text-foreground min-[1100px]:max-w-[40ch]" title={data.meta.name}>{data.meta.name}</span>
              {#if data.meta.date || data.meta.startTime}
                <DateTimeCrumb date={data.meta.date || undefined} time={data.meta.startTime || undefined} {past} />
              {/if}
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb.Root>
      </NavigationMenu.Item>
      <!-- The setlist comment sits right of the title (links shown as «domain.tld»). -->
      {#if data.comment}
        <PageControlsDivider />
        <NavigationMenu.Item class="min-w-0"><span class="block truncate text-[.85rem] text-muted-foreground" title={data.comment}><LinkifiedText text={data.comment} /></span></NavigationMenu.Item>
      {/if}
    {/snippet}
    {#snippet end()}
      <NavigationMenu.Item class="max-mid:hidden"><IconButton icon="🎛️" label={$t.editor.filter} class={pressedOn} pressed={$filterOpen || data.isFiltered} onpressedchange={() => actions.toggleFilterOpen()} /></NavigationMenu.Item>
      {#if $canWrite}
        <NavigationMenu.Item class="max-mid:hidden"><IconButton icon="⠿" label={$t.common.dragMode} class={pressedOn} pressed={$dragEnabled} onpressedchange={() => dragModeStore.getState().toggle()} /></NavigationMenu.Item>
      {/if}
      {#if $canWrite}<NavigationMenu.Item><EditorActionsMenu /></NavigationMenu.Item>{/if}
      <NavigationMenu.Item class="flex gap-2"><EditorMetaButtons /></NavigationMenu.Item>
      <NavigationMenu.Item><IconButton icon="🎤" label={$t.editor.stageView} variant="secondary" class="no-tint size-10 border-0 bg-clip-border" href="{base}/setlists/{$setlistId}/stage" /></NavigationMenu.Item>
    {/snippet}
  </PageControls>
</div>

<!-- Mobile: the table header is hidden, so counts + vibe live in a slim line under the bar. -->
<div class="hidden shrink-0 flex-col gap-0.5 bg-(--table-selected) px-3 pt-2 max-mid:flex">
  <!-- Title (bigger, bolder) with the setlist comment to its right (links shown as «domain.tld»), then the date and time. -->
  <div class="flex min-w-0 items-baseline gap-x-3">
    <span class="shrink-0 truncate text-[1.05rem] leading-tight font-extrabold text-foreground" title={data.meta.name}>{data.meta.name}</span>
    {#if data.comment}<span class="min-w-0 flex-1 truncate text-[.85rem] leading-tight text-muted-foreground" title={data.comment}><LinkifiedText text={data.comment} /></span>{/if}
  </div>
  {#if data.meta.date || data.meta.startTime}<DateTimeCrumb date={data.meta.date || undefined} time={data.meta.startTime || undefined} {past} />{/if}
</div>
<div class="hidden shrink-0 items-center gap-2 border-b bg-(--table-selected) px-3 py-1.5 text-[0.78rem] text-muted-foreground max-mid:flex">
  <VibeBadge vibe={data.meta.vibe} class="px-1.5 text-[0.65rem]" />
  <span>{$t.editor.songs(data.songCount)} ({formatDuration(data.totalMinutes, $lang)})</span>
  {#if data.songCount > 0}<span class="font-semibold text-success-ink">{$t.progress.readyCount(data.readyCount, data.songCount)}</span>{/if}
</div>

<Dialog.Root open={$editingMeta && $canWrite} onOpenChange={(o) => { if (!o) actions.cancelEditMeta(); }}>
  <Dialog.Content class="max-h-[calc(100dvh-1rem)] grid-cols-[minmax(0,1fr)] gap-3 overflow-y-auto max-sm:grid-rows-[auto_1fr_auto] sm:max-w-md {mobileFullscreen}">
    <Dialog.Header><Dialog.Title class="text-[1.1rem] font-bold">{$t.editor.edit}</Dialog.Title></Dialog.Header>
    <div class="flex min-w-0 flex-col gap-3">
      <Input value={$draftMeta.name} oninput={(e) => actions.setDraftMeta({ name: e.currentTarget.value })} placeholder={$t.editor.namePlaceholder} aria-label={$t.editor.namePlaceholder} />
      <div class="flex flex-wrap gap-2">
        <Input type="date" class="min-w-[140px] flex-1" value={$draftMeta.date} oninput={(e) => actions.setDraftMeta({ date: e.currentTarget.value })} />
        <Input type="time" class="min-w-[120px] flex-1" value={$draftMeta.startTime} oninput={(e) => actions.setDraftMeta({ startTime: e.currentTarget.value })} />
      </div>
      <Textarea class="field-sizing-fixed min-h-40 w-full min-w-0 resize-none bg-background break-all" value={$draftMeta.comment} oninput={(e) => actions.setDraftMeta({ comment: e.currentTarget.value })} maxlength={4000} rows={7} placeholder={$t.common.setlistComment} aria-label={$t.common.setlistComment} />
      <div class="flex items-center gap-2">
        <Switch id="meta-vibe" size="sm" checked={$draftMeta.vibe} onCheckedChange={(v) => actions.setDraftMeta({ vibe: v })} />
        <Label for="meta-vibe" class="text-[0.88rem] font-normal text-muted-foreground">{$t.setlists.vibe}</Label>
        <span class="inline-flex size-4 shrink-0 cursor-default items-center justify-center rounded-full border text-[0.7rem] leading-none text-muted-foreground" title={$t.setlists.vibeTooltip}>?</span>
      </div>
    </div>
    <Dialog.Footer class="max-sm:mt-auto">
      <Button variant="outline" onclick={() => actions.cancelEditMeta()}>{$t.editor.cancel}</Button>
      <Button onclick={() => actions.saveMeta()} disabled={!$draftMeta.name.trim()}>{$t.editor.save}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
