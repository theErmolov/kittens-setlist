<script lang="ts">
  let { label, active, disabled = false, onclick }: {
    label: string; active: boolean; disabled?: boolean; onclick: () => void;
  } = $props();
</script>

<button type="button" class="filter-chip" class:active aria-pressed={active} {disabled} {onclick}>{label}</button>

<style>
  .filter-chip {
    padding: 3px 12px; border: 1px solid var(--border); border-radius: 20px;
    background: transparent; cursor: pointer; font-size: 0.82rem; font-weight: 500;
    color: var(--text-muted); transition: all 0.15s;
  }
  .filter-chip:hover { border-color: var(--accent); color: var(--accent); }
  .filter-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }

  button:disabled { opacity: .5; cursor: default; }
</style>
