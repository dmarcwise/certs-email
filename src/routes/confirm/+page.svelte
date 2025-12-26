<script lang="ts">
	import { page } from '$app/state';
	import { confirm } from './confirm.remote';
	import Button from '$lib/components/button.svelte';
	import { CheckIcon } from '@lucide/svelte';

	const { token } = confirm.fields;
	const tokenValue = page.url.searchParams.get('token') || '';
</script>

<main class="container">
	<p>
		Click the button below to <span class="font-medium">confirm your email address</span> and start monitoring your
		domains.
	</p>

	<form class="mt-10" {...confirm}>
		<input type="hidden" {...token.as('text')} value={tokenValue} />

		<Button
			class="w-full flex items-center justify-center gap-x-2 {!!confirm.pending && 'disabled:cursor-progress'}"
			type="submit"
			disabled={!!confirm.pending}>
			<CheckIcon class="size-4" />
			Confirm email address
		</Button>

		<!-- eslint-disable-next-line svelte/require-each-key -->
		{#each token.issues() as issue}
			<p class="mt-4 text-red-600">{issue.message}</p>
		{/each}
	</form>
</main>
