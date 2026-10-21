<script lang="ts">
  import { pctBubbleStyle } from '$lib/utils';
  let { value, label }: { value: number | null; label: string } = $props();
</script>

<span class="readiness" style={value !== null ? pctBubbleStyle(value) : ''} title={label}>{value === null ? '—' : `${value}%`}</span>

<style>
  .readiness { display: inline-block; font-size: .68rem; font-weight: 600; padding: 1px 5px; border-radius: 8px; white-space: nowrap; line-height: 1.4; color: var(--text-muted); text-align: center; }
</style>
