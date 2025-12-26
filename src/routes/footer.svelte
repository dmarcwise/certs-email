<script lang="ts">
	import { userPrefersMode } from 'mode-watcher';
	import { SproutIcon } from '@lucide/svelte';
</script>

<footer class="container mb-12">
	<hr class="mt-16 mb-8 border-zinc-200 dark:border-zinc-700" />

	<div class="mt-8 flex flex-col sm:flex-row gap-x-4 gap-y-8">
		<div class="flex flex-col gap-y-1">
			<div>
				<a href="https://dmarcwise.io" target="_blank">
					DMARCwise
				</a>
			</div>

			<div class="mt-2 text-zinc-600 dark:text-zinc-400 flex items-center gap-x-3 leading-tight">
				<img
					src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Flag_of_Europe.svg/1599px-Flag_of_Europe.svg.png?20081021155534"
					class="w-8 rounded" alt="EU flag" />

				Proudly made and hosted in the European Union
			</div>

			<div class="text-zinc-600 dark:text-zinc-400 flex items-center gap-x-3 leading-tight mt-1">
				<span class="w-8 aspect-[1.5] bg-green-100 rounded-md text-green-700 flex items-center justify-center">
					<SproutIcon class="size-4" />
				</span>
				Powered by 100% renewable energy
			</div>
		</div>

		<select
			class="pl-3 pr-5 py-0 h-9 sm:ml-auto rounded border-2 border-blue-800 focus:outline-none focus:ring-3 focus:ring-blue-200 dark:focus:ring-blue-950 transition-shadow"
			bind:value={userPrefersMode.current}>
			<option value="system">System theme</option>
			<option value="light">Light</option>
			<option value="dark">Dark</option>
		</select>
	</div>
</footer>
