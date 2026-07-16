<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		children: Snippet;
		variant?: 'primary' | 'secondary' | 'danger';
	};

	const { children, class: buttonClass, variant = 'primary', ...restProps }: Props = $props();
</script>

<button
	class={cn(
		'cursor-pointer rounded border-2 px-4 py-2',
		'border-blue-800',
		variant === 'primary' && 'bg-blue-800 text-white hover:border-blue-900 hover:bg-blue-900',
		variant === 'secondary' &&
			'bg-white text-blue-800 hover:border-blue-800 hover:bg-blue-800 hover:text-white dark:bg-zinc-900 dark:text-white',
		variant === 'danger' &&
			'border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700',
		'transition-shadow focus:ring-3 focus:ring-blue-200 focus:outline-none dark:focus:ring-blue-950',
		'disabled:cursor-not-allowed disabled:opacity-50',
		buttonClass,
	)}
	type="button"
	{...restProps}
>
	{@render children()}
</button>
