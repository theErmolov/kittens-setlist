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
  draggable="false"
  onclick={(e) => e.stopPropagation()}
  ondragstart={(e) => { e.stopPropagation(); e.preventDefault(); }}
  onfocus={() => { focused = true; }}
  onblur={() => { focused = false; if (value !== (initial ?? '')) onsave(value); }}
/>

<style>
  .comment-input {
    display: block; width: 100%; margin-top: 3px;
    background: transparent; border: none; border-bottom: 1px dashed var(--border);
    font-size: 0.94rem; color: var(--text); font-style: italic;
    padding: 1px 0; outline: none; cursor: text;
    transition: border-color 0.15s;
  }
  .comment-input:focus { border-bottom-color: var(--accent); }
  .comment-input:not(:placeholder-shown) { border-bottom-color: var(--border); }
  .comment-input::placeholder { opacity: 0.5; }

  @media (max-width: 700px) {
    .comment-input { font-size: 16px; }
  }
</style>
