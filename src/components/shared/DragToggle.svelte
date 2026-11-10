<script lang="ts">
  import FilterChip from '$components/shared/FilterChip.svelte';
  import { t } from '$lib/i18n';
  import { useStore } from '$lib/store/bridge';
  import { dragModeStore } from '$lib/store/drag';

  let { disabled = false }: { disabled?: boolean } = $props();
  const enabled = useStore(dragModeStore, s => s.enabled);
</script>

<FilterChip label="⠿ {$t.common.dragMode}" active={$enabled} {disabled} onclick={() => dragModeStore.getState().toggle()} />
