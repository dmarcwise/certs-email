<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = HTMLInputAttributes;

	const { class: checkboxClass, ...restProps }: Props = $props();
</script>

<input
	type="checkbox"
	class={cn(
		"size-5 rounded border-blue-800 text-blue-800 focus:ring-3 focus:ring-blue-200 dark:focus:ring-blue-950 transition-shadow cursor-pointer mt-0.5",
		checkboxClass
	)}
	{...restProps}
/>
