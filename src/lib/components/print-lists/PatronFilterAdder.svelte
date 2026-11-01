<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Adding patrons to a print list of cards by a quick filter (step 2.8): stage, year, class,
     patron type, card never printed, photo missing, import batch, created after a day. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { addPatronsByFilter, type getPrintListDetail } from "#lib/remote/print-lists.remote.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Button from "#lib/ui/Button.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";

	type Detail = Awaited<ReturnType<typeof getPrintListDetail>>;

	interface Props {
		listId: number;
		options: Detail["options"];
		batches: Detail["batches"];
		/** The school asks for photos: the "without photo" filter is offered. */
		photosRequired: boolean;
		busy: boolean;
		/** Runs a change of the list, marking the page busy meanwhile. */
		run: <R>(fn: () => Promise<R>) => Promise<R | undefined>;
	}

	const { listId, options: o, batches, photosRequired, busy, run }: Props = $props();
	const i18n = useI18n();
	let stage = $state("");
	let level = $state("");
	let group = $state("");
	let patronType = $state<"" | "student" | "teacher">("");
	let noCard = $state(false);
	let noPhoto = $state(false);
	let batch = $state("");
	let createdAfter = $state("");
	const active = $derived(
		stage !== "" ||
			level !== "" ||
			group !== "" ||
			patronType !== "" ||
			noCard ||
			noPhoto ||
			batch !== "" ||
			createdAfter !== "",
	);

	async function add(): Promise<void> {
		const r = await run(() =>
			addPatronsByFilter({
				listId,
				filter: {
					stage: stage || undefined,
					levelCode: level || undefined,
					groupId: group === "" ? undefined : Number(group),
					patronType: patronType || undefined,
					withoutPrintedCard: noCard || undefined,
					withoutPhoto: noPhoto || undefined,
					importBatchId: batch === "" ? undefined : Number(batch),
					createdAfter: createdAfter || undefined,
				},
			}),
		);
		if (!r) {
			return;
		}
		if (r.found === 0) {
			toaster.warning({ title: i18n.t("printing.list.quick.none") });
		} else {
			toaster.success({
				title: i18n.t("printing.list.quick.added", {
					added: r.added,
					skipped: r.skipped.length,
				}),
			});
		}
	}
</script>

{#if o.stages.length > 1}
	<Field label={i18n.t("printing.list.quick.stage")}
		><Select
			bind:value={stage}
			onchange={() => {
				level = "";
				group = "";
			}}
			data-testid="quick-stage"
		>
			<option value="">{i18n.t("printing.list.quick.any")}</option>
			{#each o.stages as st (st.code)}<option value={st.code}>{st.name}</option>{/each}
		</Select></Field
	>
{/if}
<Grid cols="2" from="sm" gap="2">
	<Field label={i18n.t("printing.list.quick.level")}
		><Select bind:value={level} onchange={() => (group = "")} data-testid="quick-level">
			<option value="">{i18n.t("printing.list.quick.any")}</option>
			{#each o.levels.filter((l) => stage === "" || l.stage === stage) as l (l.code)}<option
					value={l.code}>{l.label}</option
				>{/each}
		</Select></Field
	>
	<Field label={o.groupWord}
		><Select bind:value={group} data-testid="quick-class">
			<option value="">{i18n.t("printing.list.quick.any")}</option>
			{#each o.groups.filter((g) => (level === "" || g.levels.includes(level)) && (stage === "" || g.stage === stage || g.levels.some( (code) => o.levels.some((l) => l.code === code && l.stage === stage) ))) as g (g.id)}<option
					value={String(g.id)}
					>{level !== "" && g.levels.length === 1 ? g.name : g.label}</option
				>{/each}
		</Select></Field
	>
</Grid>
<Field label={i18n.t("printing.list.quick.type")}
	><Select bind:value={patronType} data-testid="quick-type">
		<option value="">{i18n.t("printing.list.quick.any")}</option>
		<option value="student">{i18n.t("patrons.types.student")}</option>
		<option value="teacher">{i18n.t("patrons.types.teacher")}</option>
	</Select></Field
>
<Row wrap={false} align="center" as="label" class="text-sm">
	<input type="checkbox" class="checkbox" bind:checked={noCard} data-testid="quick-no-card" />
	{i18n.t("printing.list.quick.withoutPrintedCard")}
</Row>
{#if photosRequired}
	<Row wrap={false} align="center" as="label" class="text-sm">
		<input type="checkbox" class="checkbox" bind:checked={noPhoto} />
		{i18n.t("printing.list.quick.withoutPhoto")}
	</Row>
{/if}
<Field label={i18n.t("printing.list.quick.importBatch")}
	><Select bind:value={batch} data-testid="quick-batch">
		<option value="">{i18n.t("printing.list.quick.anyBatch")}</option>
		{#each batches as b (b.id)}
			<option value={String(b.id)}>
				{i18n.t("printing.list.quick.batchLabel", {
					id: b.id,
					file: b.filename,
					created: b.created,
				})}
			</option>
		{/each}
	</Select></Field
>
<Field label={i18n.t("printing.list.quick.createdAfter")}
	><Input type="date" bind:value={createdAfter} /></Field
>
<Button variant="primary" onclick={add} disabled={busy || !active} data-testid="quick-add"
	>{i18n.t("printing.list.quick.add")}</Button
>
