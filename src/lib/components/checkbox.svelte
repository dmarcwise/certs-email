<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = HTMLInputAttributes;

	const { class: checkboxClass, ...restProps }: Props = $props();
</script>

<input
	type="checkbox"
	class={cn(
		'mt-0.5 size-5 cursor-pointer rounded border-blue-800 text-blue-800 transition-shadow focus:ring-3 focus:ring-blue-200 dark:focus:ring-blue-950',
		checkboxClass,
	)}
	{...restProps}
/>
