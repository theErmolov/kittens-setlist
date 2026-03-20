<script lang="ts">
  import type { Category } from '$lib/types';
  import { t } from '$lib/i18n';

  const icons: Record<Category, string> = { top: '💩', mid: '🎵', low: '🧪' };

  let { category, iconOnly = false }: { category: Category; iconOnly?: boolean } = $props();
</script>

<span class="badge badge-{category}" class:icon-only={iconOnly}>{iconOnly ? icons[category] : $t.filter[category]}</span>

<style>
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .icon-only { padding: 2px 4px; }
  .badge-top  { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
  .badge-mid  { background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; }
  .badge-low  { background: #cffafe; color: #0e7490; border: 1px solid #a5f3fc; }

  :global([data-theme="dark"]) .badge-top { background: #22c55e20; color: #4ade80; border-color: #22c55e40; }
  :global([data-theme="dark"]) .badge-mid { background: #a78bfa20; color: #c4b5fd; border-color: #a78bfa40; }
  :global([data-theme="dark"]) .badge-low { background: #22d3ee20; color: #67e8f9; border-color: #22d3ee40; }
</style>
