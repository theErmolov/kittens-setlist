<script lang="ts">
  import { onDestroy } from 'svelte';
  import { t } from '$lib/i18n';
  import LinkifiedText from '$components/shared/LinkifiedText.svelte';
  import { Button } from '$components/ui/button';
  import { Textarea } from '$components/ui/textarea';
  import { useStore } from '$lib/store/bridge';
  import { noteStore, defaultNoteUi } from '$lib/store/shell';

  let { value = '', label, onsave, preview = false, collapsible = false, mobileCollapsible = false, singleLineCollapsible = false }: {
    value?: string;
    label: string;
    onsave?: (value: string) => Promise<void>;
    preview?: boolean;
    collapsible?: boolean;
    mobileCollapsible?: boolean;
    singleLineCollapsible?: boolean;
  } = $props();

  // Per-instance UI state lives in the note store, keyed by this component's id.
  const id = $props.id();
  const ui = useStore(noteStore, s => s.notes[id] ?? defaultNoteUi);
  const mobile = useStore(noteStore, s => s.mobile);
  const patch = (p: Parameters<ReturnType<typeof noteStore.getState>['patch']>[1]) => noteStore.getState().patch(id, p);
  onDestroy(() => noteStore.getState().dispose(id));

  let expanded = $derived($ui.expanded);
  let editing = $derived($ui.editing);
  let saving = $derived($ui.saving);
  let failed = $derived($ui.failed);
  let long = $derived(collapsible && (value.length > 240 || value.split('\n').length > 3));
  let canExpand = $derived(long || ((singleLineCollapsible || (mobileCollapsible && $mobile)) && $ui.overflow));

  // Measures whether the collapsed text overflows its single line.
  function measureOverflow(element: HTMLElement) {
    value;
    expanded;
    if (!(mobileCollapsible || singleLineCollapsible)) return;
    const measure = () => {
      patch({ overflow: element.scrollHeight > parseFloat(getComputedStyle(element).lineHeight) + 1 });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }

  async function save() {
    patch({ saving: true, failed: false });
    try {
      await onsave?.($ui.draft);
      patch({ editing: false });
    } catch { patch({ failed: true }); }
    finally { patch({ saving: false }); }
  }
</script>

{#if value || onsave || editing}
  <!-- Keep editing notes from triggering row editing, adding, playing, or dragging. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="note" class:preview class:compact-actions={mobileCollapsible || singleLineCollapsible} onclick={(e) => { if (onsave) e.stopPropagation(); }} onkeydown={(e) => { if (onsave) e.stopPropagation(); }} onmousedown={(e) => { if (onsave) e.stopPropagation(); }} ondragstart={(e) => { e.stopPropagation(); e.preventDefault(); }}>
    {#if editing}
      <label>
        <span class="label">{label}</span>
        <Textarea class="my-1 min-h-16 resize-y bg-card text-base md:text-[0.85rem]" value={$ui.draft} oninput={e => patch({ draft: e.currentTarget.value })} maxlength={4000} rows={3} disabled={saving} />
      </label>
      <div class="actions">
        <Button size="sm" disabled={saving} onclick={save}>{saving ? '…' : $t.editor.save}</Button>
        <Button size="sm" variant="outline" disabled={saving} onclick={() => patch({ editing: false, failed: false })}>{$t.editor.cancel}</Button>
      </div>
      {#if failed}<span class="error" role="alert">{$t.common.commentSaveFailed}</span>{/if}
    {:else}
      {#if value}<div {@attach measureOverflow} class="text" class:collapsed={long && !expanded} class:mobile-collapsed={mobileCollapsible && !expanded} class:single-line-collapsed={singleLineCollapsible && !expanded}><span class="label">{label}: </span><LinkifiedText text={value} /></div>{/if}
      {#if canExpand}<Button variant="ghost" size="xs" class="edit px-0 text-[0.78rem] font-normal text-muted-foreground hover:bg-transparent" aria-expanded={expanded} onclick={(e) => { e.stopPropagation(); patch({ expanded: !expanded }); }}>{expanded ? $t.common.collapseComment : $t.common.expandComment}</Button>{/if}
      {#if onsave}<Button variant="ghost" size="xs" class="edit px-0 text-[0.78rem] font-normal text-muted-foreground hover:bg-transparent" onclick={() => patch({ draft: value, editing: true, failed: false })}>{value ? $t.common.edit : $t.common.addComment}{#if !mobileCollapsible && !singleLineCollapsible} · {label}{/if}</Button>{/if}
    {/if}
  </div>
{/if}

<style>
  .note { margin-top: 5px; font-size: 0.85rem; color: var(--text); min-width: 0; }
  .text { line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
  .text .label { margin-right: 4px; }
  .label { color: var(--text-muted); font-size: 0.78rem; }
  .collapsed { display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .single-line-collapsed { display: -webkit-box; -webkit-line-clamp: 1; line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
  .preview .text { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .compact-actions :global(.edit) { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; margin-right: 12px; }
  .actions { display: flex; gap: 6px; }
  .error { color: var(--c-danger); }
  @media (max-width: 700px) {
    .mobile-collapsed, .preview .text { display: -webkit-box; -webkit-line-clamp: 1; line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
  }
</style>
