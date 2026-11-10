<script lang="ts">
  /** Comment/note text where every URL becomes a clickable «domain.tld» link (opens in a new tab). Plain text otherwise. */
  import { splitLinks } from '$lib/linkify';

  let { text }: { text: string | undefined | null } = $props();
  const parts = $derived(splitLinks(text ?? ''));
</script>

{#each parts as part}{#if part.type === 'link'}<a
      href={part.href}
      target="_blank"
      rel="noopener noreferrer"
      class="text-primary-ink underline underline-offset-2 hover:no-underline"
      onclick={(e) => e.stopPropagation()}>{part.text}</a>{:else}{part.text}{/if}{/each}
