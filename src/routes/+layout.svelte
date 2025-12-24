<script lang="ts">
	import '@fontsource/firago/400'; // normal
	import '@fontsource/firago/500'; // medium
	import '@fontsource/firago/600'; // semi-bold
	import '@fontsource/firago/700'; // bold
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { userPrefersMode } from 'mode-watcher';
	import { resolve } from '$app/paths';

	let { children } = $props();
</script>

<ModeWatcher />

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>certs.email - Certificate expiration notifications</title>
</svelte:head>

<div class="container py-8">

	<h1 class="text-blue-800 dark:text-blue-600 font-semibold tracking-wide text-4xl">
		<a href={resolve('/')}
			 class="hover:underline underline-offset-4 decoration-2 decoration-blue-800 dark:decoration-blue-600">
			certs.email
		</a>
	</h1>

</div>

{@render children()}

<footer class="container mt-16 mb-12 flex flex-col sm:flex-row gap-4">
	<select
		class="pl-3 pr-5 py-0 h-9 sm:ml-auto rounded border-2 border-blue-800 focus:outline-none focus:ring-3 focus:ring-blue-200 dark:focus:ring-blue-950 transition-shadow"
		bind:value={userPrefersMode.current}>
		<option value="system">System theme</option>
		<option value="light">Light</option>
		<option value="dark">Dark</option>
	</select>
</footer>
