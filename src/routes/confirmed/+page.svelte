<script lang="ts">
	import { CheckIcon } from '@lucide/svelte';
</script>

<main class="container">
	<div class="border-2 border-blue-800 dark:border-blue-600 rounded p-8 flex flex-col items-center text-center">
		<CheckIcon class="size-10 text-blue-800 dark:text-blue-600" />

		<p class="mt-4 font-medium">
			Your email has been successfully confirmed.
		</p>

		<p class="mt-2">
			We've sent you an email with the complete list of
			domains being monitored.<br>
			You'll receive notifications when any of your certificates are expiring.
		</p>
	</div>
</main>
