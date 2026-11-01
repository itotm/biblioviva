<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Edit a report (step 9.20): the definition in use — a built-in is saved as the school's
     customised copy with the same id ("Torna all'originale" in the library removes it). -->
<script lang="ts">
	import ReportEditor from "#lib/components/config/ReportEditor.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { getReportDraft } from "#lib/remote/report-library.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const draft = $derived(getReportDraft(data.id));
</script>

<Page width="2xl">
	<PageHeader
		title={i18n.t("config.reports.editor.editTitle")}
		subtitle={data.id}
		icon="edit"
		backHref="/admin/config/reports"
		backLabel={i18n.t("config.reports.title")}
	/>
	<QueryState query={draft}>
		{#snippet children(d)}
			{#if !d.ok}
				<Alert>{i18n.t(`config.reports.errors.${d.code}`)}</Alert>
			{:else}
				{#if d.origin === "builtin"}
					<Hint tone="soft" data-testid="editor-builtin-hint"
						>{i18n.t("config.reports.editor.builtinHint")}</Hint
					>
				{/if}
				{#key data.id}
					<ReportEditor initial={d.draft} isNew={false} />
				{/key}
			{/if}
		{/snippet}
	</QueryState>
</Page>
