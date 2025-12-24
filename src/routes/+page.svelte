<script lang="ts">
	import Button from '$lib/components/button.svelte';
	import Input from '$lib/components/input.svelte';
	import Textarea from '$lib/components/textarea.svelte';
	import { CheckIcon } from '@lucide/svelte';
	import FaqItem from './faq-item.svelte';
</script>

<div class="container">

	<p>
		certs.email is a simple tool for <span class="font-medium">automated SSL/TLS certificates monitoring</span>.
	</p>

	<p class="mt-2">
		Enter your domain names and email address and we'll send you:
	</p>

	<ul class="mt-2 list-disc list-inside">
		<li>Expiration notifications 30 days, 14 days, 7 days and 1 day before the date.</li>
		<li>Heartbeat reports with the status of your certificates every 2 weeks.</li>
	</ul>

	<form class="mt-10">
		<label class="block">
			<span class="font-medium">
				Domain names:
			</span>

			<Textarea placeholder="Enter your domain names (one per line)" class="mt-2 w-full h-32 min-h-32" />
		</label>

		<label class="block mt-6">
			<span class="font-medium">
				Email address:
			</span>

			<Input type="email" placeholder="Enter your email address" class="mt-2 block w-full" />
		</label>

		<Button class="mt-6 w-full flex items-center justify-center gap-x-2">
			<CheckIcon class="size-4" />
			Subscribe to notifications
		</Button>
	</form>

	<h2 class="mt-14 text-blue-800 dark:text-blue-600 font-semibold tracking-wide text-3xl">
		FAQ
	</h2>

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
			Yes! certs.email is free and allows up to 25 domains per email address.
		</p>
	</FaqItem>

	<FaqItem title="Can I trust you?">
		<p>
			certs.email is made by <a href="https://dmarcwise.io" target="_blank">DMARCwise</a>,
			a DMARC monitoring product based in the European Union and used by thousands of companies.
		</p>

		<p>
			Your email address is safe and used only to send you the notifications.
		</p>
	</FaqItem>

	<FaqItem title="Why bi-weekly reports?">
		<p>
			Email isn't perfect: if we can't reach you, you may miss important notifications.
			To help with this, we send a report every 2 weeks as a heartbeat, confirming that notifications are still
			working.
		</p>
	</FaqItem>

</div>
