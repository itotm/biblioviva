<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Title, optional subtitle, views and actions of a page (§3.18: one pattern per job). Inside the
     app shell the title goes to the top bar, which keeps one height on every page; the views (the
     pages of the area, `AreaTabs`, or a filter) and the actions make the page's toolbar, a card
     under the bar: the views, and the actions on their right, on a row of their own when the
     window is narrow (9.13, rounds 24 and 26). The browser tab shows the same title, written here
     so that server rendering has it too (the layout renders before the page, so on the server it
     would read the bar's store still empty); `docTitle` when the tab should say something else. -->
<script lang="ts">
	import type { ResolvedPathname } from "$app/types";
	import { onDestroy, untrack, type Snippet } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { ICON_SIZE, icons, type IconName } from "./icons.js";
	import { usePageHeader } from "./page-header.svelte.js";
	import BackButton from "#lib/ui/BackButton.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		title: string;
		/** The browser tab's title when it is not `title` ("· BiblioViva" is added). */
		docTitle?: string;
		/** Rendered before the title in the brand style (extra bold, primary colour). */
		brand?: string;
		subtitle?: string;
		icon?: IconName;
		/** Image shown in place of the icon, twice its size (step 4.10: the BiblioViva logo on the dashboard). */
		logo?: string;
		/** The switch between the views of the page or of its area (first row of the toolbar). */
		views?: Snippet;
		/** The page's buttons (second row of the toolbar). */
		actions?: Snippet;
		children?: Snippet;
		/** Link to the parent page, rendered as a back arrow before the title. */
		backHref?: ResolvedPathname;
		backLabel?: string;
	}

	const {
		title,
		docTitle,
		brand,
		subtitle,
		icon,
		logo,
		views,
		actions,
		children,
		backHref,
		backLabel,
	}: Props = $props();
	const Icon = $derived(icon ? icons[icon] : undefined);
	const i18n = useI18n();
	const store = usePageHeader();
	const token = Symbol("page-header");
	const publish = (): void =>
		store?.set(token, { title, brand, subtitle, icon, logo, backHref, backLabel });
	// published synchronously so server rendering already has it; the effect keeps it in sync
	untrack(publish);
	$effect(publish);
	onDestroy(() => store?.clear(token));
</script>

<svelte:head>
	<!-- inside the app shell only: the style guide's sample header keeps the guide's title -->
	{#if store}<title>{docTitle ?? title} · {i18n.t("common.app.name")}</title>{/if}
</svelte:head>

{#if !store}
	<Row wrap={false} align="start" gap="3" as="header">
		{#if backHref}
			<BackButton href={backHref} label={backLabel ?? ""} />
		{/if}
		{#if logo}
			<img src={logo} alt="" class="size-20" />
		{:else if Icon}
			<span
				class="mt-0.5 hidden size-12 shrink-0 items-center justify-center rounded-container preset-filled-primary-500 shadow-[var(--bv-shadow-card)] md:inline-flex"
			>
				<Icon size={ICON_SIZE.xl} aria-hidden="true" />
			</span>
		{/if}
		<div>
			<h1 class="h2">
				{#if brand}<span class="mr-3 font-extrabold text-primary-700">{brand}</span
					>{/if}{title}
			</h1>
			{#if subtitle}
				<p class="opacity-70">{subtitle}</p>
			{/if}
		</div>
	</Row>
{/if}
{#if views || actions}
	<!-- the views and, on their right, the actions, on one row while the buttons fit beside the
	     views; otherwise they go to a row of their own (9.13, round 26). Hidden when the views render
	     nothing (an area with one page for the account) and there are no actions. -->
	<Card
		as="section"
		class="flex flex-wrap items-center gap-3 [&:not(:has(>:not(:empty)))]:hidden"
		data-testid="page-toolbar"
	>
		{#if views}<div class="max-w-full min-w-0 empty:hidden">{@render views()}</div>{/if}
		{#if actions}
			<Row
				align="center"
				justify="end"
				class="bv-page-actions min-w-0 flex-auto"
				data-testid="page-actions">{@render actions()}</Row
			>
		{/if}
	</Card>
{/if}
{#if children}
	<div>{@render children()}</div>
{/if}
