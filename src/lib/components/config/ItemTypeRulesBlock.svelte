<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Loan rules per item type on the "Prestiti" settings page (step 11.5): the matrix of item types
     and rule values; an empty cell keeps the rule of the patron (students or teachers, shown as a
     hint), a number overrides it for that type. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { getItemTypeRules, saveItemTypeRules } from "#lib/remote/circulation-config.remote.js";
	import DraftActions from "#lib/components/config/DraftActions.svelte";
	import { DraftEditor } from "#lib/components/config/draft-editor.svelte.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Table from "#lib/ui/Table.svelte";
	import Loading from "#lib/ui/Loading.svelte";

	const FIELDS = ["loanDays", "maxLoans", "maxRenewals", "renewalDays"] as const;
	type Field = (typeof FIELDS)[number];
	type Cells = Record<string, Partial<Record<Field, number | null>>>;

	interface Props {
		dirty?: boolean;
	}

	let { dirty = $bindable(false) }: Props = $props();
	const i18n = useI18n();
	const data = getItemTypeRules();

	let cells = $state<Cells>({});
	const editor = new DraftEditor(() => overrides(cells));

	function load(): void {
		const current = data.current;
		if (!current) {
			return;
		}
		const next: Cells = {};
		for (const t of current.itemTypes) {
			const o = (current.overrides[t.code] ?? {}) as Partial<Record<Field, number>>;
			next[t.code] = Object.fromEntries(FIELDS.map((f) => [f, o[f] ?? null]));
		}
		cells = next;
		editor.mark();
	}
	editor.loadWhenReady(() => data.current !== undefined, load);
	$effect(() => {
		dirty = editor.dirty;
	});

	/** The record the configuration stores: only item types with at least one value. */
	function overrides(from: Cells): Record<string, Partial<Record<Field, number>>> {
		const out: Record<string, Partial<Record<Field, number>>> = {};
		for (const [code, row] of Object.entries(from)) {
			const values = Object.fromEntries(
				FIELDS.filter((f) => typeof row[f] === "number").map((f) => [f, row[f]]),
			) as Partial<Record<Field, number>>;
			if (Object.keys(values).length > 0) {
				out[code] = values;
			}
		}
		return out;
	}
	const invalid = $derived(
		Object.values(cells).some((row) =>
			FIELDS.some((f) => {
				const v = row[f];
				return (
					v !== null &&
					v !== undefined &&
					(!Number.isInteger(v) || v < (f === "maxRenewals" ? 0 : 1))
				);
			}),
		),
	);

	const inherited = (f: Field): string =>
		data.current ? `${data.current.rules.student[f]} / ${data.current.rules.teacher[f]}` : "";

	function save(): Promise<void> {
		return editor.save(
			() => saveItemTypeRules({ overrides: overrides(cells) }),
			i18n.t("config.blocks.itemTypeRules.saved"),
		);
	}
</script>

<Card variant="outlined" gap="3" id="item-type-rules" data-testid="block-itemTypeRules">
	<h2 class="title-lg">{i18n.t("config.blocks.itemTypeRules.title")}</h2>
	<Hint>{i18n.t("config.blocks.itemTypeRules.hint")}</Hint>
	{#if data.current}
		<div class="overflow-x-auto">
			<Table form>
				<thead>
					<tr>
						<th>{i18n.t("config.blocks.itemTypes.title")}</th>
						{#each FIELDS as f (f)}
							<th>{i18n.t(`config.fields.circulation.rules.student.${f}.label`)}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each data.current.itemTypes as t (t.code)}
						<tr data-testid="rule-row" data-code={t.code}>
							<td>
								<span class="font-semibold">{t.label}</span>
								<Hint as="span" mono class="block">{t.code}</Hint>
							</td>
							{#each FIELDS as f (f)}
								<td>
									<input
										type="number"
										class="input w-24"
										min={f === "maxRenewals" ? 0 : 1}
										step="1"
										value={cells[t.code]?.[f] ?? ""}
										placeholder={inherited(f)}
										oninput={(e) => {
											const raw = e.currentTarget.value;
											const row = (cells[t.code] ??= {});
											row[f] = raw === "" ? null : Number(raw);
										}}
										aria-label="{t.label}: {i18n.t(
											`config.fields.circulation.rules.student.${f}.label`,
										)}"
										data-testid="rule-{f}"
									/>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</Table>
		</div>
		<Hint tone="faint">{i18n.t("config.blocks.itemTypeRules.inherit")}</Hint>
		{#if invalid}
			<Hint tone="error">{i18n.t("config.section.min", { min: 1 })}</Hint>
		{/if}
		{#if editor.problem}
			<Alert>{editor.problem}</Alert>
		{/if}
		<Row justify="end">
			<DraftActions
				{dirty}
				saving={editor.saving}
				onundo={load}
				onsave={save}
				{invalid}
				testid="rules-save"
			/>
		</Row>
	{:else}
		<Loading />
	{/if}
</Card>
