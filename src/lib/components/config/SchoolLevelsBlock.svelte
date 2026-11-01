<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Stages and years of the school on the "Scuola" settings page (Phase 12, Q94, 9.41): a preset
     as a starting point, the stages (each with its own way of writing the class, if it differs), the
     years in the order they are attended (code, the label in the class, the full name, the stage,
     the year after — one, leaving, or the choices of a path that splits —, the other names of the
     registers), moved, added and removed; a year in use is marked, and removing it asks where its
     pupils and classes go (12.9). Saved as one change. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { getSchoolStructure, saveSchoolStructure } from "#lib/remote/school.remote.js";
	import DraftActions from "#lib/components/config/DraftActions.svelte";
	import { DraftEditor } from "#lib/components/config/draft-editor.svelte.js";
	import {
		classLabel,
		structureProblems,
		type SchoolLevel,
		type SchoolStage,
	} from "#lib/shared/school.js";
	import Modal from "#lib/ui/Modal.svelte";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Table from "#lib/ui/Table.svelte";
	import { icons } from "#lib/ui/icons.js";
	import InUseList from "./InUseList.svelte";
	import Loading from "#lib/ui/Loading.svelte";

	interface Props {
		dirty?: boolean;
	}

	let { dirty = $bindable(false) }: Props = $props();
	const i18n = useI18n();
	const data = getSchoolStructure();
	const SaveIcon = icons.save;
	const AddIcon = icons.add;
	const RemoveIcon = icons.delete;
	const UpIcon = icons.moveUp;
	const DownIcon = icons.moveDown;
	const CODE = /^[A-Za-z0-9._-]{1,32}$/;
	const LEVEL_CODE = /^[A-Za-z0-9-]{1,8}$/;
	/**
	 * The "year after" select: the following one, leaving the school, a chosen year, or choices
	 * (9.41: the path splits; the choices are years or LEAVES, the first the default).
	 */
	const FOLLOWING = "__following";
	const LEAVES = "__leaves";
	const CHOICES = "__choices";

	interface StageRow {
		key: number;
		code: string;
		name: string;
		/** Empty: the school's template. */
		classLabel: string;
	}
	interface LevelRow {
		key: number;
		code: string;
		label: string;
		name: string;
		stage: string;
		next: string;
		choices: string[];
		/** The other names, separated by commas. */
		aliases: string;
	}

	let preset = $state("custom");
	let chosenPreset = $state("");
	let stages = $state<StageRow[]>([]);
	let levels = $state<LevelRow[]>([]);
	let nextKey = 0;
	/** Removed years still in use (from the server): where their pupils and classes go. */
	let movePlan = $state<
		{ code: string; name: string; pupils: number; classes: string[] }[] | null
	>(null);
	const moves = $state<Record<string, string>>({});

	const nextOf = (l: Pick<SchoolLevel, "next">): string =>
		Array.isArray(l.next)
			? CHOICES
			: l.next === undefined
				? FOLLOWING
				: l.next === null
					? LEAVES
					: l.next;
	const choiceKey = (c: string | null): string => c ?? LEAVES;
	const choiceValue = (c: string): string | null => (c === LEAVES ? null : c);

	function fill(source: { preset: string; stages: SchoolStage[]; levels: SchoolLevel[] }): void {
		preset = source.preset;
		stages = source.stages.map((s) => ({
			key: nextKey++,
			code: s.code,
			name: s.name,
			classLabel: s.classLabel ?? "",
		}));
		levels = source.levels.map((l) => ({
			key: nextKey++,
			code: l.code,
			label: l.label,
			name: l.name,
			stage: l.stage,
			next: nextOf(l),
			choices: Array.isArray(l.next) ? l.next.map(choiceKey) : [],
			aliases: (l.aliases ?? []).join(", "),
		}));
	}

	const draft = $derived({
		preset,
		stages: stages.map((s) => ({
			code: s.code.trim(),
			name: s.name.trim(),
			...(s.classLabel.trim() ? { classLabel: s.classLabel.trim() } : {}),
		})),
		levels: levels.map((l) => {
			const aliases = l.aliases
				.split(",")
				.map((a) => a.trim())
				.filter(Boolean);
			return {
				code: l.code.trim(),
				label: l.label.trim(),
				name: l.name.trim(),
				stage: l.stage,
				...(l.next === FOLLOWING
					? {}
					: {
							next:
								l.next === CHOICES
									? l.choices.map(choiceValue)
									: l.next === LEAVES
										? null
										: l.next,
						}),
				...(aliases.length > 0 ? { aliases } : {}),
			};
		}),
	});
	type Failure = Extract<Awaited<ReturnType<typeof saveSchoolStructure>>, { ok: false }>;
	const editor = new DraftEditor<typeof draft, Failure>(() => draft);
	const levelName = (code: string): string =>
		code === LEAVES
			? i18n.t("config.blocks.schoolLevels.nextLeaves")
			: (levels.find((x) => x.code === code)?.name ?? code);

	function load(): void {
		if (!data.current) {
			return;
		}
		fill(data.current);
		editor.mark();
		editor.failure = null;
	}
	editor.loadWhenReady(() => data.current !== undefined, load);
	$effect(() => {
		dirty = editor.dirty;
	});

	const used = $derived(new Set(data.current?.used ?? []));
	const codeProblem = $derived(
		draft.stages.some((s) => !CODE.test(s.code)) ||
			draft.levels.some((l) => !LEVEL_CODE.test(l.code)) ||
			new Set(draft.stages.map((s) => s.code)).size !== draft.stages.length ||
			new Set(draft.levels.map((l) => l.code)).size !== draft.levels.length,
	);
	const requiredProblem = $derived(
		draft.stages.some((s) => s.name === "") ||
			draft.levels.some((l) => l.label === "" || l.name === ""),
	);
	/** A stage's template must name the year (`{level}`). */
	const templateProblem = $derived(
		draft.stages.some((s) => s.classLabel !== undefined && !s.classLabel.includes("{level}")),
	);
	const structure = $derived(
		codeProblem || requiredProblem
			? []
			: structureProblems({
					...draft,
					classLabel: data.current?.classLabel ?? "{level} {group}",
				}),
	);
	const invalid = $derived(
		codeProblem ||
			requiredProblem ||
			templateProblem ||
			structure.length > 0 ||
			draft.levels.length === 0,
	);
	/** One class of every stage, as it will be written (`3 B`, `Q1`). */
	const example = $derived(
		draft.stages
			.map((st) => draft.levels.find((l) => l.stage === st.code)?.code ?? null)
			.filter((c): c is string => c !== null)
			.map((code) =>
				classLabel(
					{
						stages: draft.stages,
						levels: draft.levels,
						classLabel: data.current?.classLabel ?? "{level} {group}",
					},
					{ kind: "students", name: "B" },
					code,
				),
			)
			.join(", "),
	);

	function applyPreset(): void {
		const p = data.current?.presets.find((x) => x.id === chosenPreset);
		if (p) {
			fill({ preset: p.id, stages: p.stages, levels: p.levels });
		}
	}

	function move(index: number, by: -1 | 1): void {
		const list = [...levels];
		const [row] = list.splice(index, 1);
		if (row) {
			list.splice(index + by, 0, row);
			levels = list;
		}
	}

	function addLevel(): void {
		const stage = stages.at(-1)?.code ?? "";
		levels = [
			...levels,
			{
				key: nextKey++,
				code: "",
				label: "",
				name: "",
				stage,
				next: FOLLOWING,
				choices: [],
				aliases: "",
			},
		];
	}

	async function save(withMoves = false): Promise<void> {
		await editor.save(
			() =>
				saveSchoolStructure({
					...draft,
					// only the years of this plan: an earlier one may have left empty choices behind
					moves: withMoves
						? Object.fromEntries(
								(movePlan ?? []).map((r) => [r.code, moves[r.code] ?? ""]),
							)
						: {},
				}),
			(result) => ({
				title: i18n.t("config.blocks.schoolLevels.saved"),
				description:
					result.pupils + result.classes > 0
						? i18n.t("config.blocks.schoolLevels.move.done", {
								pupils: result.pupils,
								classes: result.classes,
							})
						: undefined,
			}),
			() => {
				movePlan = null;
			},
		);
		const plan = editor.failure?.plan;
		if (plan) {
			for (const r of plan.removed) {
				moves[r.code] ??= "";
			}
			movePlan = plan.removed;
		}
	}
	const movesReady = $derived(
		(movePlan ?? []).every((r) => draft.levels.some((l) => l.code === moves[r.code])),
	);
