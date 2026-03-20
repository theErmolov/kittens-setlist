<script lang="ts">
  let { title, children }: { title: string; children?: import('svelte').Snippet } = $props();
</script>

<header class="topbar">
  <span class="title">{title}</span>
  <div class="actions">
    {@render children?.()}
  </div>
</header>

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .title { font-size: 1.1rem; font-weight: 700; color: var(--text); }
  .actions { display: flex; gap: 8px; align-items: center; }
</style>
