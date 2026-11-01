<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Avanza di classe" (step 7.1, Phase 12.5): a guided run started by the administrator — a
     fresh backup, the classes that move up with their exceptions (repeats, changes of class, the
     class of whoever needs one picked; where the path splits, the year each pupil takes, 9.41), the
     leavers of the last year (their data is erased; whoever still has books blocks the run), the
     summary with an extra confirmation when the last upgrade is recent, then the link to import
     the new first-year students. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import {
		getRolloverPreview,
		rolloverBackup,
		runRollover,
	} from "#lib/remote/rollover.remote.js";
	import { icons } from "#lib/ui/icons.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import DividedList from "#lib/ui/DividedList.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Link from "#lib/ui/Link.svelte";
	import OrderedList from "#lib/ui/OrderedList.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Steps from "#lib/ui/Steps.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	const i18n = useI18n();
	const fmt = useFormat();
	const preview = getRolloverPreview();
	const BackupIcon = icons.backup;
	const NextIcon = icons.confirm;
	const BackIcon = icons.back;
	const RunIcon = icons.teacher;

	interface Decision {
		repeat?: boolean;
		keep?: boolean;
		group?: number;
		next?: string | null;
	}
	type Student = NonNullable<typeof preview.current>["leavers"][number];
	let step = $state(0);
	let backup = $state<string | null>(null);
	let busy = $state(false);
	const decisions = $state<Record<number, Decision>>({});
	let confirmRecent = $state(false);
	let failure = $state<string | null>(null);
	let outcome = $state<{
		promoted: number;
		repeated: number;
		removed: number;
		groupChanges: number;
		advanced: number;
		archived: number;
	} | null>(null);

	const STEPS = ["backup", "classes", "leavers", "confirm", "done"] as const;
	const steps = $derived(
		STEPS.map((key) => ({ key, label: i18n.t(`admin.rollover.steps.${key}`) })),
	);

	const LEAVES = "__leaves";
	const set = (id: number, patch: Decision): void => {
		decisions[id] = { ...decisions[id], ...patch };
	};
	const students = $derived(preview.current?.groups.flatMap((g) => g.students) ?? []);
	const leavers = $derived(preview.current?.leavers ?? []);
	/** The pupil stays at their level: repeats, or a leaver kept in the school. */
	const stays = (s: Student): boolean =>
		(decisions[s.id]?.repeat ?? false) || (decisions[s.id]?.keep ?? false);
	/** The way on: the default, or the choice taken where the path splits (9.41). */
	function wayOf(s: Student): {
		level: string | null;
		defaultGroupId: number | null;
		needsGroup: boolean;
	} {
		const wanted = decisions[s.id]?.next;
		return (
			(wanted === undefined ? s.choices[0] : s.choices.find((c) => c.level === wanted)) ?? {
				level: s.nextLevel,
				defaultGroupId: s.defaultGroupId,
				needsGroup: s.needsGroup,
			}
		);
	}
	/** Leaves the school: a leaver not kept, or a pupil who took "leaves" where the path splits. */
	const leaves = (s: Student): boolean => !stays(s) && wayOf(s).level === null;
	const leaving = $derived([...students, ...leavers].filter(leaves));
	const blocked = $derived(leaving.filter((l) => l.openLoans > 0));
	/** The level after the upgrade. */
	const levelAfter = (s: Student): string =>
		stays(s) ? s.levelCode : (wayOf(s).level ?? s.levelCode);
	/** The class after the upgrade: the one picked, or the default (null: none, or still to pick). */
	function groupAfter(s: Student): number | null {
		const chosen = decisions[s.id]?.group;
		if (chosen !== undefined) {
			return chosen;
		}
		if (stays(s)) {
			return s.stayGroupId;
		}
		const way = wayOf(s);
		return way.needsGroup ? null : way.defaultGroupId;
	}
	/** Without a class and no "no class" choice: the run waits for a pick. */
	const unplaced = (s: Student): boolean =>
		!leaves(s) && groupAfter(s) === null && (stays(s) || wayOf(s).needsGroup);
	/** The name of a year of the next school year, or "leaves the school". */
	const levelName = (code: string | null): string =>
		code === null
			? i18n.t("admin.rollover.classes.leaves")
			: (preview.current?.levels.find((l) => l.code === code)?.name ?? code);
	const choices = (s: Student): { id: number; label: string }[] =>
		(preview.current?.targets ?? []).filter((t) => t.levels.includes(levelAfter(s)));
	const kept = $derived(leavers.filter((l) => decisions[l.id]?.keep));
	/** Leavers by default who take a year of a path that splits instead. */
	const continuing = $derived(leavers.filter((l) => !stays(l) && wayOf(l).level !== null));
	const waiting = $derived([...students, ...kept, ...continuing].filter(unplaced));
	const summary = $derived({
		promote: [...students, ...leavers].filter((s) => !stays(s) && !leaves(s)).length,
		repeat: students.filter((s) => decisions[s.id]?.repeat).length + kept.length,
		groupChanges: [...students, ...kept, ...continuing].filter((s) => {
			const g = groupAfter(s);
			return g !== null && g !== s.groupId;
		}).length,
		closing: (preview.current?.groups ?? []).filter((g) => g.fate === "archived").length,
		remove: leaving.length,
	});

	async function makeBackup(): Promise<void> {
		busy = true;
		try {
			backup = (await rolloverBackup()).name;
		} finally {
			busy = false;
		}
	}

	async function run(): Promise<void> {
		if (!backup) {
			return;
		}
		busy = true;
		failure = null;
		try {
			const r = await runRollover({
				decisions: Object.fromEntries(Object.entries(decisions)),
				backup,
				confirmRecent,
			});
			if (r.ok) {
				outcome = r;
				step = 4;
			} else {
				failure = i18n.t(`admin.rollover.errors.${r.code}`);
			}
		} finally {
			busy = false;
		}
	}
