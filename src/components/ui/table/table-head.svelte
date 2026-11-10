<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLThAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLThAttributes> = $props();
</script>

<th bind:this={ref} data-slot="table-head" class={cn("sticky top-0 z-[2] bg-card text-muted-foreground shadow-[0_2px_0_var(--border)] h-10 border-border px-3 max-[700px]:px-1 text-left align-middle text-[0.75rem] font-bold tracking-[0.05em] whitespace-nowrap uppercase not-last:border-r [&:has([role=checkbox])]:pr-0", className)} {...restProps}>
	{@render children?.()}
</th>
