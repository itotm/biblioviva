<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Z39.50 targets on the "Z39.50 (SBN)" settings page (step 11.8): each catalogue with its address,
     database, record syntax and character set, "Prova connessione" running one real query with the
     values typed (nothing saved), catalogues added and removed; the one used by default is chosen
     in the form above. Saved as one change. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { ENTRY_ID } from "#lib/shared/input-schemas.js";
	import {
		getZ3950Targets,
		saveZ3950Targets,
		testZ3950Connection,
	} from "#lib/remote/integrations.remote.js";
	import DraftActions from "#lib/components/config/DraftActions.svelte";
	import { DraftEditor } from "#lib/components/config/draft-editor.svelte.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Fieldbox from "#lib/ui/Fieldbox.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { Z3950_HOST, Z3950_WORD } from "#lib/shared/z3950.js";
	import Loading from "#lib/ui/Loading.svelte";

	interface Target {
		id: string;
		name: string;
		host: string;
		port: number;
		database: string;
		syntax: "unimarc" | "marc21";
		charset: string;
		elements: string;
	}
	interface TargetRow {
		key: number;
		target: Target;
		test: { ok: boolean; text: string } | null;
		testing: boolean;
	}

	interface Props {
		/** `z3950.defaultTarget` as the form above holds it. */
		defaultTarget: string;
		dirty?: boolean;
	}

	let { defaultTarget, dirty = $bindable(false) }: Props = $props();
	const i18n = useI18n();
	const data = getZ3950Targets();
	const AddIcon = icons.add;
	const RemoveIcon = icons.delete;
	const TestIcon = icons.search;

	let rows = $state<TargetRow[]>([]);
	let nextKey = 0;
	const draft = $derived(rows.map((r) => r.target));
	const editor = new DraftEditor(() => draft);

	function load(): void {
		if (!data.current) {
			return;
		}
		rows = data.current.targets.map((t) => ({
			key: nextKey++,
			target: { ...t },
			test: null,
			testing: false,
		}));
		editor.mark();
	}
	editor.loadWhenReady(() => data.current !== undefined, load);
	$effect(() => {
		dirty = editor.dirty;
	});

	function problems(t: Target): string[] {
		const out: string[] = [];
		if (!ENTRY_ID.test(t.id) || rows.filter((r) => r.target.id === t.id).length > 1) {
			out.push(i18n.t("config.blocks.z3950Targets.problems.id"));
		}
		if (!t.name.trim() || !t.database.trim() || !t.charset.trim() || !t.elements.trim()) {
			out.push(i18n.t("config.blocks.z3950Targets.problems.required"));
		}
		if (!Z3950_HOST.test(t.host.trim())) {
			out.push(i18n.t("config.blocks.z3950Targets.problems.host"));
		}
		if (
			[t.database, t.charset, t.elements].some(
				(w) => w.trim() !== "" && !Z3950_WORD.test(w.trim()),
			)
		) {
			out.push(i18n.t("config.blocks.z3950Targets.problems.words"));
		}
		if (!Number.isInteger(t.port) || t.port < 1 || t.port > 65535) {
			out.push(i18n.t("config.blocks.z3950Targets.problems.port"));
		}
		return out;
	}
	const invalid = $derived(rows.some((r) => problems(r.target).length > 0));

	function add(): void {
		rows = [
			...rows,
			{
				key: nextKey++,
				target: {
					id: `catalogo-${rows.length + 1}`,
					name: "",
					host: "",
					port: 210,
					database: "",
					syntax: "unimarc",
					charset: "utf-8",
					elements: "F",
				},
				test: null,
				testing: false,
			},
		];
	}

	async function test(r: TargetRow): Promise<void> {
		r.testing = true;
		r.test = null;
		try {
			const result = await testZ3950Connection({ ...r.target, host: r.target.host.trim() });
			r.test = result.ok
				? {
						ok: true,
						text: i18n.t("config.blocks.z3950Targets.test.ok", {
							hits: result.hits,
							ms: result.elapsedMs,
						}),
					}
				: { ok: false, text: i18n.t(`config.blocks.z3950Targets.test.${result.code}`) };
		} finally {
			r.testing = false;
		}
	}

	function save(): Promise<void> {
		return editor.save(
			() => saveZ3950Targets({ targets: draft.map((t) => ({ ...t, host: t.host.trim() })) }),
			i18n.t("config.blocks.z3950Targets.saved"),
		);
	}
