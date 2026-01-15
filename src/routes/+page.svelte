<script lang="ts">
	import Button from '$lib/components/button.svelte';
	import Input from '$lib/components/input.svelte';
	import Textarea from '$lib/components/textarea.svelte';
	import { CheckIcon, CircleXIcon } from '@lucide/svelte';
	import FaqItem from './faq-item.svelte';
	import { submit } from './submit.remote';
	import { unsubscribe } from './unsubscribe.remote';
	import { resolve } from '$app/paths';

	const { data } = $props();

	const { domains, email, settingsToken } = submit.fields;
	const { settingsToken: unsubscribeToken } = unsubscribe.fields;

	let submitError = $state(false);
	let unsubscribeError = $state(false);

	$effect(() => {
		if (data.edit) {
			submit.fields.set({
				domains: data.edit.domains,
				email: data.edit.email,
				settingsToken: data.edit.token
			});

			unsubscribe.fields.set({
				settingsToken: data.edit.token
			});
		} else {
			submit.fields.set({
				domains: '',
				email: '',
				settingsToken: ''
			});

			unsubscribe.fields.set({
				settingsToken: ''
			});

			submitError = false;
			unsubscribeError = false;
		}
	});

	const enhancedSubmit = submit.enhance(async ({ submit }) => {
		try {
			await submit();
		} catch (error) {
			console.error(error);
			submitError = true;
		}
	});

	const enhancedUnsubscribe = unsubscribe.enhance(async ({ submit }) => {
		try {
			await submit();
		} catch (error) {
			console.error(error);
			unsubscribeError = true;
		}
	});
</script>

<main class="container">
	{#if data.edit}
		<p>
			Update the domains monitored for <span class="font-medium">{data.edit.email}</span>.
		</p>

		<p class="mt-2">
			Submitting this form will replace your current list of monitored domains.
		</p>
	{:else}
		<p>
			certs.email is a simple tool for <span class="font-medium">automated SSL/TLS certificates monitoring</span>.
		</p>

		<p class="mt-2">Enter your domain names and email address and we'll send you:</p>

		<ul class="mt-2 list-inside list-disc">
			<li>
				Expiration notifications 30 days, 14 days, 7 days and 1 day before the date
				(<a href={resolve('/preview/expiring')} class="link">preview</a>).
			</li>
			<li>
				Heartbeat reports with the status of your certificates every 2 weeks
				(<a href={resolve('/preview/heartbeat')} class="link">preview</a>).
			</li>
		</ul>
	{/if}

	{#if data.isTokenInvalid}
		<p class="mt-6 text-red-600 font-medium">Invalid or expired settings link.</p>
	{/if}

	<!-- eslint-disable-next-line svelte/require-each-key -->
	{#each settingsToken.issues() as issue}
		<p class="mt-6 text-red-600 font-medium">{issue.message}</p>
	{/each}

	<form class="mt-10" {...enhancedSubmit}>
		{#if data.edit}
			<input type="hidden" {...settingsToken.as('text')} />
		{/if}

		<label class="block">
			<span class="font-medium">
				Domain names:
			</span>

			<Textarea placeholder="Enter your domain names (one per line)"
								class="mt-2 w-full h-32 min-h-32"
								required
								{...domains.as('text')} />

			<!-- eslint-disable-next-line svelte/require-each-key -->
			{#each domains.issues() as issue}
				<p class="mt-2 text-red-600">{issue.message}</p>
			{/each}
		</label>

		<label class="block mt-6"
					 class:hidden={data.edit}>
			<span class="font-medium">
				Email address:
			</span>

			<Input
				placeholder="Enter your email address"
				class="mt-2 block w-full"
				required
				{...email.as('email')}
			/>

			<!-- eslint-disable-next-line svelte/require-each-key -->
			{#each email.issues() as issue}
				<p class="mt-2 text-red-600">{issue.message}</p>
			{/each}
		</label>

		<p class="mt-6 text-sm text-zinc-600 dark:text-zinc-400"
			 class:hidden={data.edit}>
			By continuing, you confirm that you have read our <a href={resolve('/privacy-policy')} class="link">Privacy
			Policy</a>.
		</p>

		<Button
			class="mt-6 flex w-full items-center justify-center gap-x-2 {!!submit.pending && 'disabled:cursor-progress'}"
			type="submit"
			disabled={!!submit.pending}>
			<CheckIcon class="size-4" />
			{#if data.edit}
				Update monitoring settings
			{:else}
				Subscribe to notifications
			{/if}
		</Button>

		{#if submitError}
			<p class="mt-4 text-red-600">
				An unexpected error occurred while submitting your form. Please try again later.
			</p>
		{/if}
	</form>

	{#if data.edit}
		<form class="mt-4" {...enhancedUnsubscribe}>
			<input type="hidden" {...unsubscribeToken.as('text')} />

			<Button
				class="flex w-full items-center justify-center gap-x-2 {!!unsubscribe.pending &&'disabled:cursor-progress'}"
				variant="danger"
				type="submit"
				disabled={!!unsubscribe.pending}
			>
				<CircleXIcon class="size-4" />
				Unsubscribe from notifications
			</Button>

			<!-- eslint-disable-next-line svelte/require-each-key -->
			{#each unsubscribeToken.issues() as issue}
				<p class="mt-2 text-red-600">{issue.message}</p>
			{/each}

			{#if unsubscribeError}
				<p class="mt-4 text-red-600">
					An unexpected error occurred while unsubscribing. Please try again later.
				</p>
			{/if}
		</form>
	{/if}

	<h2 class="mt-20">FAQ</h2>

	<FaqItem title="Why would I use certs.email?">
		<p>
			Certificate renewal may seem a solved problem, but we still sometimes see
			website downtime caused by expired certificates, likely because of broken automation
			or lack of monitoring.
		</p>

		<p>
			With Let's Encrypt discontinuing the expiration notifications, we decided to build a simple tool to help
			people monitor their certificates. We focus on a simple user experience: no account creation is needed!
		</p>
	</FaqItem>

	<FaqItem title="Is certs.email free?">
		<p>
			Yes! certs.email is free and
			<a href="https://github.com/dmarcwise/certs-email">
				open source
			</a>
			and allows up to 20 domains per email address.
		</p>
	</FaqItem>

	<FaqItem title="Can I trust you?">
		<p>
			certs.email is made by the creators of <a href="https://dmarcwise.io">DMARCwise</a>,
			a DMARC monitoring product used by thousands of companies.
			<br>
			Your email address is safe and is used only to send you the notifications. Read our privacy policy <a
			href={resolve('/privacy-policy')}>here</a>.
		</p>

		<p>
			This project is also open source
			<a href="https://github.com/dmarcwise/certs-email">
				on GitHub
			</a>.
		</p>
	</FaqItem>

	<FaqItem title="Why bi-weekly reports?">
		<p>
			Email isn't perfect: if we can't reach you, you may miss important notifications.
			To help with this, we send a report every 2 weeks as a heartbeat, confirming that notifications are still
			working.
		</p>
	</FaqItem>

	<FaqItem title="How often do you check my domains?">
		<p>
			We check your domains every 6 hours.
		</p>
	</FaqItem>

	<FaqItem title="Do you support multiple IPs?">
		<p>
			No, we currently only take the first public IPv4 address returned by the DNS lookup for the domain.
		</p>
	</FaqItem>

</main>
