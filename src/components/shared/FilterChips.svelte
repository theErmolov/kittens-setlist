<script lang="ts">
  import type { Category } from '$lib/types';
  import { t } from '$lib/i18n';

  let {
    selected,
    onchange
  }: {
    selected: Set<Category>;
    onchange: (v: Set<Category>) => void;
  } = $props();

  function toggle(cat: Category) {
    const next = new Set(selected);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    onchange(next);
  }

  function selectAll() {
    onchange(new Set());
  }
</script>

<div class="chips">
  <button
    class="chip chip-all"
    class:active={selected.size === 0}
    onclick={selectAll}
  >
    {$t.filter.all}
  </button>
  {#each (['top', 'mid', 'low'] as Category[]) as cat}
    <button
      class="chip chip-{cat}"
      class:active={selected.has(cat)}
      onclick={() => toggle(cat)}
    >
      {$t.filter[cat]}
    </button>
  {/each}
</div>

<style>
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }

  .chip {
    padding: 4px 14px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: transparent;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-muted);
    transition: all 0.15s;
  }
  .chip:hover { border-color: var(--accent); color: var(--accent); }
  .chip.active { border-color: var(--accent); color: #fff; }

  .chip-all.active   { background: var(--accent); }
  .chip-top.active   { background: #b91c1c; border-color: #ef4444; }
  .chip-mid.active   { background: #7c3aed; border-color: #a78bfa; }
  .chip-low.active   { background: #15803d; border-color: #22c55e; }
</style>
