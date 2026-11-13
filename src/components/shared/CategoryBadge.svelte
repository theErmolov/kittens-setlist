<script lang="ts">
  import type { Category } from '$lib/types';
  import { t } from '$lib/i18n';
  import { Badge } from '$components/ui/badge';

  const icons: Record<Category, string> = { top: '💩', mid: '🎵', low: '🧪' };
  const colors: Record<Category, string> = {
    top: 'border-category-top-border bg-category-top-bg text-category-top-ink',
    mid: 'border-category-mid-border bg-category-mid-bg text-category-mid-ink',
    low: 'border-category-low-border bg-category-low-bg text-category-low-ink',
  };

  let { category, iconOnly = false }: { category: Category; iconOnly?: boolean } = $props();
</script>

<Badge variant="outline" class="{colors[category]} font-semibold tracking-[0.02em] {iconOnly ? 'size-8 p-0 text-title leading-none' : 'text-small'}">{iconOnly ? icons[category] : $t.filter[category]}</Badge>
