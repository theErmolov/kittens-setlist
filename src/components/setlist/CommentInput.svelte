<script lang="ts">
  import { Textarea } from '$components/ui/textarea';
  import { t } from '$lib/i18n';
  import { splitLinks } from '$lib/linkify';
  import LinkifiedText from '$components/shared/LinkifiedText.svelte';
  import { useStore } from '$lib/store/bridge';
  import { createCommentDraftStore } from '$lib/store/stage';

  let {
    value: initial = '',
    onsave,
    class: className = ''
  }: {
    value?: string;
    onsave: (v: string) => void;
    /** Extra classes for the text (e.g. to drop the italic style). */
    class?: string;
  } = $props();

  const draft = createCommentDraftStore(initial);
  const value = useStore(draft, s => s.value);
  const focused = useStore(draft, s => s.focused);
  // Unfocused comments that contain a URL show it as a clickable «domain.tld» link; clicking elsewhere on the line edits.
  const hasLink = $derived(splitLinks($value).some(part => part.type === 'link'));
  const showLinks = $derived(hasLink && !$focused);
  let inputEl = $state<HTMLTextAreaElement | null>(null); // DOM handle only (not UI state)
  const { setValue, setFocused } = draft.getState();
  $effect(() => { const v = initial; if (!draft.getState().focused) setValue(v); });
</script>

<!-- Inline note field: a borderless dashed-underline textarea that grows with its text (multi-line; Enter saves, Shift+Enter adds a line). -->
{#if showLinks}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="block min-h-6 w-full cursor-text border-b border-dashed text-base leading-6 break-words whitespace-pre-wrap italic mid:text-body-lg {className}"
    draggable="false"
    onmousedown={(e) => e.stopPropagation()}
    onclick={(e) => { e.stopPropagation(); setFocused(true); queueMicrotask(() => inputEl?.focus()); }}
  ><LinkifiedText text={$value} /></div>
{/if}
<Textarea
  bind:ref={inputEl}
  rows={1}
  class="{showLinks ? 'hidden' : 'block'} field-sizing-content min-h-6 w-full resize-none rounded-none border-0 border-b border-dashed bg-transparent px-0 py-0 text-base leading-6 italic shadow-none transition-colors placeholder:opacity-50 focus-visible:border-primary focus-visible:ring-0 mid:text-body-lg mid:text-body-lg {className}"
  value={$value}
  oninput={(e) => setValue(e.currentTarget.value)}
  placeholder={$t.common.commentPlaceholder}
  draggable="false"
  onmousedown={(e) => e.stopPropagation()}
  onclick={(e) => e.stopPropagation()}
  ondragstart={(e) => { e.stopPropagation(); e.preventDefault(); }}
  onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }}
  onfocus={() => setFocused(true)}
  onblur={() => { setFocused(false); const v = draft.getState().value; if (v !== (initial ?? '')) onsave(v); }}
/>
