<script lang="ts">
	import '@fontsource/firago/400'; // normal
	import '@fontsource/firago/500'; // medium
	import '@fontsource/firago/600'; // semi-bold
	import '@fontsource/firago/700'; // bold
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { resolve } from '$app/paths';
	import Footer from './footer.svelte';

	let { children } = $props();
</script>

<ModeWatcher />

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>certs.email - Certificate expiration notifications</title>
</svelte:head>

<div class="container py-8">
	<h1 class="text-4xl font-semibold tracking-wide text-blue-800 dark:text-blue-600">
		<a
			href={resolve('/')}
			class="decoration-blue-800 decoration-2 underline-offset-4 hover:underline dark:decoration-blue-600"
		>
			certs.email
		</a>
	</h1>
</div>

{@render children()}

<Footer />
