<script lang="ts">
  import { t } from '$lib/i18n';

  export type SortKey = 'artist' | 'title' | 'default';

  let {
    sort,
    onchange
  }: {
    sort: SortKey;
    onchange: (v: SortKey) => void;
  } = $props();
</script>

<div class="sortbar">
  <span class="label">{$t.sort.label}</span>
  {#each (['default', 'artist', 'title'] as SortKey[]) as key}
    <button class="sort-btn" class:active={sort === key} onclick={() => onchange(key)}>
      {$t.sort[key]}
    </button>
  {/each}
</div>

<style>
  .sortbar { display: flex; align-items: center; gap: 6px; }
  .label { font-size: 0.78rem; color: var(--text-muted); margin-right: 2px; }
  .sort-btn {
    padding: 3px 12px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: transparent;
    cursor: pointer;
    font-size: 0.78rem;
    color: var(--text-muted);
    transition: all 0.15s;
  }
  .sort-btn:hover { border-color: var(--accent); color: var(--accent); }
  .sort-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
</style>
