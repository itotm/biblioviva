<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Item types on the "Biblioteca" settings page (step 11.4): one row per code with how many copies
     use it; a changed code is a rename and its copies follow it; a removed code in use asks where
     they go; saved as one change. (The school sections of before Phase 12 are classes now: groups
     of the database, managed in Amministrazione → Classi.) -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getLibraryCodes,
		planItemTypesChange,
		saveItemTypesChange,
	} from "#lib/remote/library-codes.remote.js";
	import DraftActions from "#lib/components/config/DraftActions.svelte";
	import { DraftEditor } from "#lib/components/config/draft-editor.svelte.js";
	import Alert from "#lib/ui/Alert.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Table from "#lib/ui/Table.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import CodeMoveDialog from "./CodeMoveDialog.svelte";
	import InUseList from "./InUseList.svelte";
	import { CodeListEditor } from "./code-list.svelte.js";
	import Loading from "#lib/ui/Loading.svelte";

	interface Props {
		kind: "itemTypes";
		/** Unsaved changes (for the leave guard). */
		dirty?: boolean;
		onsaved?: () => void | Promise<void>;
	}

	let { kind, dirty = $bindable(false), onsaved }: Props = $props();
	const i18n = useI18n();
	const codes = getLibraryCodes();
	const AddIcon = icons.add;
	const MoveIcon = icons.more;
	const RemoveIcon = icons.delete;
	const itemTypes = $derived(kind === "itemTypes");
	const unit = $derived(itemTypes ? "copies" : "students");
	// svelte-ignore state_referenced_locally
	const list = new CodeListEditor(
		kind === "itemTypes" ? /^[A-Za-z0-9._-]{1,32}$/ : /^[A-Z0-9]{1,8}$/,
		kind === "itemTypes",
	);
	let loaded = $state(false);
	let moveOpen = $state(false);
	let toMove = $state<{ code: string; label: string; count: number }[]>([]);

	/** The list as saved: from the server at first, then what this block saved. */
	let lastSaved: { code: string; label: string; flag: boolean }[] = [];

	const draft = $derived(
		list.draft.map((d) => ({ code: d.code, label: d.label, notForLoan: d.flag })),
	);
	type Failure = Extract<Awaited<ReturnType<typeof saveItemTypesChange>>, { ok: false }>;
	const editor = new DraftEditor<typeof draft, Failure>(() => draft);
	/** Why the last save did not happen: the errors, then the removed codes still without a place. */
	const problems = $derived.by((): string[] => {
		const failure = editor.failure;
		if (!failure) {
			return [];
		}
		const lines = [
			...failure.issues,
			...(failure.plan?.removed ?? [])
				.filter((r) => r.count > 0 && r.replacement === null)
				.map((r) =>
					i18n.t(`config.blocks.move.row.${unit}`, {
						code: r.code,
						label: r.label,
						count: r.count,
					}),
				),
		];
		return lines.length === 0 && failure.inUse.length === 0
			? [i18n.t("config.archive.failed")]
			: lines;
	});

	function load(): void {
		const data = codes.current;
		if (!data) {
			return;
		}
		lastSaved = itemTypes
			? data.itemTypes.map((t) => ({ code: t.code, label: t.label, flag: t.notForLoan }))
			: [];
		list.load(lastSaved);
		editor.mark();
		loaded = true;
	}

	/** Back to the list as saved (the counts come from the server when its refresh arrives). */
	function discard(): void {
		list.load(lastSaved);
		editor.mark();
	}
	$effect(() => {
		if (codes.current && !loaded) {
			load();
		}
	});
	$effect(() => {
		dirty = editor.dirty;
	});

	const usage = (code: string | null): number =>
		code === null ? 0 : (codes.current?.itemTypeUsage?.[code] ?? 0);

	async function plan(): Promise<Awaited<ReturnType<typeof planItemTypesChange>>> {
		return planItemTypesChange({ draft, replacements: list.renames });
	}

	async function save(): Promise<void> {
		editor.saving = true;
		editor.failure = null;
		try {
			const result = await plan();
			if (!result.changed) {
				// someone saved the same list meanwhile: nothing left to do
				toaster.info({ title: i18n.t("config.taxonomy.save.unchanged") });
				await codes.refresh();
				load();
				return;
			}
			const errors = result.issues.filter((i) => i.level === "error");
			if (errors.length > 0) {
				editor.fail({ ok: false, issues: errors, inUse: [], plan: null });
				return;
			}
			const inUse = result.removed.filter((r) => r.count > 0);
			if (inUse.some((r) => r.replacement === null)) {
				toMove = inUse;
				moveOpen = true;
				return;
			}
			await commit(list.renames);
		} finally {
			editor.saving = false;
		}
	}

	async function commit(replacements: Record<string, string>): Promise<void> {
		await editor.save(
			() => saveItemTypesChange({ draft, replacements }),
			(result) => ({
				title: i18n.t(`config.blocks.${kind}.saved`),
				description:
					result.moved > 0
						? i18n.t(`config.blocks.move.done.${unit}`, { count: result.moved })
						: undefined,
			}),
			async () => {
				moveOpen = false;
				// what was saved is the draft: the rows restart from it, never from a refresh that
				// could arrive late; the refresh only brings the new counts
				lastSaved = list.draft;
				list.load(lastSaved);
				editor.mark();
				void codes.refresh();
				await onsaved?.();
			},
		);
		// a refusal closes the dialog too: the block shows why
		moveOpen = false;
	}
