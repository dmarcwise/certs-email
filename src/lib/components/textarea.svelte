<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = HTMLTextareaAttributes;

	const { class: inputClass, ...restProps }: Props = $props();
</script>

<textarea
	class={cn("rounded border-blue-800 border-2 px-4 py-2 focus:outline-none focus:ring-3 focus:ring-blue-200 dark:focus:ring-blue-950 transition-shadow", inputClass)}
	{...restProps}
></textarea>
