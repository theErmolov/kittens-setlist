<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLTdAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLTdAttributes> = $props();
</script>

<td bind:this={ref} data-slot="table-cell" class={cn("border-border px-3 py-2 align-middle whitespace-nowrap max-mid:px-1 not-last:border-r max-mid:not-last:border-r-0 [&:has([role=checkbox])]:pr-0", className)} {...restProps}>
	{@render children?.()}
</td>
