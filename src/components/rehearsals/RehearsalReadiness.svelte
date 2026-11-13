<script lang="ts">
  import PctBadge from '$components/shared/PctBadge.svelte';
  import * as Tooltip from '$components/ui/tooltip';
  let { value, label }: { value: number | null; label: string } = $props();
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <PctBadge {...props} {value} class="text-micro" />
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content>{label}</Tooltip.Content>
</Tooltip.Root>
