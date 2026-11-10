<script lang="ts">
  /** Removable Badges for every active catalog filter (category / musician / instrument). */
  import type { Category, Instrument } from '$lib/types';
  import { t } from '$lib/i18n';
  import { INSTRUMENT_ICONS } from '$lib/utils';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  import { Badge } from '$components/ui/badge';
  import ButtonRow from '$components/shared/ButtonRow.svelte';

  let { class: className }: { class?: string } = $props();
  const search = useStore(backlogStore, s => s.search);
  const showArchived = useStore(backlogStore, s => s.showArchived);
  const showProgress = useStore(backlogStore, s => s.showProgress);
  const categoryFilter = useStore(backlogStore, s => s.categoryFilter);
  const selectedMusicians = useStore(backlogStore, s => s.selectedMusicians);
  const selectedInstruments = useStore(backlogStore, s => s.selectedInstruments);
  const actions = backlogStore.getState();

  let items = $derived<{ key: string; icon?: string; label: string; remove: () => void }[]>([
    ...($showArchived ? [{ key: 'archive', icon: '📦', label: $t.backlog.archivedFilter, remove: () => actions.toggleShowArchived() }] : []),
    ...($showProgress ? [{ key: 'progress', icon: '📊', label: $t.backlog.progress, remove: () => actions.toggleShowProgress() }] : []),
    ...($search.trim() ? [{ key: 'q', icon: '🔍', label: $search.trim(), remove: () => actions.setSearch('') }] : []),
    ...[...$categoryFilter].map((c: Category) => ({ key: `c:${c}`, label: $t.filter[c], remove: () => actions.toggleCategory(c) })),
    ...[...$selectedMusicians].map(n => ({ key: `m:${n}`, label: n, remove: () => actions.toggleMusician(n) })),
    ...[...$selectedInstruments].map((i: Instrument) => ({ key: `i:${i}`, icon: INSTRUMENT_ICONS[i], label: $t.instrument[i], remove: () => actions.toggleInstrument(i) })),
  ]);
</script>

{#if items.length > 0}
  <ButtonRow wrap class="min-w-0 gap-1.5 {className ?? ''}">
    {#each items as item (item.key)}
      <Badge variant="secondary" class="h-6 max-w-48 gap-1 pr-1 text-[0.8rem] font-medium">
        <!-- Emoji live in their own element: the emoji→image converter replaces text nodes that contain emoji, which would freeze a reactive label. -->
        {#if item.icon}<span aria-hidden="true">{item.icon}</span>{/if}<span class="truncate">{item.label}</span>
        <button type="button" class="rounded-full px-1 leading-none text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="{$t.backlog.filterRemove}: {item.label}" onclick={item.remove}>✕</button>
      </Badge>
    {/each}
  </ButtonRow>
{/if}
