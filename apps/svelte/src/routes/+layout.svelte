<script lang="ts">
	// The ordering of these imports is critical to your app working properly
	import '@skeletonlabs/skeleton/themes/theme-skeleton.css';
	// If you have source.organizeImports set to true in VSCode, then it will auto change this ordering
	import '@skeletonlabs/skeleton/styles/skeleton.css';

	// Most of your app wide CSS should be put in this file
	import { AppBar, AppShell } from '@skeletonlabs/skeleton';
	import packageJson from '../../../../package.json';
	import '../app.postcss';

	import { page } from '$app/stores';
	import { derived } from 'svelte/store';

	const selected = derived(page, ($page) => $page.url.pathname);

	const pages = [
		{ label: 'Counter', href: '/counter' },
		{ label: 'Deepdish', href: '/deepdish' },
		{ label: 'Message', href: '/message' },
		{ label: 'MouseMove', href: '/mousemove' },
		{ label: 'Useless', href: '/useless' },
	];
</script>

<AppShell>
	<svelte:fragment slot="header">
		<AppBar>
			<svelte:fragment slot="lead">
				<strong class="text-xl uppercase">TinySlice</strong>
			</svelte:fragment>
			<svelte:fragment slot="trail">
				<a
					class="btn btn-sm variant-ghost-surface"
					href="{packageJson.homepage}"
					target="_blank"
					rel="noreferrer"
				>
					GitHub
				</a>
			</svelte:fragment>
		</AppBar>
	</svelte:fragment>

	<div class="main-layout">
		<slot />
	</div>

	<svelte:fragment slot="sidebarLeft">
		<section class="p-4 pb-20 space-y-4 overflow-y-auto">
			<p class="font-bold pl-4 text-2xl">Examples</p>
			<nav class="list-nav">
				<ul>
					{#each pages as { label, href }}
						<li>
							<a href="{href}" data-sveltekit-preload-="hover"
								><span class="flex-auto">{label}</span></a
							>
						</li>
					{/each}
				</ul>
			</nav>
		</section>
	</svelte:fragment>
</AppShell>

<style>
	.main-layout {
		padding: 1em;
		max-width: 800px;
		margin-left: auto;
		margin-right: auto;
	}
</style>