</script>

<!-- a choice of a pupil's row: its words, then the select -->
{#snippet labelled(text: string, control: Snippet)}
	<label class="inline-flex items-center gap-2 text-sm">{text}{@render control()}</label>
{/snippet}

{#snippet wayChoice(s: Student)}
	{#if s.choices.length > 0}
		{#snippet way()}
			<Select
				auto
				value={wayOf(s).level ?? LEAVES}
				onchange={(e) => {
					const value = e.currentTarget.value;
					set(s.id, { next: value === LEAVES ? null : value, group: undefined });
				}}
				data-testid="next-{s.id}"
			>
				{#each s.choices as c (c.level ?? LEAVES)}<option value={c.level ?? LEAVES}
						>{levelName(c.level)}</option
					>{/each}
			</Select>
		{/snippet}
		{@render labelled(i18n.t("admin.rollover.classes.nextYear"), way)}
	{/if}
{/snippet}

{#snippet groupChoice(s: Student)}
	{#snippet group()}
		<Select
			auto
			value={groupAfter(s) === null ? "" : String(groupAfter(s))}
			onchange={(e) => {
				const value = e.currentTarget.value;
				set(s.id, { group: value === "" ? undefined : Number(value) });
			}}
			data-testid="group-{s.id}"
		>
			{#if groupAfter(s) === null}<option value=""
					>{unplaced(s)
						? i18n.t("admin.rollover.classes.choose")
						: i18n.t("admin.rollover.classes.noGroup")}</option
				>{/if}
			{#each choices(s) as t (t.id)}<option value={String(t.id)}>{t.label}</option>{/each}
		</Select>
	{/snippet}
	{@render labelled(i18n.t("admin.rollover.classes.target"), group)}
{/snippet}

<Page>
	<PageHeader
		title={i18n.t("admin.rollover.title")}
		subtitle={i18n.t("admin.rollover.subtitle")}
		icon="teacher"
		backHref="/admin"
		backLabel={i18n.t("common.actions.back")}
	/>
	<Steps {steps} current={step} label={i18n.t("admin.rollover.title")} testid="rollover-steps" />

	<QueryState query={preview}>
		{#snippet children(p)}
			{#if step === 0}
				<Card gap="3" as="section">
					<p>{i18n.t("admin.rollover.backup.text")}</p>
					{#if backup}
						<Alert tone="success" padded data-testid="rollover-backup"
							>{i18n.t("admin.rollover.backup.created", { name: backup })}</Alert
						>
					{/if}
					<Row>
						<Button
							icon={BackupIcon}
							onclick={makeBackup}
							disabled={busy}
							data-testid="rollover-make-backup"
							>{i18n.t("admin.rollover.backup.create")}</Button
						>
						<Button
							variant="primary"
							icon={NextIcon}
							disabled={!backup}
							onclick={() => (step = 1)}
							data-testid="rollover-next">{i18n.t("admin.rollover.next")}</Button
						>
					</Row>
				</Card>
			{:else if step === 1}
				<Card gap="3" as="section">
					<p>{i18n.t("admin.rollover.classes.text")}</p>
					{#if p.groups.length === 0}
						<Hint>{i18n.t("admin.rollover.classes.none")}</Hint>
					{/if}
					{#each p.groups as g (g.id)}
						{@const exceptions = g.students.filter(
							(s) => decisions[s.id]?.repeat || groupAfter(s) !== s.defaultGroupId,
						).length}
						{@const lent = g.students.filter((s) => s.openLoans > 0).length}
						<details
							class="rounded-container border border-surface-200"
							open={g.students.some((s) => s.needsGroup || s.choices.length > 0)}
							data-testid="rollover-group-{g.label.replaceAll(' ', '')}"
						>
							<summary
								class="flex cursor-pointer flex-wrap items-center gap-2 p-3 hover:bg-surface-100"
							>
								<strong
									>{i18n.t("admin.rollover.classes.group", {
										from: g.label,
										to: g.nextLabel,
									})}</strong
								>
								{#if g.fate !== "advances"}<Badge
										tone={g.fate === "archived" ? "warning" : undefined}
										>{i18n.t(`admin.rollover.classes.fates.${g.fate}`)}</Badge
									>{/if}
								<Badge
									>{i18n.t("admin.rollover.classes.count", {
										count: g.students.length,
									})}</Badge
								>
								{#if exceptions > 0}<Badge tone="warning"
										>{i18n.t("admin.rollover.classes.exceptions", {
											count: exceptions,
										})}</Badge
									>{/if}
								{#if lent > 0}<Badge tone="primary"
										>{i18n.t("admin.rollover.classes.loans", {
											count: lent,
										})}</Badge
									>{/if}
							</summary>
							<DividedList class="px-3 pb-2">
								{#each g.students as s (s.id)}
									<Row
										as="li"
										align="center"
										justify="between"
										class="py-2"
										data-testid="rollover-student-{s.id}"
									>
										<span class="font-medium">{patronSortName(s)}</span>
										<Row gap="3" align="center">
											<Checkbox
												checked={decisions[s.id]?.repeat ?? false}
												onchange={(e) =>
													set(s.id, {
														repeat: e.currentTarget.checked,
														group: undefined,
													})}
												data-testid="repeat-{s.id}"
												>{i18n.t("admin.rollover.classes.repeat")}</Checkbox
											>
											{#if !decisions[s.id]?.repeat}{@render wayChoice(
													s,
												)}{/if}
											{#if !leaves(s)}{@render groupChoice(s)}{/if}
										</Row>
									</Row>
								{/each}
							</DividedList>
						</details>
					{/each}
					{#if waiting.length > 0}
						<Alert tone="warning" padded data-testid="rollover-unplaced"
							>{i18n.t("admin.rollover.classes.unplaced", {
								count: waiting.length,
							})}</Alert
						>
					{/if}
					<Row>
						<Button icon={BackIcon} onclick={() => (step = 0)}
							>{i18n.t("admin.rollover.back")}</Button
						>
						<Button
							variant="primary"
							icon={NextIcon}
							disabled={students.some(unplaced)}
							onclick={() => (step = 2)}
							data-testid="rollover-next">{i18n.t("admin.rollover.next")}</Button
						>
					</Row>
				</Card>
			{:else if step === 2}
				<Card gap="3" as="section">
					<p>{i18n.t("admin.rollover.leavers.text")}</p>
					{#if p.leavers.length === 0}
						<Hint>{i18n.t("admin.rollover.leavers.none")}</Hint>
					{:else}
						<DividedList>
							{#each p.leavers as s (s.id)}
								<Row
									as="li"
									align="center"
									justify="between"
									class="py-2"
									data-testid="rollover-leaver-{s.id}"
								>
									<span class="font-medium"
										>{patronSortName(s)} · {s.classLabel}</span
									>
									<Row gap="3" align="center">
										{#if s.openLoans > 0}
											<Badge tone="warning"
												>{i18n.t("admin.rollover.leavers.openLoans", {
													count: s.openLoans,
												})}</Badge
											>
										{/if}
										<Checkbox
											checked={!decisions[s.id]?.keep}
											onchange={(e) =>
												set(s.id, {
													keep: !e.currentTarget.checked,
													group: undefined,
												})}
											data-testid="leaves-{s.id}"
											>{i18n.t("admin.rollover.leavers.leaves")}</Checkbox
										>
										{#if !decisions[s.id]?.keep}{@render wayChoice(s)}{/if}
										{#if !leaves(s)}{@render groupChoice(s)}{/if}
									</Row>
								</Row>
							{/each}
						</DividedList>
					{/if}
					{#if blocked.length > 0}
						<Alert tone="warning" padded data-testid="rollover-blocked">
							{i18n.t("admin.rollover.leavers.blocked", { count: blocked.length })}
							<!-- by name: a pupil who took "leaves" at the classes step is not listed here -->
							<span data-testid="rollover-blocked-names"
								>{blocked.map((b) => patronSortName(b)).join(", ")}.</span
							>
							<Link class="ml-2 font-semibold" href="/circulation/checkin"
								>{i18n.t("admin.rollover.leavers.toCheckin")}</Link
							>
						</Alert>
					{/if}
					<Row>
						<Button icon={BackIcon} onclick={() => (step = 1)}
							>{i18n.t("admin.rollover.back")}</Button
						>
						<Button
							variant="primary"
							icon={NextIcon}
							disabled={blocked.length > 0 || [...kept, ...continuing].some(unplaced)}
							onclick={() => (step = 3)}
							data-testid="rollover-next">{i18n.t("admin.rollover.next")}</Button
						>
					</Row>
				</Card>
			{:else if step === 3}
				<Card gap="3" as="section" data-testid="rollover-summary">
					<OrderedList>
						<li>
							{i18n.t("admin.rollover.confirm.promote", { count: summary.promote })}
						</li>
						<li>
							{i18n.t("admin.rollover.confirm.repeat", { count: summary.repeat })}
						</li>
						<li>
							{i18n.t("admin.rollover.confirm.groupChanges", {
								count: summary.groupChanges,
							})}
						</li>
						{#if summary.closing > 0}
							<li>
								{i18n.t("admin.rollover.confirm.closing", {
									count: summary.closing,
								})}
							</li>
						{/if}
						<li class="font-semibold text-error-700">
							{i18n.t("admin.rollover.confirm.remove", { count: summary.remove })}
						</li>
					</OrderedList>
					{#if p.recentRun && p.lastRunAt}
						<Checkbox bind:checked={confirmRecent} data-testid="rollover-recent"
							>{i18n.t("admin.rollover.confirm.recent", {
								date: fmt.dateTime(p.lastRunAt),
							})}</Checkbox
						>
					{/if}
					{#if failure}
						<Alert tone="error" padded data-testid="rollover-error">{failure}</Alert>
					{/if}
					<Row>
						<Button icon={BackIcon} onclick={() => (step = 2)}
							>{i18n.t("admin.rollover.back")}</Button
						>
						<Button
							variant="error"
							icon={RunIcon}
							disabled={busy || (p.recentRun && !confirmRecent)}
							onclick={run}
							data-testid="rollover-run"
							>{i18n.t("admin.rollover.confirm.run")}</Button
						>
					</Row>
				</Card>
			{:else if outcome}
				<Card gap="3" as="section" data-testid="rollover-done">
					<h2 class="font-semibold">{i18n.t("admin.rollover.done.title")}</h2>
					<OrderedList>
						<li>
							{i18n.t("admin.rollover.confirm.promote", { count: outcome.promoted })}
						</li>
						<li>
							{i18n.t("admin.rollover.confirm.repeat", { count: outcome.repeated })}
						</li>
						<li>
							{i18n.t("admin.rollover.confirm.groupChanges", {
								count: outcome.groupChanges,
							})}
						</li>
						<li>
							{i18n.t("admin.rollover.done.advanced", { count: outcome.advanced })}
						</li>
						<li>
							{i18n.t("admin.rollover.done.archived", { count: outcome.archived })}
						</li>
						<li>
							{i18n.t("admin.rollover.confirm.remove", { count: outcome.removed })}
						</li>
					</OrderedList>
					<p>{i18n.t("admin.rollover.done.text")}</p>
					<Row>
						<Button
							variant="primary"
							href="/admin/imports/students"
							data-testid="rollover-import"
							>{i18n.t("admin.rollover.done.import")}</Button
						>
					</Row>
				</Card>
			{/if}
		{/snippet}
	</QueryState>
</Page>
