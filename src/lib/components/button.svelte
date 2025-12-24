<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		children: Snippet;
		variant?: 'primary' | 'secondary';
	};

	const { children, class: buttonClass, variant = 'primary', ...restProps }: Props = $props();
</script>

<button class={cn("rounded border-2 px-4 py-2 cursor-pointer",
							"border-blue-800",
							variant === 'primary' && 'bg-blue-800 text-white hover:bg-blue-900 hover:border-blue-900',
							variant === 'secondary' && 'bg-white text-blue-800 hover:bg-blue-800 hover:border-blue-800 hover:text-white dark:bg-zinc-900 dark:text-white',
              "focus:outline-none focus:ring-3 focus:ring-blue-200 dark:focus:ring-blue-950 transition-shadow",
							"disabled:opacity-50 disabled:cursor-not-allowed",
              buttonClass)}
				type="button"
				{...restProps}>
	{@render children()}
</button>
