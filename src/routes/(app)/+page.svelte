<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Dashboard (step 4.9): quick actions by permission first, the library today in tiles (each a
     link to where it is dealt with), the loans due this week and today's checkouts and returns; the
     installation switches each section on or off (Appearance page, step 11.15); the staff notes
     the administrator pinned come first, always (step 9.18). The
     only page with the BiblioViva logo and name (step 4.10), the logo twice the size of a page icon. -->
<script lang="ts">
	import { hasPermission } from "#lib/shared/permissions.js";
	import type { ResolvedPathname } from "$app/types";
	import { hasAny } from "#lib/ui/nav.js";
	import InstallHint from "#lib/components/InstallHint.svelte";
	import PinnedNotes from "#lib/components/notes/PinnedNotes.svelte";
	import UpcomingDates from "#lib/components/calendar/UpcomingDates.svelte";
	import DatedRow from "#lib/components/DatedRow.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import logoMark from "#lib/assets/logo-mark.webp";
	import LabelPrintDialog from "#lib/components/catalog/LabelPrintDialog.svelte";
	import TodayActivity from "#lib/components/circulation/TodayActivity.svelte";
	import type { Permission } from "#lib/shared/permissions.js";
	import { ICON_SIZE, icons, type IconName } from "#lib/ui/icons.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import DividedList from "#lib/ui/DividedList.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import StatTile from "#lib/ui/StatTile.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const DueIcon = icons.dueSoon;
	const ActionsIcon = icons.lists;
	let labelDialog = $state(false);

	const can = (permission: Permission): boolean => hasPermission(data.user, permission);
	const dueDay = (iso: string): string => fmt.day(iso, { weekday: "short", day: "numeric" });

	interface QuickAction {
		key: string;
		/** The name of the tab or button it opens (9.13, round 35): the same i18n key. */
		label: string;
		href: ResolvedPathname;
		icon: IconName;
		/** One of these is needed. */
		permission: Permission | readonly Permission[];
		/** Not shown to accounts with this one (they have the page elsewhere). */
		unless?: Permission;
		/** Left out while patron photos are switched off (9.38). */
		photos?: true;
	}
	const ACTIONS: QuickAction[] = [
		{
			key: "checkout",
			label: "nav.areas.circulation.checkout",
			href: "/circulation/checkout",
			icon: "loan",
			permission: "loans",
		},
		{
			key: "checkin",
			label: "nav.areas.circulation.checkin",
			href: "/circulation/checkin",
			icon: "return",
			permission: "loans",
		},
		{
			key: "newBook",
			label: "catalog.list.new",
			href: "/cataloging/new",
			icon: "add",
			permission: "catalog",
		},
		{
			key: "newPatron",
			label: "patrons.list.new",
			href: "/patrons/new",
			icon: "patron",
			permission: "patrons",
		},
		{
			key: "census",
			label: "nav.areas.patrons.census",
			href: "/census",
			icon: "camera",
			permission: "patrons",
			photos: true,
		},
		{
			key: "printLists",
			label: "nav.printing",
			href: "/print-lists",
			icon: "print",
			permission: ["patrons", "catalog"],
		},
		{
			key: "inventory",
			label: "nav.areas.catalog.inventory",
			href: "/inventory",
			icon: "inventory",
			permission: "catalog",
		},
		{
			key: "reports",
			label: "nav.reports",
			href: "/reports",
			icon: "reports",
			permission: "reports",
		},
		{ key: "admin", label: "nav.admin", href: "/admin", icon: "admin", permission: "admin" },
		// the imports live in Administration; an account allowed to import without being an
		// administrator finds them here (9.13, round 16)
		{
			key: "imports",
			label: "admin.imports.title",
			href: "/admin/imports",
			icon: "upload",
			permission: ["catalog.import", "patrons.import"],
			unless: "admin",
		},
	];
	const actions = $derived(
		ACTIONS.filter(
			(a) =>
				hasAny(data.user, a.permission) &&
				!(a.unless && can(a.unless)) &&
				!(a.photos && !data.photosEnabled),
		),
	);
	const sections = $derived(data.sections);
	const loans = $derived(data.stats.loans);
	const due = $derived(data.stats.dueThisWeek);
	const showToday = $derived(sections.todayActivity && can("loans"));
	const patrons = $derived(data.stats.patrons);
	const catalog = $derived(data.stats.catalog);
	const inventory = $derived(data.stats.inventory);
	const InventoryIcon = icons.inventory;
	const DemoIcon = icons.damaged;
</script>

