<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A class created or edited (Phase 12, Amministrazione → Classi). New classes: the years and the
     names ("A-D"), one class per year and name, or one pluriclasse hosting every year chosen, with
     the list of the classes that will be made. A teachers group: its name and, optionally, its
     stage. Editing: the name, the years (a pluriclasse), the notes. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { createClassGroups, updateClassGroup } from "#lib/remote/school.remote.js";
	import { expandGroupNames } from "#lib/shared/class-names.js";
	import { groupLabel } from "#lib/shared/school.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";

	interface Level {
		code: string;
		label: string;
		name: string;
		stage: string;
	}
	interface Group {
		id: number;
		kind: "students" | "teachers";
		name: string;
		levels: string[];
		stage: string | null;
		notes: string | null;
		patrons: number;
	}

	interface Props {
		open?: boolean;
		/** `students`/`teachers`: new classes or a new teachers group; `edit`: the group given. */
		mode: "students" | "teachers" | "edit";
		group: Group | null;
		levels: Level[];
		stages: { code: string; name: string }[];
		classLabel: string;
		teacherGroupName: string;
	}

	let {
		open = $bindable(false),
		mode,
		group,
		levels,
		stages,
		classLabel,
		teacherGroupName,
	}: Props = $props();
	const i18n = useI18n();
	const SaveIcon = icons.save;

	let names = $state("");
	let chosen = $state<string[]>([]);
	let mixed = $state(false);
	let stage = $state("");
	let notes = $state("");
	let pending = $state(false);
	let problem = $state<string | null>(null);

	$effect(() => {
		if (open) {
			names =
				mode === "edit" ? (group?.name ?? "") : mode === "teachers" ? teacherGroupName : "";
			chosen = [...(group?.levels ?? [])];
			mixed = false;
			stage = group?.stage ?? "";
			notes = group?.notes ?? "";
			problem = null;
		}
	});

	const kind = $derived(mode === "edit" ? (group?.kind ?? "students") : mode);
	const ordered = $derived(levels.filter((l) => chosen.includes(l.code)).map((l) => l.code));
	/** What the save makes: one entry per class. */
	const planned = $derived.by(() => {
		if (mode !== "students") {
			const name = names.trim();
			return name ? [{ name, levels: kind === "teachers" ? [] : ordered }] : [];
		}
		const list = expandGroupNames(names) ?? [];
		if (ordered.length === 0) {
			return [];
		}
		return mixed
			? list.map((name) => ({ name, levels: ordered }))
			: ordered.flatMap((code) => list.map((name) => ({ name, levels: [code] })));
	});
	const preview = $derived(
		planned.map((p) =>
			groupLabel({ levels, classLabel }, { kind, name: p.name, levels: p.levels }),
		),
	);
	const ready = $derived(
		planned.length > 0 && (kind === "teachers" || planned.every((p) => p.levels.length > 0)),
	);

	async function save(): Promise<void> {
		pending = true;
		problem = null;
		try {
			const result =
				mode === "edit" && group
					? await updateClassGroup({
							id: group.id,
							group: {
								kind,
								name: names,
								levels: kind === "teachers" ? [] : ordered,
								stage: kind === "teachers" ? stage || null : null,
								notes: notes.trim() || null,
							},
						})
					: await createClassGroups({
							groups: planned.map((p) => ({
								kind,
								name: p.name,
								levels: p.levels,
								stage: kind === "teachers" ? stage || null : null,
								notes: notes.trim() || null,
							})),
						});
			if (result.ok) {
				open = false;
				toaster.success({
					title: i18n.t(`admin.classes.dialog.saved.${mode}`, { count: planned.length }),
				});
			} else {
				problem = i18n.t(`admin.classes.errors.${result.code}`);
			}
		} finally {
			pending = false;
		}
	}
</script>

<Modal
	bind:open
	title={i18n.t(`admin.classes.dialog.title.${mode}`, {
		name: group ? groupLabel({ levels, classLabel }, group) : "",
	})}
	animated
	scroll
	width="lg"
	data-testid="class-dialog"
>
	<form
		class="space-y-3"
		onsubmit={(e) => {
			e.preventDefault();
			if (ready && !pending) {
				void save();
			}
		}}
	>
		{#if kind === "students"}
			<fieldset class="space-y-1">
				<legend class="label-text">{i18n.t("admin.classes.dialog.levels")}</legend>
				<Row gap="3">
					{#each levels as l (l.code)}
						<Checkbox
							checked={chosen.includes(l.code)}
							onchange={(e) =>
								(chosen = e.currentTarget.checked
									? [...chosen, l.code]
									: chosen.filter((x) => x !== l.code))}
							data-testid="class-level-{l.code}">{l.name}</Checkbox
						>
					{/each}
				</Row>
			</fieldset>
		{/if}
		<Field
			label={mode === "students"
				? i18n.t("admin.classes.dialog.names")
				: i18n.t("admin.classes.dialog.name")}
			hint={mode === "students" ? i18n.t("admin.classes.dialog.namesHint") : undefined}
		>
			<Input
				bind:value={names}
				maxlength={mode === "students" ? 200 : 40}
				autocomplete="off"
				data-testid="class-names"
			/>
		</Field>
		{#if mode === "students" && ordered.length > 1}
			<Checkbox bind:checked={mixed} data-testid="class-mixed"
				>{i18n.t("admin.classes.dialog.mixed")}</Checkbox
			>
		{/if}
		{#if kind === "teachers"}
			<Field label={i18n.t("admin.classes.dialog.stage")}>
				<Select bind:value={stage} data-testid="class-stage">
					<option value="">{i18n.t("admin.classes.dialog.anyStage")}</option>
					{#each stages as s (s.code)}<option value={s.code}>{s.name}</option>{/each}
				</Select>
			</Field>
		{/if}
		{#if mode !== "students"}
			<Field label={i18n.t("admin.classes.dialog.notes")}>
				<Input bind:value={notes} maxlength={500} data-testid="class-notes" />
			</Field>
		{/if}
		{#if mode === "students"}
			{#if preview.length > 0}
				<div class="space-y-1" data-testid="class-preview">
					<Hint
						>{i18n.t("admin.classes.dialog.preview", {
							count: preview.length,
						})}</Hint
					>
					<Row gap="1">
						{#each preview as label (label)}<Badge>{label}</Badge>{/each}
					</Row>
				</div>
			{:else}
				<Hint tone="faint">{i18n.t("admin.classes.dialog.previewEmpty")}</Hint>
			{/if}
		{/if}
		{#if problem}
			<Alert data-testid="class-problem">{problem}</Alert>
		{/if}
		<Row justify="end" as="footer">
			<Button onclick={() => (open = false)} disabled={pending}
				>{i18n.t("common.actions.cancel")}</Button
			>
			<Button
				variant="primary"
				type="submit"
				icon={SaveIcon}
				disabled={!ready || pending}
				data-testid="class-save">{i18n.t("common.actions.save")}</Button
			>
		</Row>
	</form>
</Modal>
