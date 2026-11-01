<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Administration home: one card per section (filled in by steps 1.7–1.11 and later phases): the
     configuration and the jobs on the library's data (accounts, activity, backups, imports, exports,
     class upgrade). -->
<script lang="ts">
	import type { ResolvedPathname } from "$app/types";
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import NavCard from "#lib/ui/NavCard.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import { ICON_SIZE, icons, type IconName } from "#lib/ui/icons.js";
	import { goto } from "$app/navigation";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import { clearDemoData } from "#lib/remote/setup.remote.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Grid from "#lib/ui/Grid.svelte";
	import Page from "#lib/ui/Page.svelte";

	const { data } = $props();
	const i18n = useI18n();
	let confirmClear = $state(false);
	const DemoIcon = icons.delete;

	async function onClearDemo(): Promise<void> {
		const { password } = await clearDemoData();
		// the accounts keep the demo password until it is changed
		toaster.warning({
			title: i18n.t("admin.demo.cleared"),
			description: i18n.t("admin.demo.clearedPassword", { password }),
			duration: 20_000,
		});
		await goto(resolve("login"));
	}
	const sections: {
		key: "config" | "audit" | "users" | "backups" | "imports" | "rollover" | "exports";
		href: ResolvedPathname;
		icon: IconName;
	}[] = [
		// appearance and language, the classes and the print templates are in the configuration;
		// the closures of the calendar in its "Calendario" section (9.13, round 25)
		{ key: "config", href: "/admin/config", icon: "config" },
		{ key: "audit", href: "/admin/audit", icon: "lists" },
		{ key: "users", href: "/admin/users", icon: "patrons" },
		{ key: "backups", href: "/admin/backups", icon: "download" },
		{ key: "imports", href: "/admin/imports", icon: "upload" },
		{ key: "rollover", href: "/admin/rollover", icon: "teacher" },
		{ key: "exports", href: "/admin/exports", icon: "export" },
	];
</script>

<Page width="2xl">
	<PageHeader title={i18n.t("admin.home.title")} icon="admin">
		{#snippet actions()}
			<!-- the public demo keeps its data until the nightly reset (9.17) -->
			{#if data.demo && !data.demoPublic}
				<button
					type="button"
					class="btn preset-filled-warning-500"
					onclick={() => (confirmClear = true)}
					data-testid="clear-demo"
				>
					<DemoIcon size={ICON_SIZE.md} aria-hidden="true" />
					<span>{i18n.t("admin.demo.clear")}</span>
				</button>
			{/if}
		{/snippet}
	</PageHeader>
	<ConfirmDialog
		bind:open={confirmClear}
		title={i18n.t("admin.demo.confirmTitle")}
		description={i18n.t("admin.demo.confirmDescription")}
		tone="error"
		confirmLabel={i18n.t("admin.demo.clear")}
		onconfirm={onClearDemo}
	/>
	<Grid from="sm" lg3 as="nav" aria-label={i18n.t("admin.home.title")}>
		{#each sections as section (section.key)}
			<NavCard
				href={section.href}
				icon={section.icon}
				title={i18n.t(`admin.home.sections.${section.key}.title`)}
				description={i18n.t(`admin.home.sections.${section.key}.description`)}
				data-testid="admin-section-{section.key}"
			/>
		{/each}
	</Grid>
</Page>
