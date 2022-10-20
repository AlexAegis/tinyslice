<script lang="ts">
	import {
		Column,
		Content,
		Grid,
		Header,
		HeaderActionLink,
		HeaderGlobalAction,
		HeaderUtilities,
		Row,
		SideNav,
		SideNavDivider,
		SideNavItems,
		SideNavLink,
		SkipToContent,
	} from 'carbon-components-svelte';
	import Debug from 'carbon-icons-svelte/lib/Debug.svelte';
	import DotMark from 'carbon-icons-svelte/lib/DotMark.svelte';
	import LogoGithub from 'carbon-icons-svelte/lib/LogoGithub.svelte';

	import PaintBrushAlt from 'carbon-icons-svelte/lib/PaintBrushAlt.svelte';

	import Router, { RouteDefinition } from 'svelte-spa-router';
	import { wrap } from 'svelte-spa-router/wrap';

	import packageJson from '../../../package.json';
	import { debug$, rootActions } from './root.slice';

	let isSideNavOpen = false;

	const routes: RouteDefinition = {
		'/counter': wrap({
			asyncComponent: () => import('./routes/counter/counter.svelte'),
		}),
		'/deepdish': wrap({
			asyncComponent: () => import('./routes/deepdish/deepdish.svelte'),
		}),
		'/useless': wrap({
			asyncComponent: () => import('./routes/useless/useless.svelte'),
		}),
		'/message': wrap({
			asyncComponent: () => import('./routes/message/message.svelte'),
		}),
		'/mousemove': wrap({
			asyncComponent: () => import('./routes/mousemove/mousemove.svelte'),
		}),
		'/': wrap({
			asyncComponent: () => import('./routes/counter/counter.svelte'),
		}),
	};

	let hash = location.hash ?? '#/';
</script>

<Header company="🍕" platformName="{packageJson.name} ({packageJson.version})" bind:isSideNavOpen>
	<svelte:fragment slot="skip-to-content">
		<SkipToContent />
	</svelte:fragment>
	<HeaderUtilities>
		<HeaderGlobalAction
			aria-label="Change Theme"
			icon={PaintBrushAlt}
			on:click={() => rootActions.nextTheme.next()}
		/>
		<HeaderActionLink
			aria-label="Github"
			icon={LogoGithub}
			href={packageJson.homepage}
			target="_blank"
		/>
	</HeaderUtilities>
</Header>

<SideNav bind:isOpen={isSideNavOpen} rail>
	<SideNavItems>
		<SideNavLink
			icon={DotMark}
			text="Counter"
			href="#/counter"
			isSelected={hash === '#/counter' || hash === '#/'}
			on:click={() => (hash = '#/counter')}
		/>
		<SideNavLink
			icon={DotMark}
			text="DeepDish"
			href="#/deepdish"
			isSelected={hash === '#/deepdish'}
			on:click={() => (hash = '#/deepdish')}
		/>
		<SideNavLink
			icon={DotMark}
			text="Useless"
			href="#/useless"
			isSelected={hash === '#/useless'}
			on:click={() => (hash = '#/useless')}
		/>
		<SideNavLink
			icon={DotMark}
			text="Messages"
			href="#/message"
			isSelected={hash === '#/message'}
			on:click={() => (hash = '#/message')}
		/>
		<SideNavLink
			icon={DotMark}
			text="MouseMove"
			href="#/mousemove"
			isSelected={hash === '#/mousemove'}
			on:click={() => (hash = '#/mousemove')}
		/>
		<SideNavDivider />
		<SideNavLink icon={LogoGithub} text="Github" href={packageJson.repository} />
		{#if $debug$}
			<SideNavLink
				icon={Debug}
				text="Disable Debug Tools"
				on:click={() => debug$.set(false)}
			/>
		{:else}
			<SideNavLink icon={Debug} text="Enable Debug Tools" on:click={() => debug$.set(true)} />
		{/if}
	</SideNavItems>
</SideNav>

<Content>
	<Grid>
		<Row>
			<Column>
				<Router {routes} />
			</Column>
		</Row>
	</Grid>
</Content>
