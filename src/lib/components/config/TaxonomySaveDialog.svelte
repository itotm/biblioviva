<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Salva" of the classification editor (step 11.1): first the server tells what the draft does
     to the catalogue — problems to fix, codes in use that disappear (each needs the code its books
     move to; renames come pre-filled), call numbers rewritten, spine bands to print again, the
     associated class moving between records and copies —, then the save writes the file and
     updates the catalogue together. -->
<script lang="ts">
	import { untrack } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { planTaxonomyChange, saveTaxonomyChange } from "#lib/remote/taxonomy.remote.js";
	import { LEVEL_KEY, type TaxonomyDraft } from "#lib/shared/taxonomy.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Disclosure from "#lib/ui/Disclosure.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { icons } from "#lib/ui/icons.js";
	import type { TaxonomyEditor } from "./taxonomy-editor.svelte.js";

	type Plan = Awaited<ReturnType<typeof planTaxonomyChange>>;
	type Issue = Plan["issues"][number];
	type Saved = Extract<Awaited<ReturnType<typeof saveTaxonomyChange>>, { ok: true }>;

	interface Props {
		open?: boolean;
		editor: TaxonomyEditor;
		onsaved: (result: Saved) => void | Promise<void>;
	}

	let { open = $bindable(false), editor, onsaved }: Props = $props();
	const i18n = useI18n();
	const SaveIcon = icons.save;

	let plan = $state<Plan | null>(null);
	let draft = $state<TaxonomyDraft | null>(null);
	let failed = $state(false);
	let saving = $state(false);
	let choices = $state<Record<string, string>>({});
	let reprint = $state(false);
	let serverIssues = $state<Issue[]>([]);

	async function load(): Promise<void> {
		plan = null;
		failed = false;
		serverIssues = [];
		reprint = false;
		draft = editor.draft;
		choices = { ...editor.renames };
		try {
			plan = await planTaxonomyChange({ draft, replacements: editor.renames });
		} catch {
			failed = true;
		}
	}

	$effect(() => {
		if (open) {
			untrack(() => void load());
		}
	});

	const errors = $derived([
		...(plan?.issues.filter((i) => i.level === "error") ?? []),
		...serverIssues,
	]);
	const warnings = $derived(plan?.issues.filter((i) => i.level === "warning") ?? []);
	const inUse = $derived(plan?.removed.filter((r) => r.records > 0) ?? []);
	const unused = $derived(plan?.removed.filter((r) => r.records === 0) ?? []);
	// reading levels (Phase 12.6): books may also move to no level at all
	const NO_LEVEL = "__none";
	const levelsInUse = $derived(plan?.removedLevels.filter((r) => r.records + r.copies > 0) ?? []);
	const restyledCopies = $derived(plan?.restyled.reduce((n, r) => n + r.copies, 0) ?? 0);
	const conflicts = $derived(plan?.classPerItem?.conflicts ?? 0);
	const canSave = $derived(
		plan !== null &&
			plan.changed &&
			errors.length === 0 &&
			inUse.every((r) => choices[r.code]) &&
			levelsInUse.every((r) => choices[`${LEVEL_KEY}${r.code}`]) &&
			conflicts === 0,
	);

	/** Codes the records of a removed code can move to: the draft's codes of the same kind. */
	function targets(kind: "fiction" | "nonfiction"): { code: string; label: string }[] {
		if (!draft) {
			return [];
		}
		return kind === "fiction"
			? draft.genres
			: draft.nonfiction.flatMap((n) => [n, ...n.children]);
	}

	/** `classification.genres.3.label` → "A · label: message", by the draft's nodes. */
	function describe(issue: Issue): string {
		const parts = issue.path.split(".");
		let node: { code: string } | undefined;
		if (parts[1] === "genres") {
			node = draft?.genres[Number(parts[2])];
		} else if (parts[1] === "nonfiction") {
			const top = draft?.nonfiction[Number(parts[2])];
			node = parts[3] === "children" ? top?.children[Number(parts[4])] : top;
		}
		return node ? `${node.code || "—"}: ${issue.message}` : issue.message;
	}

	async function save(): Promise<void> {
		if (!plan || !draft) {
			return;
		}
		saving = true;
		try {
			const removed = new Set([
				...plan.removed.map((r) => r.code),
				...plan.removedLevels.map((r) => `${LEVEL_KEY}${r.code}`),
			]);
			const replacements = Object.fromEntries(
				Object.entries(choices)
					.filter(([code, to]) => removed.has(code) && to)
					.map(([code, to]) => [code, to === NO_LEVEL ? "" : to]),
			);
			const result = await saveTaxonomyChange({
				draft,
				replacements,
				reprintRestyled: reprint,
			});
			if (result.ok) {
				open = false;
				await onsaved(result);
			} else {
				serverIssues = result.issues;
			}
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	bind:open
	title={i18n.t("config.taxonomy.save.title")}
	width="lg"
	animated
	scroll
	data-testid="taxonomy-save-dialog"
>
	{#if failed}
		<Alert>{i18n.t("common.status.error")}</Alert>
	{:else if !plan}
		<Hint>{i18n.t("config.taxonomy.save.checking")}</Hint>
	{:else if !plan.changed}
		<Hint data-testid="taxonomy-save-unchanged">{i18n.t("config.taxonomy.save.unchanged")}</Hint
		>
	{:else}
		{#if errors.length > 0}
			<Alert as="div" padded data-testid="taxonomy-save-errors">
				<p class="font-semibold">{i18n.t("config.taxonomy.save.errors")}</p>
				<BulletList>
					{#each errors as issue, i (i)}
						<li>{describe(issue)}</li>
					{/each}
				</BulletList>
			</Alert>
		{/if}
		{#if inUse.length > 0}
			<section class="space-y-3" data-testid="taxonomy-save-removed">
				<h3 class="font-semibold">
					{i18n.t("config.taxonomy.save.removedTitle")}
				</h3>
				<Hint>{i18n.t("config.taxonomy.save.removedHint")}</Hint>
				{#each inUse as r (r.code)}
					<Field
						label={i18n.t("config.taxonomy.save.moveTo", {
							code: r.code,
							label: r.label,
							records: r.records,
							copies: r.copies,
						})}
					>
						<Select bind:value={choices[r.code]} data-testid="replacement-{r.code}">
							<option value="">{i18n.t("config.taxonomy.save.choose")}</option>
							{#each targets(r.kind) as t (t.code)}
								<option value={t.code}>{t.code} · {t.label}</option>
							{/each}
						</Select>
					</Field>
				{/each}
				{#if plan.callNumbers > 0}
					<Hint tone="primary" data-testid="taxonomy-save-call-numbers"
						>{i18n.t("config.taxonomy.save.callNumbers", {
							count: plan.callNumbers,
						})}</Hint
					>
				{/if}
				<Hint tone="primary">{i18n.t("config.taxonomy.save.bandsMoved")}</Hint>
			</section>
		{/if}
		{#if levelsInUse.length > 0}
			<section class="space-y-3" data-testid="taxonomy-save-levels">
				<h3 class="font-semibold">
					{i18n.t("config.taxonomy.save.levelsTitle")}
				</h3>
				{#each levelsInUse as r (r.code)}
					<Field
						label={i18n.t("config.taxonomy.save.levelMoveTo", {
							code: r.code,
							label: r.label,
							records: r.records,
							copies: r.copies,
						})}
					>
						<Select
							bind:value={choices[`${LEVEL_KEY}${r.code}`]}
							data-testid="level-replacement-{r.code}"
						>
							<option value="">{i18n.t("config.taxonomy.save.choose")}</option>
							<option value={NO_LEVEL}
								>{i18n.t("config.taxonomy.save.noLevel")}</option
							>
							{#each draft?.readingLevels ?? [] as l (l.code)}
								<option value={l.code}>{l.code} · {l.label}</option>
							{/each}
						</Select>
					</Field>
				{/each}
				<Hint tone="primary">{i18n.t("config.taxonomy.save.levelsHint")}</Hint>
			</section>
		{/if}
		{#if unused.length > 0}
			<Hint data-testid="taxonomy-save-unused"
				>{i18n.t("config.taxonomy.save.unused", {
					codes: unused.map((r) => r.code).join(", "),
				})}</Hint
			>
		{/if}
		{#if plan.restyled.length > 0}
			<div class="space-y-1">
				<Checkbox bind:checked={reprint} data-testid="taxonomy-save-reprint"
					>{i18n.t("config.taxonomy.save.reprint", {
						copies: restyledCopies,
						codes: plan.restyled.map((r) => r.code).join(", "),
					})}</Checkbox
				>
				<Hint tone="faint">{i18n.t("config.taxonomy.save.reprintHint")}</Hint>
			</div>
		{/if}
		{#if plan.classPerItem}
			{#if conflicts > 0}
				<Alert data-testid="taxonomy-save-conflicts"
					>{i18n.t("config.taxonomy.save.conflicts", {
						count: conflicts,
					})}</Alert
				>
			{:else}
				<Hint tone="primary" data-testid="taxonomy-save-class-move"
					>{i18n.t(
						plan.classPerItem.to
							? "config.taxonomy.save.toCopies"
							: "config.taxonomy.save.toRecords",
						{ count: plan.classPerItem.records },
					)}</Hint
				>
			{/if}
		{/if}
		{#if warnings.length > 0}
			<Disclosure
				summary={i18n.t("config.taxonomy.save.warnings", {
					count: warnings.length,
				})}
			>
				<BulletList muted>
					{#each warnings as issue, i (i)}
						<li>{describe(issue)}</li>
					{/each}
				</BulletList>
			</Disclosure>
		{/if}
	{/if}
	<Row justify="end" as="footer">
		<Button onclick={() => (open = false)} disabled={saving}
			>{i18n.t("common.actions.cancel")}</Button
		>
		<Button
			variant="primary"
			icon={SaveIcon}
			onclick={save}
			disabled={!canSave || saving}
			data-testid="taxonomy-save-confirm">{i18n.t("common.actions.save")}</Button
		>
	</Row>
</Modal>
