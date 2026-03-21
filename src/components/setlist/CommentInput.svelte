<script lang="ts">
  let {
    value: initial = '',
    onsave
  }: {
    value?: string;
    onsave: (v: string) => void;
  } = $props();

  let value = $state(initial);
  let focused = $state(false);
  $effect(() => { if (!focused) value = initial; });
</script>

<input
  class="comment-input"
  bind:value
  placeholder="комментарий..."
  onclick={(e) => e.stopPropagation()}
  ondragstart={(e) => e.stopPropagation()}
  onfocus={() => { focused = true; }}
  onblur={() => { focused = false; if (value !== (initial ?? '')) onsave(value); }}
/>

<style>
  .comment-input {
    display: block; width: 100%; margin-top: 3px;
    background: transparent; border: none; border-bottom: 1px dashed transparent;
    font-size: 0.75rem; color: var(--text-muted); font-style: italic;
    padding: 1px 0; outline: none; cursor: text;
    transition: border-color 0.15s;
  }
  .comment-input:focus { border-bottom-color: var(--accent); }
  .comment-input:not(:placeholder-shown) { border-bottom-color: var(--border); }
  .comment-input::placeholder { opacity: 0; transition: opacity 0.15s; }
</style>