</script>

<Card variant="outlined" gap="3" id={kind} data-testid="block-{kind}">
	<h2 class="title-lg">{i18n.t(`config.blocks.${kind}.title`)}</h2>
	<Hint>{i18n.t(`config.blocks.${kind}.hint`)}</Hint>
	{#if !codes.current}
		<Loading />
	{:else}
		<div class="overflow-x-auto">
			<Table form>
				<thead>
					<tr>
						<th>{i18n.t(`config.blocks.${kind}.code`)}</th>
						{#if itemTypes}
							<th>{i18n.t("config.blocks.itemTypes.label")}</th>
							<th>{i18n.t("config.blocks.itemTypes.notForLoan")}</th>
						{/if}
						<th>{i18n.t(`config.blocks.move.used.${unit}`)}</th>
						<th><span class="sr-only">{i18n.t("common.actions.edit")}</span></th>
					</tr>
				</thead>
				<tbody>
					{#each list.rows as row, i (row.key)}
						{@const rowProblems = list.problems[row.key] ?? []}
						<tr data-testid="code-row" data-code={row.code}>
							<td>
								<Input
									mono
									class="w-36"
									bind:value={row.code}
									maxlength={itemTypes ? 32 : 8}
									aria-label={i18n.t(`config.blocks.${kind}.code`)}
									aria-invalid={rowProblems.some((p) => p.startsWith("code"))
										? "true"
										: undefined}
									data-testid="code-input"
								/>
								{#each rowProblems as p (p)}
									<Hint tone="error" data-testid="code-problem"
										>{i18n.t(`config.blocks.problems.${p}.${kind}`)}</Hint
									>
								{/each}
							</td>
							{#if itemTypes}
								<td>
									<Input
										bind:value={row.label}
										maxlength={120}
										aria-label={i18n.t("config.blocks.itemTypes.label")}
										data-testid="label-input"
									/>
								</td>
								<td class="text-center">
									<input
										type="checkbox"
										class="mt-2 checkbox"
										bind:checked={row.flag}
										aria-label={i18n.t("config.blocks.itemTypes.notForLoan")}
									/>
								</td>
							{/if}
							<td class="whitespace-nowrap" data-testid="code-usage">
								<span class="mt-2 inline-block"
									>{i18n.t(`config.blocks.move.count.${unit}`, {
										count: usage(row.originalCode),
									})}</span
								>
							</td>
							<td>
								<Row wrap={false} gap="1">
									<IconButton
										icon={MoveIcon}
										label={i18n.t("config.taxonomy.moveUp")}
										size="sm"
										class="[&>svg]:rotate-180"
										disabled={i === 0}
										onclick={() => list.move(row.key, -1)}
									/>
									<IconButton
										icon={MoveIcon}
										label={i18n.t("config.taxonomy.moveDown")}
										size="sm"
										disabled={i === list.rows.length - 1}
										onclick={() => list.move(row.key, 1)}
									/>
									<IconButton
										icon={RemoveIcon}
										label={i18n.t("common.actions.delete")}
										variant="error"
										size="sm"
										disabled={list.rows.length === 1}
										onclick={() => list.remove(row.key)}
										data-testid="code-remove"
									/>
								</Row>
							</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		</div>
		{#if editor.failure && editor.failure.inUse.length > 0}
			<InUseList problems={editor.failure.inUse} />
		{/if}
		{#if problems.length > 0}
			<Alert as="div" data-testid="block-{kind}-errors">
				<BulletList>
					{#each problems as p, i (i)}
						<li>{p}</li>
					{/each}
				</BulletList>
			</Alert>
		{/if}
		<Row justify="between" align="center">
			<Button icon={AddIcon} onclick={() => list.add()} data-testid="block-{kind}-add"
				>{i18n.t(`config.blocks.${kind}.add`)}</Button
			>
			<Row>
				<DraftActions
					{dirty}
					saving={editor.saving}
					invalid={list.invalid}
					onsave={save}
					onundo={discard}
					testid="block-{kind}-save"
				/>
			</Row>
		</Row>
	{/if}
</Card>

<CodeMoveDialog
	bind:open={moveOpen}
	removed={toMove}
	targets={list.draft.map((d) => ({ code: d.code, label: d.label }))}
	initial={list.renames}
	{unit}
	pending={editor.saving}
	onconfirm={commit}
/>