<Page width="xl">
	<PageHeader
		brand={i18n.t("common.app.name")}
		title={data.libraryName}
		docTitle={i18n.t("nav.dashboard")}
		logo={logoMark}
	/>
	{#if data.demo}
		<!-- the only warning of the demo data (9.13, round 24: no badge in the top bar) -->
		<Alert tone="warning" padded as="div" icon={DemoIcon} data-testid="demo-counts">
			{i18n.t("common.demo.panel", {
				when: fmt.dateTime(data.demo.loadedAt),
				...data.demo.counts,
			})}
		</Alert>
	{/if}

	<!-- the quick actions first, the pinned notes under them (9.13, round 25) -->
	{#if sections.quickActions && actions.length > 0}
		<Card gap="3" as="section" data-testid="quick-actions">
			<Row as="h2" align="center" gap="2" class="font-semibold">
				<ActionsIcon size={ICON_SIZE.md} aria-hidden="true" />
				{i18n.t("dashboard.actions.title")}
			</Row>
			<Row>
				{#each actions as a (a.key)}
					<Button
						icon={icons[a.icon]}
						href={a.href}
						variant={a.key === "checkout" ? "primary" : "tonal"}
						data-testid="quick-{a.key}">{i18n.t(a.label)}</Button
					>
				{/each}
			</Row>
		</Card>
	{/if}

	<PinnedNotes notes={data.pinnedNotes} />

	{#if sections.tiles && (loans || patrons || catalog || data.openNotes !== null)}
		<section class="space-y-3" data-testid="dashboard-tiles">
			<h2 class="sr-only">{i18n.t("dashboard.tilesTitle")}</h2>
			<div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
				{#if loans}
					<!-- today's work first (9.13, round 25) -->
					<StatTile
						icon="loan"
						tone="tertiary"
						value={loans.issuedToday}
						label={i18n.t("dashboard.tiles.issuedToday")}
						href="/circulation/checkout"
						testid="tile-issued-today"
					/>
					<StatTile
						icon="return"
						tone="success"
						value={loans.returnedToday}
						label={i18n.t("dashboard.tiles.returnedToday")}
						href="/circulation/checkin"
						testid="tile-returned-today"
					/>
					<StatTile
						icon="loan"
						value={loans.open}
						label={i18n.t("dashboard.tiles.open")}
						href="/circulation/loans"
						testid="tile-open"
					/>
					<StatTile
						icon="overdue"
						tone={loans.overdue > 0 ? "error" : "success"}
						value={loans.overdue}
						label={i18n.t("dashboard.tiles.overdue")}
						href="/circulation/overdues"
						testid="tile-overdue"
					/>
				{/if}
				{#if patrons}
					<StatTile
						icon="card"
						tone={patrons.withoutCard > 0 ? "warning" : "success"}
						value={patrons.withoutCard}
						label={i18n.t("dashboard.tiles.withoutCard")}
						href="/print-lists"
						testid="tile-without-card"
					/>
					{#if data.photosRequired}
						<StatTile
							icon="noPhoto"
							tone={patrons.withoutPhoto > 0 ? "warning" : "success"}
							value={patrons.withoutPhoto}
							label={i18n.t("dashboard.tiles.withoutPhoto")}
							href="/census"
							testid="tile-without-photo"
						/>
					{/if}
				{/if}
				{#if catalog}
					<StatTile
						icon="label"
						tone={catalog.pendingPair > 0 ? "warning" : "success"}
						value={catalog.pendingPair}
						label={i18n.t("dashboard.tiles.pendingLabels")}
						onclick={catalog.pendingPair > 0 ? () => (labelDialog = true) : undefined}
						testid="tile-pending-labels"
					/>
					<!-- only when some book waits for its classification (step 9.21) -->
					{#if catalog.toClassify > 0}
						<StatTile
							icon="toClassify"
							tone="warning"
							value={catalog.toClassify}
							label={i18n.t("dashboard.tiles.toClassify")}
							href="/catalog/to-classify"
							testid="tile-to-classify"
						/>
					{/if}
				{/if}
				{#if data.openNotes !== null}
					<StatTile
						icon="notes"
						tone={data.openNotes > 0 ? "warning" : "success"}
						value={data.openNotes}
						label={i18n.t("notes.tile")}
						href="/notes"
						testid="tile-open-notes"
					/>
				{/if}
			</div>
		</section>
	{/if}

	{#if sections.installHint}
		<InstallHint />
	{/if}

	{#if inventory}
		<Card gap="3" as="section" data-testid="inventory-tile">
			<Row as="h2" align="center" gap="2" class="font-semibold">
				<InventoryIcon size={ICON_SIZE.md} aria-hidden="true" />
				{i18n.t("dashboard.inventory.title")}: {inventory.name}
			</Row>
			<Hint tone="soft">
				{i18n.t("catalog.inventory.progress", {
					seen: inventory.seen,
					expected: inventory.expected,
					percent:
						inventory.expected === 0
							? 100
							: Math.round((inventory.seen / inventory.expected) * 100),
				})}
			</Hint>
			<Row>
				<Button
					variant="primary"
					icon={InventoryIcon}
					href="/inventory"
					data-testid="inventory-continue"
					>{i18n.t("dashboard.inventory.continue")}</Button
				>
			</Row>
		</Card>
	{/if}

	{#if data.upcoming}
		<UpcomingDates upcoming={data.upcoming} />
	{/if}

	{#if due || showToday}
		<div class="grid gap-6 {due && showToday ? 'lg:grid-cols-2' : ''}">
			{#if due}
				<Card gap="3" as="section" data-testid="due-this-week">
					<Row as="h2" align="center" gap="2" class="font-semibold">
						<DueIcon size={ICON_SIZE.md} aria-hidden="true" />
						{i18n.t("dashboard.dueWeek.title")} ({due.total})
					</Row>
					{#if due.loans.length === 0}
						<Hint
							>{i18n.t("dashboard.dueWeek.none", {
								day: fmt.day(due.weekEnd, { weekday: "long" }),
							})}</Hint
						>
					{:else}
						<DividedList>
							{#each due.loans as l (l.loanId)}
								<DatedRow
									title={l.title}
									hint={l.name}
									when={i18n.t("dashboard.dueWeek.due", {
										date: dueDay(l.dueDate),
									})}
								/>
							{/each}
						</DividedList>
						{#if due.total > due.loans.length}
							<Hint
								>{i18n.t("dashboard.dueWeek.more", {
									count: due.total - due.loans.length,
								})}</Hint
							>
						{/if}
					{/if}
				</Card>
			{/if}
			{#if showToday}
				<TodayActivity />
			{/if}
		</div>
	{/if}
</Page>

{#if catalog}
	<LabelPrintDialog bind:open={labelDialog} pending />
{/if}
