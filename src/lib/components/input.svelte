<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = HTMLInputAttributes;

	const { class: inputClass, ...restProps }: Props = $props();
</script>

<input
	class={cn(
		'rounded border-2 border-blue-800 px-4 py-2 transition-shadow focus:ring-3 focus:ring-blue-200 focus:outline-none dark:focus:ring-blue-950',
		inputClass,
	)}
	{...restProps}
/>
