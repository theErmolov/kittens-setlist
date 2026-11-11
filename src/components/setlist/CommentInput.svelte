<script lang="ts">
  import { Input } from '$components/ui/input';
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
  let inputEl = $state<HTMLInputElement | null>(null); // DOM handle only (not UI state)
  const { setValue, setFocused } = draft.getState();
  $effect(() => { const v = initial; if (!draft.getState().focused) setValue(v); });
</script>

<!-- Inline note field: shadcn Input restyled as a borderless dashed-underline line so the song table looks unchanged. -->
{#if showLinks}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="block h-6 w-full cursor-text truncate border-b border-dashed text-base leading-6 italic sm:text-[0.94rem] {className}"
    draggable="false"
    onmousedown={(e) => e.stopPropagation()}
    onclick={(e) => { e.stopPropagation(); setFocused(true); queueMicrotask(() => inputEl?.focus()); }}
  ><LinkifiedText text={$value} /></div>
{/if}
<Input
  bind:ref={inputEl}
  class="{showLinks ? 'hidden' : 'block'} h-6 w-full rounded-none border-0 border-b border-dashed bg-transparent px-0 text-base italic shadow-none transition-colors placeholder:opacity-50 focus-visible:border-primary focus-visible:ring-0 dark:bg-transparent sm:text-[0.94rem] {className}"
  value={$value}
  oninput={(e) => setValue(e.currentTarget.value)}
  placeholder={$t.common.commentPlaceholder}
  draggable="false"
  onmousedown={(e) => e.stopPropagation()}
  onclick={(e) => e.stopPropagation()}
  ondragstart={(e) => { e.stopPropagation(); e.preventDefault(); }}
  onfocus={() => setFocused(true)}
  onblur={() => { setFocused(false); const v = draft.getState().value; if (v !== (initial ?? '')) onsave(v); }}
/>
