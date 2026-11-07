<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- App shell (PLAN.md step 1.5): sidebar on desktop, bottom bar on phones, top bar with the account.
     On desktop the sidebar and the top bar stay in place and only the content scrolls (9.13). The
     top bar, the page icon and the current menu item take the colour of the area (9.16, app.css). -->
<script lang="ts">
	import { hasPermission } from "#lib/shared/permissions.js";
	import { appHref } from "#lib/ui/href.js";
	import { resolve } from "$app/paths";
	import IconTile from "#lib/ui/IconTile.svelte";
	import { afterNavigate, beforeNavigate, goto } from "$app/navigation";
	import { page } from "$app/state";
	import { AppBar, Menu, Navigation } from "@skeletonlabs/skeleton-svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { logout } from "#lib/remote/auth.remote.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import { areaOf, visibleNavItems } from "#lib/ui/nav.js";
	import { helpHref } from "#lib/ui/help-links.js";
	import PrintBasket from "#lib/components/PrintBasket.svelte";
	import LanguageSwitch from "#lib/components/LanguageSwitch.svelte";
	import { providePageHeader } from "#lib/ui/page-header.svelte.js";
	import Hint from "#lib/ui/Hint.svelte";
	import BackButton from "#lib/ui/BackButton.svelte";
	import { backStack } from "#lib/ui/back-stack.svelte.js";
	import { watchKeyboard } from "#lib/ui/keyboard.js";
	import { setWaitArea } from "#lib/ui/waits.svelte.js";
	import MenuItem from "#lib/ui/MenuItem.svelte";
	import MenuPanel from "#lib/ui/MenuPanel.svelte";

	const { data, children } = $props();
	const i18n = useI18n();
	const items = $derived(visibleNavItems(data.user));
	const mobileItems = $derived(items.filter((i) => i.mobile).slice(0, 4));
	const moreItems = $derived(items.filter((i) => !mobileItems.includes(i)));
	// the area of the page (9.16): its menu item is the current one, the bar takes its colour
	const here = $derived(areaOf(page.url.pathname));
	const current = $derived((href: string) => here !== null && areaOf(href) === here);
	const coloured = $derived(data.areaStyle !== "none" && here !== null);
	// on a phone "Altro" stands for the areas behind it: it is highlighted when one is open (9.13, round 16)
	const moreCurrent = $derived(moreItems.some((i) => current(i.href)));
	const UserIcon = icons.patron;
	const LogoutIcon = icons.logout;
	const KeyIcon = icons.card;
	const MoreIcon = icons.menu;
	const InfoIcon = icons.info;
	const HelpIcon = icons.help;
	const LibraryIcon = icons.catalog;
	// desktop: the page title and actions live in the top bar (published by PageHeader/DetailLayout)
	const header = providePageHeader();
	const HeaderIcon = $derived(header.current?.icon ? icons[header.current.icon] : undefined);

	// the back button follows the pages of this visit (9.13): the page left, then where we arrived
	beforeNavigate(() =>
		backStack.leave(
			appHref({ pathname: location.pathname, search: location.search }),
			document.title,
		),
	);
	afterNavigate((nav) =>
		backStack.arrive(nav.type, nav.type === "popstate" ? nav.delta : undefined),
	);

	// phones: the bottom bar steps aside while the keyboard is open (9.13 round 33)
	$effect(() => watchKeyboard());

	// a wait covers only the page's part of the window: the menu and the bars stay in sight (owner)
	let shell = $state<HTMLElement>();
	let pageArea = $state<HTMLElement>();
	$effect(() => {
		const root = shell;
		const area = pageArea;
		if (!root || !area) {
			return;
		}
		return setWaitArea(() => {
			const r = area.getBoundingClientRect();
			const bar = root.querySelector(".bv-topbar")?.getBoundingClientRect();
			const nav = root.querySelector(".bv-bottom-nav")?.getBoundingClientRect();
			const top = Math.max(r.top, bar?.bottom ?? 0, 0);
			const bottom = Math.min(
				r.bottom,
				nav && nav.height > 0 ? nav.top : window.innerHeight,
				window.innerHeight,
			);
			return { top, left: r.left, width: r.width, height: Math.max(bottom - top, 0) };
		});
	});

	async function onLogout(): Promise<void> {
		await logout();
		await goto(resolve("login"));
	}
