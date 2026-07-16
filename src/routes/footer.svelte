<script lang="ts">
	import { userPrefersMode } from 'mode-watcher';
	import { SproutIcon } from '@lucide/svelte';
	import EuFlagImage from '$lib/assets/eu-flag.png';
</script>

<footer class="container mb-12">
	<hr class="mt-16 mb-8 border-zinc-200 dark:border-zinc-700" />

	<div class="mt-8 flex flex-col gap-x-4 gap-y-8 sm:flex-row">
		<div class="flex flex-col gap-y-1">
			<div>
				<a href="https://dmarcwise.io"> DMARCwise </a>
			</div>

			<div class="mt-2 flex items-center gap-x-3 leading-tight text-zinc-600 dark:text-zinc-400">
				<img src={EuFlagImage} class="w-8 rounded" alt="European Union flag" />

				Proudly made and hosted in the European Union
			</div>

			<div class="mt-1 flex items-center gap-x-3 leading-tight text-zinc-600 dark:text-zinc-400">
				<span
					class="flex aspect-[1.5] w-8 items-center justify-center rounded-md bg-green-100 text-green-700"
				>
					<SproutIcon class="size-4" />
				</span>
				Powered by 100% renewable energy
			</div>
		</div>

		<select
			class="h-9 rounded border-2 border-blue-800 py-0 pr-5 pl-3 transition-shadow focus:ring-3 focus:ring-blue-200 focus:outline-none sm:ml-auto dark:focus:ring-blue-950"
			bind:value={userPrefersMode.current}
		>
			<option value="system">System theme</option>
			<option value="light">Light</option>
			<option value="dark">Dark</option>
		</select>
	</div>
</footer>
