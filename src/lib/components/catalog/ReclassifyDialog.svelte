<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Riclassifica" (step 3.10): the records selected in the catalogue get one new classification
     (genre or subject, associated class), optionally with their call numbers rewritten; the spine
     bands go back among the labels to print. Check first, then apply in one transaction. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { applyRecordReclassify, planRecordReclassify } from "#lib/remote/batch-items.remote.js";
	import { getClassificationOptions } from "#lib/remote/catalog.remote.js";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";

	interface Props {
		open?: boolean;
		biblioIds: number[];
		onapplied?: () => void;
	}

	let { open = $bindable(false), biblioIds, onapplied }: Props = $props();
	const i18n = useI18n();
	const CheckIcon = icons.confirm;
	const options = $derived(open ? getClassificationOptions() : null);

	let kind = $state<"fiction" | "nonfiction">("fiction");
	let genreCode = $state("");
	let classCode = $state("");
	let readingLevel = $state("");
	let changes = $state<number | null>(null);
	let problem = $state("");
	let busy = $state(false);

	const target = $derived({
		biblioIds,
		kind,
		genreCode,
		classCode,
		readingLevel,
	});
	// a check is valid only for the classification it was made for
	let checkedFor = $state("");
	const planned = $derived(checkedFor === JSON.stringify(target) ? changes : null);

	function close(): void {
		open = false;
		changes = null;
	}

	async function check(): Promise<void> {
		busy = true;
		try {
			const r = await planRecordReclassify(target);
			if (!r.ok) {
				problem = i18n.t(`catalog.batch.errors.${r.error}`);
				return;
			}
			changes = r.changes;
			checkedFor = JSON.stringify(target);
		} finally {
			busy = false;
		}
	}

	async function apply(): Promise<void> {
		busy = true;
		try {
			const r = await applyRecordReclassify(target);
			if (!r.ok) {
				problem = i18n.t(`catalog.batch.errors.${r.error}`);
				return;
			}
			toaster.success({
				title: i18n.t("catalog.batch.reclassify.done", {
					count: r.changed,
					calls: r.callNumbers,
				}),
			});
			onapplied?.();
			close();
		} finally {
			busy = false;
		}
	}
</script>

<Modal
	bind:open
	title={i18n.t("catalog.batch.reclassify.title")}
	note={i18n.t("catalog.batch.reclassify.scope", { count: biblioIds.length })}
	onclose={close}
	width="lg"
	data-testid="reclassify-dialog"
>
	{#if options?.current}
		{@const o = options.current}
		<Grid cols="2" from="sm" gap="3">
			<Field label={i18n.t("catalog.list.filters.kind")}>
				<Select bind:value={kind} data-testid="reclassify-kind">
					<option value="fiction">{i18n.t("catalog.kinds.fiction")}</option>
					<option value="nonfiction">{i18n.t("catalog.kinds.nonfiction")}</option>
				</Select>
			</Field>
			{#if kind === "fiction"}
				<Field label={i18n.t("catalog.list.filters.genre")}>
					<Select bind:value={genreCode} data-testid="reclassify-genre">
						<option value="">—</option>
						{#each o.genres as g (g.code)}
							<option value={g.code}>{g.code} · {g.label}</option>
						{/each}
					</Select>
				</Field>
				{#if o.fictionByClass && !o.classPerItem}
					<Field label={i18n.t("catalog.list.filters.readingLevel")}>
						<Select bind:value={readingLevel}>
							<option value="">{i18n.t("catalog.batch.noClass")}</option>
							{#each o.readingLevels as l (l.code)}
								<option value={l.code}>{l.label}</option>
							{/each}
						</Select>
					</Field>
				{/if}
			{:else}
				<Field label={i18n.t("catalog.list.filters.class")}>
					<Select bind:value={classCode} data-testid="reclassify-class">
						<option value="">—</option>
						{#each o.nonfiction as n (n.code)}
							<option value={n.code}>{n.code} · {n.label}</option>
							{#each n.children as c (c.code)}
								<option value={c.code}>{c.code} · {c.label}</option>
							{/each}
						{/each}
					</Select>
				</Field>
			{/if}
		</Grid>
		<Hint>{i18n.t("catalog.batch.reclassify.labelsHint")}</Hint>
	{/if}
	{#if problem}
		<Alert data-testid="reclassify-problem">{problem}</Alert>
	{/if}
	{#if planned !== null}
		<Hint tone="primary" data-testid="reclassify-plan"
			>{planned > 0
				? i18n.t("catalog.batch.reclassify.changes", { count: planned })
				: i18n.t("catalog.batch.plan.none")}</Hint
		>
	{/if}
	<Row justify="end" as="footer">
		<Button onclick={close} disabled={busy}>{i18n.t("common.actions.close")}</Button>
		{#if planned !== null && planned > 0}
			<Button
				variant="primary"
				icon={CheckIcon}
				onclick={apply}
				disabled={busy}
				data-testid="reclassify-apply"
				>{i18n.t("catalog.batch.reclassify.apply", { count: planned })}</Button
			>
		{:else}
			<Button variant="primary" onclick={check} disabled={busy} data-testid="reclassify-check"
				>{i18n.t("catalog.batch.check")}</Button
			>
		{/if}
	</Row>
</Modal>
