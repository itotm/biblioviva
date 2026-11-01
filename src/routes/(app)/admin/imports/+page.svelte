<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Administration → Importazioni (9.13, round 13): the four imports in one place, since they are
     used when moving from Koha and, for the class lists, once a year. -->
<script lang="ts">
	import { page } from "$app/state";
	import { AREAS } from "#lib/components/AreaTabs.svelte";
	import { hasPermission } from "#lib/shared/permissions.js";
	import { useI18n } from "#lib/i18n/context.js";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import NavCard from "#lib/ui/NavCard.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";

	const i18n = useI18n();
	const user = $derived(page.data.user as { permissions: readonly string[] } | null);
	const isAdmin = $derived(hasPermission(user, "admin"));
	const imports = $derived(AREAS.imports.filter((i) => hasPermission(user, i.permission)));
</script>

<Page width="2xl">
	<PageHeader
		title={i18n.t("admin.imports.title")}
		icon="upload"
		backHref={isAdmin ? "/admin" : "/"}
		backLabel={isAdmin ? i18n.t("admin.home.title") : i18n.t("nav.dashboard")}
	/>
	<Hint>{i18n.t("admin.imports.hint")}</Hint>
	<Grid from="sm" lg3 as="nav" aria-label={i18n.t("admin.imports.title")}>
		{#each imports as item (item.key)}
			<NavCard
				href={item.href}
				icon={item.icon}
				title={i18n.t(`admin.imports.cards.${item.key}.title`)}
				description={i18n.t(`admin.imports.cards.${item.key}.description`)}
				data-testid="imports-{item.key}"
			/>
		{/each}
	</Grid>
</Page>
