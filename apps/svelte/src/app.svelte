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
	import DotMark from 'carbon-icons-svelte/lib/DotMark.svelte';
	import LogoGithub from 'carbon-icons-svelte/lib/LogoGithub.svelte';

	import PaintBrushAlt from 'carbon-icons-svelte/lib/PaintBrushAlt.svelte';

	import Router, { RouteDefinition } from 'svelte-spa-router';
	import { wrap } from 'svelte-spa-router/wrap';

	import packageJson from '../../../package.json';
	import { rootActions } from './root.slice';

	let isSideNavOpen = false;

	const routes: RouteDefinition = {
		'/message': wrap({
			asyncComponent: () => import('./routes/message/message.svelte'),
		}),
		'/counter': wrap({
			asyncComponent: () => import('./routes/counter/counter.svelte'),
		}),
		'/': wrap({
			asyncComponent: () => import('./routes/counter/counter.svelte'),
		}),
	};

	let hash = '#/';
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
			text="Messages"
			href="#/message"
			isSelected={hash === '#/message'}
			on:click={() => (hash = '#/message')}
		/>
		<SideNavDivider />
		<SideNavLink icon={LogoGithub} text="Github" href={packageJson.repository} />
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
