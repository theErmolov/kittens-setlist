<script lang="ts">
  import type { Category } from '$lib/types';
  import { t } from '$lib/i18n';
  import { Badge } from '$components/ui/badge';

  const icons: Record<Category, string> = { top: '💩', mid: '🎵', low: '🧪' };
  const colors: Record<Category, string> = {
    top: 'border-warning-ink/30 bg-warning text-warning-ink',
    mid: 'border-info-ink/30 bg-info text-info-ink',
    low: 'border-success-ink/30 bg-success text-success-ink',
  };

  let { category, iconOnly = false }: { category: Category; iconOnly?: boolean } = $props();
</script>

<Badge variant="outline" class="badge badge-{category} {colors[category]} font-semibold tracking-[0.02em] {iconOnly ? 'icon-only size-8 p-0 text-[1.2rem] leading-none' : 'text-[0.8rem]'}">{iconOnly ? icons[category] : $t.filter[category]}</Badge>
