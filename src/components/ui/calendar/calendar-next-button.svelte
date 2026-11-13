<script lang="ts">
	import { Calendar as CalendarPrimitive } from "bits-ui";
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { buttonVariants, type ButtonVariant } from "$components/ui/button/index.js";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		variant = "ghost",
		label,
		...restProps
	}: CalendarPrimitive.NextButtonProps & {
		variant?: ButtonVariant;
		/** Localised accessible name (bits-ui hard-codes an English one). */
		label?: string;
	} = $props();
</script>

{#snippet Fallback()}
	<ChevronRightIcon class={cn("cn-rtl-flip size-4", className)} />
{/snippet}

{#snippet labelled({ props }: { props: Record<string, unknown> })}
	<button {...props} aria-label={label ?? (props['aria-label'] as string)}>
		{#if children}
			{@render children?.()}
		{:else}
			{@render Fallback()}
		{/if}
	</button>
{/snippet}

<CalendarPrimitive.NextButton
	bind:ref
	child={labelled}
	class={cn(
		buttonVariants({ variant }),
		"size-(--cell-size) bg-transparent p-0 select-none disabled:opacity-50",
		"rtl:rotate-180",
		className
	)}
	{...restProps}
>
</CalendarPrimitive.NextButton>