</script>

<Card variant="outlined" gap="4" id="school-levels" data-testid="block-schoolLevels">
	<h2 class="title-lg">{i18n.t("config.blocks.schoolLevels.title")}</h2>
	<Hint>{i18n.t("config.blocks.schoolLevels.hint")}</Hint>
	{#if data.current}
		<Row align="end" gap="2">
			<Field
				label={i18n.t("config.blocks.schoolLevels.preset")}
				hint={i18n.t("config.blocks.schoolLevels.presetHint")}
			>
				<Select bind:value={chosenPreset} data-testid="school-preset">
					<option value=""
						>{preset === "custom"
							? i18n.t("config.blocks.schoolLevels.custom")
							: (data.current.presets.find((p) => p.id === preset)?.name ??
								preset)}</option
					>
					{#each data.current.presets as p (p.id)}<option value={p.id}
							>{p.name} ({p.country})</option
						>{/each}
				</Select>
			</Field>
			<Button
				onclick={applyPreset}
				disabled={chosenPreset === ""}
				data-testid="school-preset-apply"
				>{i18n.t("config.blocks.schoolLevels.presetApply")}</Button
			>
		</Row>

		<section class="space-y-2">
			<h3 class="font-semibold">{i18n.t("config.blocks.schoolLevels.stages")}</h3>
			<div class="overflow-x-auto">
				<Table form>
					<thead>
						<tr>
							<th>{i18n.t("config.blocks.schoolLevels.stageCode")}</th>
							<th>{i18n.t("config.blocks.schoolLevels.stageName")}</th>
							<th>{i18n.t("config.blocks.schoolLevels.stageLabel")}</th>
							<th><span class="sr-only">{i18n.t("common.actions.delete")}</span></th>
						</tr>
					</thead>
					<tbody>
						{#each stages as s (s.key)}
							<tr data-testid="stage-{s.code}">
								<td class="w-40"
									><Input
										mono
										bind:value={s.code}
										maxlength={32}
										aria-label={i18n.t("config.blocks.schoolLevels.stageCode")}
									/></td
								>
								<td
									><Input
										bind:value={s.name}
										maxlength={120}
										aria-label={i18n.t("config.blocks.schoolLevels.stageName")}
									/></td
								>
								<td class="w-48"
									><Input
										mono
										bind:value={s.classLabel}
										maxlength={40}
										placeholder={data.current.classLabel}
										aria-label={i18n.t("config.blocks.schoolLevels.stageLabel")}
										data-testid="stage-label-{s.code}"
									/></td
								>
								<td class="w-12"
									><IconButton
										icon={RemoveIcon}
										label={i18n.t("common.actions.delete")}
										disabled={stages.length === 1 ||
											levels.some((l) => l.stage === s.code)}
										onclick={() =>
											(stages = stages.filter((x) => x.key !== s.key))}
									/></td
								>
							</tr>
						{/each}
					</tbody>
				</Table>
			</div>
			<Button
				size="sm"
				icon={AddIcon}
				onclick={() =>
					(stages = [...stages, { key: nextKey++, code: "", name: "", classLabel: "" }])}
				data-testid="stage-add">{i18n.t("config.blocks.schoolLevels.addStage")}</Button
			>
			<Hint tone="faint">{i18n.t("config.blocks.schoolLevels.stageLabelHint")}</Hint>
		</section>

		<section class="space-y-2">
			<h3 class="font-semibold">{i18n.t("config.blocks.schoolLevels.levels")}</h3>
			<div class="overflow-x-auto">
				<Table form>
					<thead>
						<tr>
							<th>{i18n.t("config.blocks.schoolLevels.levelCode")}</th>
							<th>{i18n.t("config.blocks.schoolLevels.levelLabel")}</th>
							<th>{i18n.t("config.blocks.schoolLevels.levelName")}</th>
							<th>{i18n.t("config.blocks.schoolLevels.levelStage")}</th>
							<th>{i18n.t("config.blocks.schoolLevels.levelNext")}</th>
							<th>{i18n.t("config.blocks.schoolLevels.levelAliases")}</th>
							<th><span class="sr-only">{i18n.t("common.actions.edit")}</span></th>
						</tr>
					</thead>
					<tbody>
						{#each levels as l, i (l.key)}
							<tr data-testid="level-{l.code}">
								<td class="w-28">
									<Input
										mono
										bind:value={l.code}
										maxlength={8}
										aria-label={i18n.t("config.blocks.schoolLevels.levelCode")}
									/>
									{#if used.has(l.code)}<Badge tone="primary" class="mt-1"
											>{i18n.t("config.blocks.schoolLevels.inUse")}</Badge
										>{/if}
								</td>
								<td class="w-28"
									><Input
										bind:value={l.label}
										maxlength={20}
										aria-label={i18n.t("config.blocks.schoolLevels.levelLabel")}
									/></td
								>
								<td
									><Input
										bind:value={l.name}
										maxlength={120}
										aria-label={i18n.t("config.blocks.schoolLevels.levelName")}
									/></td
								>
								<td
									><Select
										bind:value={l.stage}
										aria-label={i18n.t("config.blocks.schoolLevels.levelStage")}
									>
										{#each stages as s (s.key)}<option value={s.code}
												>{s.name || s.code}</option
											>{/each}
									</Select></td
								>
								<td class="min-w-48 space-y-1"
									><Select
										bind:value={l.next}
										aria-label={i18n.t("config.blocks.schoolLevels.levelNext")}
										data-testid="level-next-{l.code}"
									>
										<option value={FOLLOWING}
											>{i18n.t(
												"config.blocks.schoolLevels.nextFollowing",
											)}</option
										>
										<option value={LEAVES}
											>{i18n.t(
												"config.blocks.schoolLevels.nextLeaves",
											)}</option
										>
										<option value={CHOICES}
											>{i18n.t(
												"config.blocks.schoolLevels.nextChoices",
											)}</option
										>
										{#each levels.filter((x) => x.key !== l.key && x.code) as x (x.key)}<option
												value={x.code}>{x.name || x.code}</option
											>{/each}
									</Select>
									{#if l.next === CHOICES}
										<!-- the choices in order, the first the default (9.41) -->
										<Row gap="1" data-testid="level-choices-{l.code}">
											{#each l.choices as c, ci (c)}
												<Badge tone={ci === 0 ? "primary" : undefined}
													>{levelName(c)}{#if ci === 0}&nbsp;·
														{i18n.t(
															"config.blocks.schoolLevels.choiceDefault",
														)}{/if}<button
														type="button"
														class="ml-1 rounded-full px-1 hover:bg-surface-200"
														aria-label={i18n.t(
															"config.blocks.schoolLevels.choiceRemove",
															{ name: levelName(c) },
														)}
														onclick={() =>
															(l.choices = l.choices.filter(
																(x) => x !== c,
															))}>×</button
													></Badge
												>
											{/each}
										</Row>
										<Select
											value=""
											onchange={(e) => {
												const value = e.currentTarget.value;
												if (value && !l.choices.includes(value)) {
													l.choices = [...l.choices, value];
												}
												e.currentTarget.value = "";
											}}
											aria-label={i18n.t(
												"config.blocks.schoolLevels.choiceAdd",
											)}
											data-testid="level-choice-add-{l.code}"
										>
											<option value=""
												>{i18n.t(
													"config.blocks.schoolLevels.choiceAdd",
												)}</option
											>
											{#if !l.choices.includes(LEAVES)}<option value={LEAVES}
													>{i18n.t(
														"config.blocks.schoolLevels.nextLeaves",
													)}</option
												>{/if}
											{#each levels.filter((x) => x.key !== l.key && x.code && !l.choices.includes(x.code)) as x (x.key)}<option
													value={x.code}>{x.name || x.code}</option
												>{/each}
										</Select>
									{/if}</td
								>
								<td class="min-w-40"
									><Input
										bind:value={l.aliases}
										maxlength={200}
										placeholder={i18n.t(
											"config.blocks.schoolLevels.levelAliasesPlaceholder",
										)}
										aria-label={i18n.t(
											"config.blocks.schoolLevels.levelAliases",
										)}
										data-testid="level-aliases-{l.code}"
									/></td
								>
								<td class="w-36">
									<Row wrap={false} gap="1">
										<IconButton
											icon={UpIcon}
											label={i18n.t("config.blocks.schoolLevels.moveUp")}
											disabled={i === 0}
											onclick={() => move(i, -1)}
										/>
										<IconButton
											icon={DownIcon}
											label={i18n.t("config.blocks.schoolLevels.moveDown")}
											disabled={i === levels.length - 1}
											onclick={() => move(i, 1)}
										/>
										<IconButton
											icon={RemoveIcon}
											label={i18n.t("common.actions.delete")}
											disabled={levels.length === 1}
											onclick={() =>
												(levels = levels.filter((x) => x.key !== l.key))}
										/>
									</Row>
								</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			</div>
			<Button size="sm" icon={AddIcon} onclick={addLevel} data-testid="level-add"
				>{i18n.t("config.blocks.schoolLevels.addLevel")}</Button
			>
			{#if example}
				<Hint tone="faint" data-testid="school-example"
					>{i18n.t("config.blocks.schoolLevels.example", { label: example })}</Hint
				>
			{/if}
		</section>

		{#if codeProblem}<Alert data-testid="school-problem"
				>{i18n.t("config.blocks.schoolLevels.problems.code")}</Alert
			>{/if}
		{#if requiredProblem}<Alert data-testid="school-problem"
				>{i18n.t("config.blocks.schoolLevels.problems.required")}</Alert
			>{/if}
		{#if templateProblem}<Alert data-testid="school-problem"
				>{i18n.t("config.blocks.schoolLevels.problems.template")}</Alert
			>{/if}
		{#if structure.length > 0}<Alert data-testid="school-problem"
				>{i18n.t("config.blocks.schoolLevels.problems.structure", {
					details: structure.join("; "),
				})}</Alert
			>{/if}
		{#if editor.failure && editor.failure.issues.length > 0}<Alert as="div"
				>{#each editor.failure.issues as p (p)}<p>{p}</p>{/each}</Alert
			>{/if}
		{#if editor.failure && editor.failure.inUse.length > 0}<InUseList
				problems={editor.failure.inUse}
			/>{/if}
		<Row justify="end">
			<DraftActions
				{dirty}
				saving={editor.saving}
				{invalid}
				onsave={() => save()}
				onundo={load}
				testid="school-save"
			/>
		</Row>
		<Modal
			open={movePlan !== null}
			title={i18n.t("config.blocks.schoolLevels.move.title")}
			onclose={() => (movePlan = null)}
			animated
			scroll
			width="lg"
			data-testid="school-move-dialog"
		>
			{#if movePlan}
				<Hint>{i18n.t("config.blocks.schoolLevels.move.hint")}</Hint>
				{#each movePlan as r (r.code)}
					<Field
						label={i18n.t("config.blocks.schoolLevels.move.level", {
							name: r.name,
							pupils: r.pupils,
							classes: r.classes.length,
						})}
						hint={r.classes.join(", ")}
					>
						<Select bind:value={moves[r.code]} data-testid="school-move-{r.code}">
							<option value=""
								>{i18n.t("config.blocks.schoolLevels.move.choose")}</option
							>
							{#each draft.levels as l (l.code)}<option value={l.code}
									>{l.name || l.code}</option
								>{/each}
						</Select>
					</Field>
				{/each}
				<Row justify="end" as="footer">
					<Button onclick={() => (movePlan = null)} disabled={editor.saving}
						>{i18n.t("common.actions.cancel")}</Button
					>
					<Button
						variant="primary"
						icon={SaveIcon}
						onclick={() => save(true)}
						disabled={!movesReady || editor.saving}
						data-testid="school-move-confirm"
						>{i18n.t("config.blocks.schoolLevels.move.confirm")}</Button
					>
				</Row>
			{/if}
		</Modal>
	{:else}
		<Loading />
	{/if}
</Card>