</script>

<!-- The library's own logo at the top left (step 4.10), or a neutral icon until one is uploaded. -->
{#snippet libraryMark(size: string)}
	{#if data.libraryLogo}
		<img
			src={data.libraryLogo}
			alt=""
			class="{size} shrink-0 object-contain"
			data-testid="library-logo"
		/>
	{:else}
		<span
			class="{size} flex shrink-0 items-center justify-center rounded-container preset-tonal-primary"
			data-testid="library-logo-placeholder"
		>
			<LibraryIcon size={ICON_SIZE.lg} aria-hidden="true" />
		</span>
	{/if}
{/snippet}

<div
	bind:this={shell}
	class="grid min-h-svh grid-rows-[auto_1fr_auto] md:grid-cols-[auto_minmax(0,1fr)] md:grid-rows-[auto_1fr]"
	data-area={coloured ? here : undefined}
	data-area-style={data.areaStyle}
>
	<!-- The first stop of the Tab key: past the menu, to the page (WCAG 2.4.1) -->
	<a
		href="#main"
		class="sr-only z-50 rounded-base bg-surface-50 px-4 py-2 font-semibold text-primary-700 shadow-[var(--bv-shadow-raised)] focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
		data-testid="skip-link">{i18n.t("nav.skip")}</a
	>
	<!-- Desktop sidebar -->
	<aside
		class="hidden md:sticky md:top-0 md:col-start-1 md:row-span-2 md:row-start-1 md:block md:h-svh md:self-start"
		data-testid="sidebar"
	>
		<Navigation
			layout="sidebar"
			role="navigation"
			aria-label={i18n.t("nav.main")}
			class="h-full w-64 overflow-y-auto border-r border-surface-200 bg-surface-50 p-3 shadow-[var(--bv-shadow-card)] lg:w-72"
		>
			<Navigation.Header class="mb-4 px-1 py-1">
				<a
					href={resolve("")}
					class="flex items-center gap-3 rounded-container p-2 hover:bg-surface-100"
					data-testid="brand"
				>
					{@render libraryMark("size-12")}
					<span
						class="line-clamp-2 text-lg leading-tight font-extrabold tracking-tight text-primary-700"
						data-testid="brand-library">{data.libraryName}</span
					>
				</a>
			</Navigation.Header>
			<Navigation.Content>
				<Navigation.Menu class="flex flex-col gap-1">
					{#each items as item (item.key)}
						{@const Icon = icons[item.icon]}
						<Navigation.TriggerAnchor
							href={item.href}
							class="flex items-center gap-3 rounded-container px-3 py-2 text-base font-semibold {current(
								item.href,
							)
								? 'bv-nav-current preset-filled-primary-500 shadow-[var(--bv-shadow-card)]'
								: 'text-surface-800 hover:bg-primary-50 hover:text-primary-800'}"
							aria-current={current(item.href) ? "page" : undefined}
						>
							<IconTile
								class={current(item.href)
									? "bg-white/20"
									: "bg-primary-100 text-primary-700"}
							>
								<Icon size={ICON_SIZE.nav} aria-hidden="true" />
							</IconTile>
							<Navigation.TriggerText
								>{i18n.t(`nav.${item.key}`)}</Navigation.TriggerText
							>
						</Navigation.TriggerAnchor>
					{/each}
				</Navigation.Menu>
			</Navigation.Content>
			<Navigation.Footer class="mt-auto px-3 py-2 text-xs">
				<a
					href={resolve("about")}
					class="opacity-60 hover:underline hover:opacity-100"
					data-testid="about-link"
				>
					{i18n.t("common.app.name")}
					{data.version} · {i18n.t("nav.about")}
				</a>
			</Navigation.Footer>
		</Navigation>
	</aside>

	<!-- Page (before the top bar in DOM order: it publishes the header the bar renders) -->
	<div bind:this={pageArea} class="row-start-2 min-w-0 pb-24 md:col-start-2 md:pb-0">
		{@render children()}
	</div>

	<!-- Top bar -->
	<AppBar
		class="bv-topbar row-start-1 min-w-0 border-b border-surface-200 bg-surface-50 shadow-[var(--bv-shadow-card)] md:sticky md:top-0 md:z-30 md:col-start-2 md:self-start"
		data-testid="app-bar"
	>
		<!-- One toolbar for both sizes: on phones the headline wraps to a second row under the logo.
		     From tablets up it is one row of the same height on every page: the title is cut short
		     rather than pushing anything to another row; the page's views and actions are in the
		     page (9.13, round 24). -->
		<AppBar.Toolbar
			class="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:h-18 md:flex-nowrap md:px-6 md:py-0"
		>
			<AppBar.Lead class="flex items-center gap-2 md:hidden">
				<a
					href={resolve("")}
					class="flex items-center gap-2"
					data-testid="brand-mobile"
					aria-label="{data.libraryName} · {i18n.t('nav.dashboard')}"
				>
					{@render libraryMark("size-9")}
					<span
						class="line-clamp-1 text-lg font-extrabold tracking-tight text-primary-700"
						data-testid="brand-mobile-library">{data.libraryName}</span
					>
				</a>
			</AppBar.Lead>
			<AppBar.Headline
				class="order-last flex min-w-0 basis-full items-center gap-3 md:order-none md:flex-1 md:basis-0"
				data-testid="page-header-bar"
			>
				{#if header.current}
					{#if header.current?.backHref}
						<BackButton
							href={header.current.backHref}
							label={header.current.backLabel ?? i18n.t("common.actions.back")}
						/>
					{/if}
					{#if header.current?.logo}
						<img
							src={header.current.logo}
							alt=""
							class="size-12 shrink-0"
							data-testid="page-logo"
						/>
					{:else if HeaderIcon}
						<IconTile
							size="size-9 md:size-10"
							class="bv-area-icon preset-filled-primary-500 shadow-[var(--bv-shadow-card)]"
							data-testid="page-icon"
						>
							<HeaderIcon size={ICON_SIZE.lg} aria-hidden="true" />
						</IconTile>
					{/if}
					<!-- one line from tablets up (the whole title in its tooltip), two at most on a phone,
					     where the help button follows it (9.47) -->
					<div class="min-w-0 md:flex-1">
						<svelte:element
							this={header.current?.titleTag ?? "h1"}
							class="line-clamp-2 text-2xl leading-tight font-bold md:line-clamp-1 lg:text-[2rem]"
							title={header.current?.title}
							data-testid="page-title"
						>
							{#if header.current?.brand}<span
									class="bv-page-brand mr-2 font-extrabold text-primary-700"
									data-testid="page-brand">{`${header.current.brand} `}</span
								>{/if}{header.current?.title ?? ""}
						</svelte:element>
						{#if header.current?.subtitle}
							<Hint class="block truncate">{header.current?.subtitle}</Hint>
						{/if}
					</div>
				{/if}
				<!-- phones: the manual of this area, a round button beside the title (9.47, Q140) -->
				<a
					href={helpHref(data.docsBase, here)}
					target="_blank"
					rel="external noopener"
					class="btn-icon size-11 shrink-0 rounded-full preset-filled-primary-500 shadow-[var(--bv-shadow-card)] transition-[filter] hover:brightness-110 md:hidden"
					aria-label={i18n.t("nav.help")}
					title={i18n.t("nav.help")}
					data-testid="help-link-mobile"
				>
					<HelpIcon size={ICON_SIZE.lg} aria-hidden="true" />
				</a>
			</AppBar.Headline>
			<AppBar.Trail class="ml-auto flex shrink-0 items-center gap-1">
				{#if data.languages}
					<!-- the public demo only: the visitor's language (Q120) -->
					<LanguageSwitch languages={data.languages} current={data.locale} class="mr-1" />
				{/if}
				<!-- the manual of this area, on the documentation site (9.5b): a labelled button from
				     tablets up, beside the title on phones (9.47, Q140) -->
				<a
					href={helpHref(data.docsBase, here)}
					target="_blank"
					rel="external noopener"
					class="mr-1 btn hidden h-10 preset-filled-primary-500 shadow-[var(--bv-shadow-card)] transition-[filter] hover:brightness-110 md:inline-flex"
					title={i18n.t("nav.help")}
					data-testid="help-link"
				>
					<HelpIcon size={ICON_SIZE.md} aria-hidden="true" />
					<span>{i18n.t("nav.help")}</span>
				</a>
				{#if data.user}
					{#if hasPermission(data.user, "patrons") || hasPermission(data.user, "catalog")}
						<PrintBasket />
					{/if}
				{/if}
				{#if data.user}
					<Menu>
						<Menu.Trigger
							class="btn hover:preset-tonal"
							data-testid="user-menu"
							aria-label={data.user.displayName}
						>
							<UserIcon size={ICON_SIZE.md} aria-hidden="true" />
							<span class="hidden max-w-40 truncate xl:inline"
								>{data.user.displayName}</span
							>
						</Menu.Trigger>
						<MenuPanel>
							<MenuItem value="about" href="/about" icon={InfoIcon}
								>{i18n.t("nav.about")}</MenuItem
							>
							<MenuItem
								value="password"
								href="/password"
								icon={KeyIcon}
								data-testid="menu-password">{i18n.t("nav.password")}</MenuItem
							>
							<MenuItem value="logout" icon={LogoutIcon} onclick={onLogout}
								>{i18n.t("nav.logout")}</MenuItem
							>
						</MenuPanel>
					</Menu>
				{/if}
			</AppBar.Trail>
		</AppBar.Toolbar>
	</AppBar>

	<!-- Mobile bottom bar -->
	<nav
		class="bv-bottom-nav fixed inset-x-0 bottom-0 z-40 row-start-3 border-t border-surface-200 bg-surface-50 shadow-[0_-2px_8px_rgb(15_23_42/0.06)] md:hidden"
		data-testid="bottom-nav"
		aria-label={i18n.t("nav.main")}
	>
		<Navigation layout="bar">
			<Navigation.Menu
				class="grid gap-1 p-1"
				style="grid-template-columns: repeat({mobileItems.length +
					(moreItems.length ? 1 : 0)}, minmax(0, 1fr))"
			>
				{#each mobileItems as item (item.key)}
					{@const Icon = icons[item.icon]}
					<Navigation.TriggerAnchor
						href={item.href}
						class="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-container py-1 text-xs font-semibold {current(
							item.href,
						)
							? 'bv-nav-current-mobile bg-primary-100 text-primary-800'
							: 'text-surface-700 hover:bg-surface-100 hover:text-primary-800'}"
						aria-current={current(item.href) ? "page" : undefined}
					>
						<Icon size={ICON_SIZE.xl} aria-hidden="true" />
						<Navigation.TriggerText>{i18n.t(`nav.${item.key}`)}</Navigation.TriggerText>
					</Navigation.TriggerAnchor>
				{/each}
				{#if moreItems.length}
					<Menu>
						<Menu.Trigger
							class="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-container py-1 text-xs font-semibold {moreCurrent
								? 'bg-primary-100 text-primary-800'
								: 'text-surface-700 hover:bg-surface-100 hover:text-primary-800'}"
							data-current={moreCurrent ? "true" : undefined}
							data-testid="more-menu"
						>
							<MoreIcon size={ICON_SIZE.xl} aria-hidden="true" />
							<span>{i18n.t("nav.more")}</span>
						</Menu.Trigger>
						<MenuPanel>
							{#each moreItems as item (item.key)}
								<MenuItem value={item.key} href={item.href} icon={icons[item.icon]}
									>{i18n.t(`nav.${item.key}`)}</MenuItem
								>
							{/each}
						</MenuPanel>
					</Menu>
				{/if}
			</Navigation.Menu>
		</Navigation>
	</nav>
</div>
