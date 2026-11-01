<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Modifica le copie" (step 3.10): one change applied to many copies — the copies of the records
     selected in the catalogue, or given one by one. Check first (what changes, what stays and why), then apply in one transaction. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { applyItemBatch, planItemBatch } from "#lib/remote/batch-items.remote.js";
	import { getClassificationOptions } from "#lib/remote/catalog.remote.js";
	import type { BatchPlan } from "#lib/server/services/batch-items.js";
	import { ITEM_STATUS_VALUES } from "#lib/shared/catalog-schema.js";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";

	type Source = { biblioIds: number[] } | { itemIds: number[] };
	type Op = "status" | "itemType" | "notForLoan" | "readingLevel" | "acquisitionDate";

	interface Props {
		open?: boolean;
		source: Source;
		/** Copies in the source, when known (shown in the title). */
		count?: number;
		onapplied?: () => void;
	}

	let { open = $bindable(false), source, count, onapplied }: Props = $props();
	const i18n = useI18n();
	const CheckIcon = icons.confirm;
	const options = $derived(open ? getClassificationOptions() : null);

	let op = $state<Op>("status");
	let status = $state<(typeof ITEM_STATUS_VALUES)[number]>("withdrawn");
	let itemType = $state("");
	let notForLoan = $state("1");
	let readingLevel = $state("");
	let acquisitionDate = $state("");
	let reason = $state("");
	let plan = $state<BatchPlan | null>(null);
	let problem = $state("");
	let busy = $state(false);

	const STATUS_KEY: Record<string, string> = { in_repair: "inRepair" };
	const ops = $derived<Op[]>(
		options?.current?.classPerItem && options.current.fictionByClass
			? ["status", "itemType", "notForLoan", "readingLevel", "acquisitionDate"]
			: ["status", "itemType", "notForLoan", "acquisitionDate"],
	);
	const operation = $derived.by(() => {
		switch (op) {
			case "status":
				return { kind: "status" as const, status, reason };
			case "itemType":
				return { kind: "itemType" as const, itemType };
			case "notForLoan":
				return { kind: "notForLoan" as const, notForLoan: notForLoan === "1" };
			case "readingLevel":
				return {
					kind: "readingLevel" as const,
					readingLevel: readingLevel === "" ? null : readingLevel,
				};
			case "acquisitionDate":
				return { kind: "acquisitionDate" as const, acquisitionDate };
		}
	});

	// a check is valid only for the operation it was made for
	let plannedFor = $state("");
	const planned = $derived(plannedFor === JSON.stringify(operation) ? plan : null);

	$effect(() => {
		if (itemType === "" && options?.current?.itemTypes[0]) {
			itemType = options.current.itemTypes[0].code;
		}
	});

	function close(): void {
		open = false;
		plan = null;
		problem = "";
	}

	async function check(): Promise<void> {
		busy = true;
		try {
			const r = await planItemBatch({ source, operation });
			if (!r.ok) {
				problem = i18n.t(`catalog.batch.errors.${r.error}`);
				return;
			}
			plan = r;
			plannedFor = JSON.stringify(operation);
		} finally {
			busy = false;
		}
	}

	async function apply(): Promise<void> {
		busy = true;
		try {
			const r = await applyItemBatch({ source, operation });
			if (!r.ok) {
				problem = i18n.t(`catalog.batch.errors.${r.error}`);
				return;
			}
			toaster.success({ title: i18n.t("catalog.batch.done", { count: r.changed }) });
			onapplied?.();
			close();
		} finally {
			busy = false;
		}
	}

	const excludedRows = $derived((planned?.rows ?? []).filter((r) => r.exclusion !== null));
</script>

<Modal
	bind:open
	title={i18n.t("catalog.batch.title")}
	note={count === undefined ? undefined : i18n.t("catalog.batch.scope", { count })}
	onclose={close}
	width="lg"
	data-testid="batch-dialog"
>
	<Field label={i18n.t("catalog.batch.operation")}>
		<Select bind:value={op} data-testid="batch-operation">
			{#each ops as o (o)}
				<option value={o}>{i18n.t(`catalog.batch.operations.${o}`)}</option>
			{/each}
		</Select>
	</Field>
	<Field label={i18n.t("catalog.batch.value")}>
		{#if op === "status"}
			<Select bind:value={status} data-testid="batch-status">
				{#each ITEM_STATUS_VALUES as s (s)}
					<option value={s}>{i18n.t(`common.statuses.item.${STATUS_KEY[s] ?? s}`)}</option
					>
				{/each}
			</Select>
		{:else if op === "itemType"}
			<Select bind:value={itemType}>
				{#each options?.current?.itemTypes ?? [] as t (t.code)}
					<option value={t.code}>{t.label}</option>
				{/each}
			</Select>
		{:else if op === "notForLoan"}
			<Select bind:value={notForLoan}>
				<option value="1">{i18n.t("catalog.batch.yes")}</option>
				<option value="0">{i18n.t("catalog.batch.no")}</option>
			</Select>
		{:else if op === "readingLevel"}
			<Select bind:value={readingLevel}>
				<option value="">{i18n.t("catalog.batch.noClass")}</option>
				{#each options?.current?.readingLevels ?? [] as l (l.code)}
					<option value={l.code}>{l.label}</option>
				{/each}
			</Select>
		{:else}
			<Input type="date" bind:value={acquisitionDate} />
		{/if}
	</Field>
	{#if op === "status"}
		<Field label={i18n.t("catalog.batch.reason")} hint={i18n.t("catalog.batch.reasonHint")}>
			<Input bind:value={reason} maxlength={200} data-testid="batch-reason" />
		</Field>
	{/if}
	{#if problem}
		<Alert data-testid="batch-problem">{problem}</Alert>
	{/if}
	{#if planned}
		<div class="space-y-2" data-testid="batch-plan">
			<Hint tone="primary"
				>{planned.changes > 0
					? i18n.t("catalog.batch.plan.changes", { count: planned.changes })
					: i18n.t("catalog.batch.plan.none")}</Hint
			>
			{#each ["onLoan", "unchanged", "notFound", "notAllowed"] as const as k (k)}
				{#if planned.excluded[k] > 0}
					<Hint data-testid="batch-excluded-{k}"
						>{i18n.t(`catalog.batch.plan.${k}`, {
							count: planned.excluded[k],
						})}</Hint
					>
				{/if}
			{/each}
			{#if excludedRows.length > 0}
				<details>
					<summary class="cursor-pointer text-sm hover:underline"
						>{i18n.t("catalog.batch.excludedTitle")}</summary
					>
					<ul class="mt-1 max-h-40 overflow-y-auto text-sm">
						{#each excludedRows as r (r.itemId)}
							<li>
								<span class="font-mono">{r.barcode}</span>
								{r.title}
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		</div>
	{/if}
	<Row justify="end" as="footer">
		<Button onclick={close} disabled={busy}>{i18n.t("common.actions.close")}</Button>
		{#if planned && planned.changes > 0}
			<Button
				variant={op === "status" && (status === "withdrawn" || status === "lost")
					? "error"
					: "primary"}
				icon={CheckIcon}
				onclick={apply}
				disabled={busy}
				data-testid="batch-apply"
				>{i18n.t("catalog.batch.apply", { count: planned.changes })}</Button
			>
		{:else}
			<Button variant="primary" onclick={check} disabled={busy} data-testid="batch-check"
				>{i18n.t("catalog.batch.check")}</Button
			>
		{/if}
	</Row>
</Modal>
