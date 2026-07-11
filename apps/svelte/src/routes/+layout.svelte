<script lang="ts">
	import { base } from '$app/paths';
	// Most of your app wide CSS should be put in this file
	import packageJson from '../../../../package.json';
	import '../app.css';

	const pages = [
		{ label: 'Counter', href: `${base}/counter` },
		{ label: 'Deepdish', href: `${base}/deepdish` },
		{ label: 'Message', href: `${base}/message` },
		{ label: 'MouseMove', href: `${base}/mousemove` },
		{ label: 'Useless', href: `${base}/useless` },
	];
</script>

<div class="grid h-full grid-rows-[auto_1fr] overflow-hidden">
	<header class="bg-surface-100-900 flex items-center justify-between p-4">
		<strong class="text-xl uppercase">TinySlice</strong>
		<a
			class="btn btn-sm preset-tonal-surface"
			href={packageJson.homepage}
			target="_blank"
			rel="noreferrer"
		>
			GitHub
		</a>
	</header>

	<div class="grid grid-cols-[auto_1fr] overflow-hidden">
		<aside class="bg-surface-50-950 space-y-4 overflow-y-auto p-4 pb-20">
			<p class="pl-4 text-2xl font-bold">Examples</p>
			<nav>
				<ul class="space-y-1">
					{#each pages as { label, href }}
						<li>
							<a
								class="hover:preset-tonal flex rounded px-4 py-2"
								{href}
								data-sveltekit-preload-data={label === 'MouseMove'
									? 'off'
									: 'hover'}><span class="flex-auto">{label}</span></a
							>
						</li>
					{/each}
				</ul>
			</nav>
		</aside>

		<main class="overflow-y-auto">
			<div class="main-layout">
				<slot />
			</div>
		</main>
	</div>
</div>

<style>
	.main-layout {
		padding: 1em;
		max-width: 800px;
		margin-left: auto;
		margin-right: auto;
	}
</style>
