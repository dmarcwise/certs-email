<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		children?: Snippet;
	}

	const { title, children }: Props = $props();
</script>

<div class="mt-6">
	<h3 class="font-medium">{title}</h3>

	<article class="flex flex-col gap-2 mt-2">
		{@render children?.()}
	</article>
</div>
