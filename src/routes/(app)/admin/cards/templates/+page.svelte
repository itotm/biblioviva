<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Print templates (step 2.5b): every template folder with its status, real-size card previews in
     sandboxed iframes, whole-sheet preview, test page, label stock calibration page. -->
<script lang="ts">
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import CardTemplatesTab from "#lib/components/cards/CardTemplatesTab.svelte";
	import LabelTemplatesTab from "#lib/components/cards/LabelTemplatesTab.svelte";
	import { Tabs } from "@skeletonlabs/skeleton-svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { getTemplatesOverview } from "#lib/remote/print-templates.remote.js";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	const i18n = useI18n();
	const overview = getTemplatesOverview();
	const ReloadIcon = icons.renew;
	let reloading = $state(false);
	let cardsTab = $state<CardTemplatesTab>();

	async function reload(): Promise<void> {
		reloading = true;
		try {
			await overview.refresh();
			await cardsTab?.refresh();
			toaster.info({ title: i18n.t("admin.templates.reloaded") });
		} finally {
			reloading = false;
		}
	}

	function tabValue(value: string): "cards" | "labels" | "slips" {
		if (value === "labels" || value === "slips") {
			return value;
		}
		return "cards";
	}
	let kind = $state<"cards" | "labels" | "slips">("cards");
</script>

<Page width="2xl">
	<PageHeader
		title={i18n.t("admin.templates.title")}
		icon="print"
		backHref="/admin/config"
		backLabel={i18n.t("admin.home.sections.config.title")}
	>
		{#snippet actions()}
			<Button
				icon={ReloadIcon}
				onclick={reload}
				disabled={reloading}
				data-testid="reload-templates">{i18n.t("admin.templates.reload")}</Button
			>
		{/snippet}
		{#snippet views()}
			<AreaTabs area="templates" current="previews" />
		{/snippet}
	</PageHeader>

	<QueryState query={overview}>
		{#snippet children(o)}
			<Tabs value={kind} onValueChange={(e) => (kind = tabValue(e.value))}>
				<Tabs.List>
					<Tabs.Trigger value="cards"
						>{i18n.t("admin.templates.kinds.cards")}</Tabs.Trigger
					>
					<Tabs.Trigger value="labels"
						>{i18n.t("admin.templates.kinds.labels")}</Tabs.Trigger
					>
					<Tabs.Trigger value="slips"
						>{i18n.t("admin.templates.kinds.slips")}</Tabs.Trigger
					>
				</Tabs.List>

				<Tabs.Content value="cards" class="space-y-6">
					<CardTemplatesTab bind:this={cardsTab} cards={o.cards} />
				</Tabs.Content>

				<Tabs.Content value="labels" class="space-y-6">
					<LabelTemplatesTab labels={o.labels} stocks={o.stocks} />
				</Tabs.Content>

				<Tabs.Content value="slips">
					{#if o.slips.length === 0}
						<EmptyState
							title={i18n.t("admin.templates.list.emptySlips")}
							icon="print"
						/>
					{:else}
						<ul class="space-y-3">
							{#each o.slips as t (t.name)}
								<Card as="li" data-testid="template-slips-{t.name}">
									<span class="title-lg">{t.name}</span>
									<Badge
										>{i18n.t(`admin.templates.list.source.${t.source}`)}</Badge
									>
									{#if t.error}<Hint tone="error-soft" mono class="mt-2"
											>{t.error}</Hint
										>{/if}
								</Card>
							{/each}
						</ul>
					{/if}
				</Tabs.Content>
			</Tabs>
		{/snippet}
	</QueryState>
</Page>
