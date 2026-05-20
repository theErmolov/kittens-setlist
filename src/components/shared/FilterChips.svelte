<script lang="ts">
  import type { Category } from '$lib/types';
  import { t } from '$lib/i18n';

  let {
    selected,
    onchange,
    counts
  }: {
    selected: Set<Category>;
    onchange: (v: Set<Category>) => void;
    counts?: Record<Category, number>;
  } = $props();

  function toggle(cat: Category) {
    const next = new Set(selected);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    onchange(next);
  }

  function selectAll() {
    onchange(new Set());
  }

  // Split "💩 Top" → { icon: "💩", label: " Top" }
  function splitLabel(text: string) {
    const i = text.indexOf(' ');
    return i === -1 ? { icon: text, label: '' } : { icon: text.slice(0, i), label: text.slice(i) };
  }
</script>

<div class="chips">
  <button
    class="chip chip-all"
    class:active={selected.size === 0}
    onclick={selectAll}
  >
    {$t.filter.all}{counts ? ` (${Object.values(counts).reduce((a, b) => a + b, 0)})` : ''}
  </button>
  {#each (['top', 'mid', 'low'] as Category[]) as cat}
    {@const { icon, label } = splitLabel($t.filter[cat])}
    {@const countStr = counts ? ` (${counts[cat] ?? 0})` : ''}
    <button
      class="chip chip-{cat}"
      class:active={selected.has(cat)}
      onclick={() => toggle(cat)}
    >
      {icon}<span class="cat-label">{label}</span>{countStr}
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

  @media (max-width: 700px) {
    .cat-label { display: none; }
    .chip { padding: 4px 10px; }
  }
</style>