</script>

<Card variant="outlined" gap="3" id="z3950-targets" data-testid="block-z3950Targets">
	<h2 class="title-lg">{i18n.t("config.blocks.z3950Targets.title")}</h2>
	<Hint>{i18n.t("config.blocks.z3950Targets.hint")}</Hint>
	{#if data.current}
		{#each rows as r (r.key)}
			{@const t = r.target}
			{@const issues = problems(t)}
			<Fieldbox data-testid="target-{t.id}">
				<Grid from="sm" lg3 gap="3">
					<Field label={i18n.t("config.blocks.z3950Targets.id")}>
						<Input mono bind:value={t.id} maxlength={64} data-testid="target-id" />
					</Field>
					<Field label={i18n.t("config.blocks.z3950Targets.name")}>
						<Input bind:value={t.name} maxlength={120} data-testid="target-name" />
					</Field>
					<Field label={i18n.t("config.blocks.z3950Targets.host")}>
						<Input mono bind:value={t.host} maxlength={253} data-testid="target-host" />
					</Field>
					<Field label={i18n.t("config.blocks.z3950Targets.port")}>
						<Input
							type="number"
							min="1"
							max="65535"
							value={t.port}
							oninput={(e) => (t.port = Number(e.currentTarget.value))}
							data-testid="target-port"
						/>
					</Field>
					<Field label={i18n.t("config.blocks.z3950Targets.database")}>
						<Input
							mono
							bind:value={t.database}
							maxlength={120}
							data-testid="target-database"
						/>
					</Field>
					<Field label={i18n.t("config.blocks.z3950Targets.syntax")}>
						<Select bind:value={t.syntax}>
							<option value="unimarc">UNIMARC</option>
							<option value="marc21">MARC 21</option>
						</Select>
					</Field>
					<Field label={i18n.t("config.blocks.z3950Targets.charset")}>
						<Input mono bind:value={t.charset} maxlength={40} />
					</Field>
					<Field
						label={i18n.t("config.blocks.z3950Targets.elements")}
						hint={i18n.t("config.blocks.z3950Targets.elementsHint")}
					>
						<Input mono bind:value={t.elements} maxlength={20} />
					</Field>
				</Grid>
				{#if issues.length > 0}
					<Alert as="div"
						>{#each issues as p (p)}<p>{p}</p>{/each}</Alert
					>
				{/if}
				<Row align="center" gap="2">
					<Button
						icon={TestIcon}
						onclick={() => test(r)}
						disabled={r.testing || issues.length > 0}
						data-testid="target-test"
						>{r.testing
							? i18n.t("config.blocks.z3950Targets.test.running")
							: i18n.t("config.blocks.z3950Targets.test.button")}</Button
					>
					<Button
						icon={RemoveIcon}
						variant="error-outlined"
						disabled={rows.length === 1 || t.id === defaultTarget}
						onclick={() => (rows = rows.filter((x) => x.key !== r.key))}
						data-testid="target-remove">{i18n.t("common.actions.delete")}</Button
					>
					{#if t.id === defaultTarget}
						<Hint as="span" tone="faint"
							>{i18n.t("config.blocks.z3950Targets.isDefault")}</Hint
						>
					{/if}
				</Row>
				{#if r.test}
					<Alert tone={r.test.ok ? "success" : "error"} data-testid="target-test-result"
						>{r.test.text}</Alert
					>
				{/if}
			</Fieldbox>
		{/each}
		{#if editor.problem}<Alert>{editor.problem}</Alert>{/if}
		<Row justify="between" align="center">
			<Button icon={AddIcon} onclick={add} data-testid="target-add"
				>{i18n.t("config.blocks.z3950Targets.add")}</Button
			>
			<Row>
				<DraftActions
					{dirty}
					saving={editor.saving}
					onundo={load}
					onsave={save}
					{invalid}
					testid="targets-save"
				/>
			</Row>
		</Row>
	{:else}
		<Loading />
	{/if}
</Card>
