<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Reports (step 6.2): the report library by category, each card opening its page; files that
     could not be loaded are listed for administrators with the reason. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import { listReports } from "#lib/remote/reports.remote.js";
	import { ICON_SIZE, icons, type IconName } from "#lib/ui/icons.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import LinkCard from "#lib/ui/LinkCard.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	const i18n = useI18n();
	const library = listReports();
	const CATEGORIES: { key: "loans" | "books" | "patrons" | "ops"; icon: IconName }[] = [
		{ key: "loans", icon: "loan" },
		{ key: "books", icon: "catalog" },
		{ key: "patrons", icon: "patrons" },
		{ key: "ops", icon: "admin" },
	];
	const ChartIcon = icons.reports;
	const LockIcon = icons.admin;
</script>

<Page width="2xl">
	<PageHeader title={i18n.t("reports.title")} icon="reports" />

	<QueryState query={library}>
		{#snippet children(lib)}
			{#if lib.problems.length > 0}
				<Alert tone="warning" padded data-testid="report-problems">
					<strong>{i18n.t("reports.problemsTitle")}</strong>
					<p>{i18n.t("reports.problemsHint")}</p>
					<ul class="list-disc pl-5">
						{#each lib.problems as p (p.file)}
							<li><code>{p.file}</code>: {p.message}</li>
						{/each}
					</ul>
				</Alert>
			{/if}
			{#each CATEGORIES as c (c.key)}
				{@const reports = lib.reports.filter((r) => r.category === c.key)}
				{@const Icon = icons[c.icon]}
				{#if reports.length > 0}
					<section class="space-y-3" data-testid="report-category-{c.key}">
						<Row as="h2" align="center" gap="2" class="text-lg font-bold">
							<Icon size={ICON_SIZE.lg} aria-hidden="true" />
							{i18n.t(`reports.categories.${c.key}`)}
						</Row>
						<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{#each reports as r (r.id)}
								<LinkCard
									href={resolve(`reports/${r.id}`)}
									class="flex flex-col gap-1 p-4"
									data-testid="report-{r.id}"
								>
									<span class="font-semibold">{r.title}</span>
									{#if r.description}<Hint as="span">{r.description}</Hint>{/if}
									<Row gap="1" class="mt-1">
										{#if r.chart}
											<Badge
												><ChartIcon
													size={ICON_SIZE.sm}
													aria-hidden="true"
												/>{i18n.t("reports.chart")}</Badge
											>
										{/if}
										{#if r.restricted}
											<Badge
												><LockIcon
													size={ICON_SIZE.sm}
													aria-hidden="true"
												/>{i18n.t("reports.restricted")}</Badge
											>
										{/if}
										{#if r.source === "config"}<Badge
												>{i18n.t("reports.custom")}</Badge
											>{/if}
									</Row>
								</LinkCard>
							{/each}
						</div>
					</section>
				{/if}
			{/each}
		{/snippet}
	</QueryState>
</Page>
