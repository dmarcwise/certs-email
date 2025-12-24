<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="mt-8 container flex flex-col gap-4">
	{#if page.status === 404}
		<h2>Page not found</h2>

		<p>
			Go back to the <a href={resolve('/')}>homepage</a>.
		</p>
	{:else}
		<h2>Application error</h2>

		<p>
			Something bad happened. Please try again.
		</p>

		<p>
			If the issue persists, please contact <a href="mailto:support@certs.email">support@certs.email</a>.
		</p>

		<pre class="text-xs">{JSON.stringify(page.error, null, 2)}</pre>
	{/if}
</article>
