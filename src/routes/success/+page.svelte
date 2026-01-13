<script lang="ts">
	import { page } from '$app/state';
	import { CheckIcon } from '@lucide/svelte';

	const message = page.url.searchParams.get('message');
</script>

<main class="container">
	<div
		class="flex flex-col items-center rounded border-2 border-blue-800 p-8 text-center dark:border-blue-600"
	>
		<CheckIcon class="size-10 text-blue-800 dark:text-blue-600" />
		{#if message === 'updated'}
			<p class="mt-4 font-medium">Your monitoring settings have been updated.</p>
			<p class="mt-2">We'll keep watching your domains and send alerts as usual.</p>
		{:else}
			<p class="mt-4 font-medium">We've sent you a verification link via email.</p>
			<p class="mt-2">Click on the link to confirm the subscription.</p>
		{/if}
	</div>
</main>
