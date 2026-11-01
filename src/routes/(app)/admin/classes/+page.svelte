<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Amministrazione → Classi (Phase 12, Q94, Q99, Q100, Q102): the classes of the school by stage,
     each with its years and how many patrons it has, then the teachers groups. New classes are
     made many at once ("1-5", "A-D") or as a pluriclasse; a class is renamed, re-levelled or
     archived once empty, and an archived one comes back. Admin only; whoever manages patrons
     just picks a class. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import ClassGroupDialog from "#lib/components/school/ClassGroupDialog.svelte";
	import {
		archiveClassGroup,
		getClassGroups,
		restoreClassGroup,
	} from "#lib/remote/school.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Disclosure from "#lib/ui/Disclosure.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Link from "#lib/ui/Link.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Table from "#lib/ui/Table.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import QueryState from "#lib/ui/QueryState.svelte";

	const i18n = useI18n();
	const data = getClassGroups();
	const AddIcon = icons.add;
	const TeacherIcon = icons.teacher;
	const EditIcon = icons.edit;
	const ArchiveIcon = icons.withdrawn;
	const RestoreIcon = icons.undo;

	type Group = NonNullable<typeof data.current>["groups"][number];
	let dialogOpen = $state(false);
	let mode = $state<"students" | "teachers" | "edit">("students");
	let editing = $state<Group | null>(null);
	let problem = $state<string | null>(null);

	const active = $derived((data.current?.groups ?? []).filter((g) => !g.archived));
	const archived = $derived((data.current?.groups ?? []).filter((g) => g.archived));
	/** Students classes by stage (a pluriclasse under the stage of its first year), then teachers. */
	const byStage = $derived(
		(data.current?.stages ?? [])
			.map((s) => ({
				stage: s,
				groups: active.filter(
					(g) =>
						g.kind === "students" &&
						data.current?.levels.find((l) => l.code === g.levels[0])?.stage === s.code,
				),
			}))
			.filter((s) => s.groups.length > 0),
	);
	const teachers = $derived(active.filter((g) => g.kind === "teachers"));
	const levelNames = (g: Group): string =>
		g.levels
			.map((code) => data.current?.levels.find((l) => l.code === code)?.name ?? code)
			.join(", ");

	function open(next: typeof mode, group: Group | null = null): void {
		mode = next;
		editing = group;
		dialogOpen = true;
	}

	async function archive(g: Group): Promise<void> {
		problem = null;
		const result = await archiveClassGroup(g.id);
		if (result.ok) {
			toaster.success({ title: i18n.t("admin.classes.archived", { name: g.label }) });
		} else {
			problem = i18n.t(`admin.classes.errors.${result.code}`);
		}
	}

	async function restore(g: Group): Promise<void> {
		problem = null;
		const result = await restoreClassGroup(g.id);
		if (result.ok) {
			toaster.success({ title: i18n.t("admin.classes.restored", { name: g.label }) });
		} else {
			problem = i18n.t(`admin.classes.errors.${result.code}`);
		}
	}
</script>

{#snippet table(groups: Group[], testid: string)}
	<div class="overflow-x-auto">
		<Table data-testid={testid}>
			<thead>
				<tr>
					<th>{i18n.t("admin.classes.columns.class")}</th>
					<th>{i18n.t("admin.classes.columns.levels")}</th>
					<th>{i18n.t("admin.classes.columns.patrons")}</th>
					<th><span class="sr-only">{i18n.t("common.actions.edit")}</span></th>
				</tr>
			</thead>
			<tbody>
				{#each groups as g (g.id)}
					<tr data-testid="class-row-{g.id}">
						<td class="font-semibold">
							{g.label}
							{#if g.levels.length > 1}<Badge tone="secondary" class="ml-1"
									>{i18n.t("admin.classes.mixed")}</Badge
								>{/if}
							{#if g.notes}<Hint as="span" class="block">{g.notes}</Hint>{/if}
						</td>
						<td>{g.kind === "teachers" ? "—" : levelNames(g)}</td>
						<td>{g.patrons}</td>
						<td class="w-28">
							<Row wrap={false} gap="1" justify="end">
								{#if g.archived}
									<IconButton
										icon={RestoreIcon}
										label={i18n.t("admin.classes.restore")}
										onclick={() => restore(g)}
										data-testid="class-restore-{g.id}"
									/>
								{:else}
									<IconButton
										icon={EditIcon}
										label={i18n.t("common.actions.edit")}
										onclick={() => open("edit", g)}
										data-testid="class-edit-{g.id}"
									/>
									<IconButton
										icon={ArchiveIcon}
										label={g.patrons > 0
											? i18n.t("admin.classes.archiveNotEmpty")
											: i18n.t("admin.classes.archive")}
										disabled={g.patrons > 0}
										onclick={() => archive(g)}
										data-testid="class-archive-{g.id}"
									/>
								{/if}
							</Row>
						</td>
					</tr>
				{/each}
			</tbody>
		</Table>
	</div>
{/snippet}

<Page width="xl">
	<PageHeader
		title={i18n.t("admin.classes.title")}
		subtitle={i18n.t("admin.classes.subtitle")}
		icon="classes"
		backHref="/admin/config"
		backLabel={i18n.t("admin.home.sections.config.title")}
	>
		{#snippet actions()}
			<Button
				icon={TeacherIcon}
				onclick={() => open("teachers")}
				data-testid="classes-new-teachers">{i18n.t("admin.classes.newTeachers")}</Button
			>
			<Button
				variant="primary"
				icon={AddIcon}
				onclick={() => open("students")}
				data-testid="classes-new">{i18n.t("admin.classes.new")}</Button
			>
		{/snippet}
	</PageHeader>

	<QueryState query={data}>
		{#snippet children(d)}
			<Row gap="2" align="center">
				<Hint as="span">{i18n.t("admin.classes.hint")}</Hint>
				<Link href="/admin/config/school">{i18n.t("admin.classes.structureLink")}</Link>
			</Row>
			{#if problem}<Alert data-testid="classes-problem">{problem}</Alert>{/if}
			{#if active.length === 0}
				<EmptyState
					title={i18n.t("admin.classes.empty")}
					description={i18n.t("admin.classes.emptyHint")}
					icon="classes"
				/>
			{/if}
			{#each byStage as s (s.stage.code)}
				<Card gap="3" as="section" data-testid="classes-stage-{s.stage.code}">
					<h2 class="title-lg">{s.stage.name}</h2>
					{@render table(s.groups, `classes-table-${s.stage.code}`)}
				</Card>
			{/each}
			{#if teachers.length > 0}
				<Card gap="3" as="section" data-testid="classes-teachers">
					<h2 class="title-lg">{i18n.t("admin.classes.teachers")}</h2>
					{@render table(teachers, "classes-table-teachers")}
				</Card>
			{/if}
			{#if archived.length > 0}
				<Disclosure
					summary={i18n.t("admin.classes.archivedTitle", { count: archived.length })}
				>
					{@render table(archived, "classes-table-archived")}
				</Disclosure>
			{/if}
			<ClassGroupDialog
				bind:open={dialogOpen}
				{mode}
				group={editing}
				levels={d.levels}
				stages={d.stages}
				classLabel={d.classLabel}
				teacherGroupName={d.teacherGroupName}
			/>
		{/snippet}
	</QueryState>
</Page>
