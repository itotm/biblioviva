<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A new report (step 9.20): a guided draft (loans of the period by class year), or a copy of an
     existing report ("Duplica" in the library) with a new id to type. -->
<script lang="ts">
	import ReportEditor from "#lib/components/config/ReportEditor.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { getReportDraft } from "#lib/remote/report-library.remote.js";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Loading from "#lib/ui/Loading.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const source = $derived(data.from ? getReportDraft(data.from) : null);

	const BLANK = {
		id: "",
		title: { it: "", en: "" },
		category: "loans",
		query: {
			source: "loans",
			filters: [{ field: "period", ask: true }],
			rows: ["classYear"],
			measures: ["loans"],
			totals: "both",
			sort: "dimension",
			chart: "bar",
		},
	};

	const initial = $derived.by(() => {
		const s = source?.current;
		if (!s?.ok) {
			return null;
		}
		const title = s.draft.title as string | Record<string, string>;
		const copy = i18n.t("config.reports.editor.copySuffix");
		return {
			...s.draft,
			id: `${data.from}-${copy}`,
			title:
				typeof title === "string"
					? `${title} (${copy})`
					: Object.fromEntries(
							Object.entries(title).map(([k, v]) => [k, `${v} (${copy})`]),
						),
		};
	});
</script>

<Page width="2xl">
	<PageHeader
		title={i18n.t("config.reports.editor.newTitle")}
		subtitle={data.from ?? ""}
		icon="add"
		backHref="/admin/config/reports"
		backLabel={i18n.t("config.reports.title")}
	/>
	{#if !data.from}
		<ReportEditor initial={BLANK} isNew />
	{:else if initial}
		<ReportEditor {initial} isNew />
	{:else}
		<Loading />
	{/if}
</Page>
