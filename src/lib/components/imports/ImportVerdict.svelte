<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Outcome of the validate phase (§3.22): the counts per status, the "only errors" switch and the
     verdict line (import allowed only with zero errors). Shared by every import wizard. -->
<script lang="ts">
	import Alert from "#lib/ui/Alert.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import type { ImportCounts } from "#lib/server/imports/pipeline.js";
	import Badge from "#lib/ui/Badge.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		counts: ImportCounts;
		onlyErrors: boolean;
		canCommit: boolean;
		/** Verdict texts (they name what is imported). */
		ready: string;
		blocked: string;
		/** Statuses the import never produces are not shown (e.g. "update" for loans). */
		statuses?: ("new" | "update" | "unchanged")[];
	}

	let {
		counts,
		onlyErrors = $bindable(),
		canCommit,
		ready,
		blocked,
		statuses = ["new", "update", "unchanged"],
	}: Props = $props();
	const i18n = useI18n();
	const TONE = { new: "success", update: "primary", unchanged: "neutral" } as const;
</script>

<Row align="center" data-testid="counts">
	{#each statuses as s (s)}
		<Badge tone={TONE[s]}>{i18n.t(`common.import.counts.${s}`, { count: counts[s] })}</Badge>
	{/each}
	<Badge tone={counts.error ? "error" : "neutral"}
		>{i18n.t("common.import.counts.error", { count: counts.error })}</Badge
	>
	<Row wrap={false} align="center" as="label" class="ml-auto text-sm">
		<input type="checkbox" class="checkbox" bind:checked={onlyErrors} />
		{i18n.t("common.import.onlyErrors")}
	</Row>
</Row>
<Alert tone={canCommit ? "success" : "error"} role="status" data-testid="preview-verdict">
	{canCommit ? ready : blocked}
</Alert>
