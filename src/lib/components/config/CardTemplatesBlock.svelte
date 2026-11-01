<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Card template of each patron type and the cut lines, on the "Tessere" settings page (step
     11.6): students and teachers print with the default template unless another one is chosen;
     the red cut lines between the cards can be switched off or drawn in another colour and width.
     The sheet geometry (rows, margins, gaps, marks) is in the form above. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getCardTemplateSettings,
		saveCardTemplateSettings,
	} from "#lib/remote/print-config.remote.js";
	import DraftActions from "#lib/components/config/DraftActions.svelte";
	import { DraftEditor } from "#lib/components/config/draft-editor.svelte.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { icons } from "#lib/ui/icons.js";
	import Loading from "#lib/ui/Loading.svelte";

	const TYPES = ["student", "teacher"] as const;

	interface Props {
		dirty?: boolean;
	}

	let { dirty = $bindable(false) }: Props = $props();
	const i18n = useI18n();
	const data = getCardTemplateSettings();
	const PrintIcon = icons.print;

	let byType = $state<Record<(typeof TYPES)[number], string>>({ student: "", teacher: "" });
	let lines = $state(true);
	let color = $state("#c00000");
	let width = $state(0.2);

	const draft = $derived({
		byPatronType: Object.fromEntries(TYPES.flatMap((t) => (byType[t] ? [[t, byType[t]]] : []))),
		cutLines: lines ? { color, widthMm: width } : null,
	});
	type Failure = Extract<Awaited<ReturnType<typeof saveCardTemplateSettings>>, { ok: false }>;
	const editor = new DraftEditor<typeof draft, Failure>(() => draft);
	// a refusal with a code (a template folder) has no lines of its own
	const problem = $derived(editor.problem ?? editor.failure?.code ?? null);

	function load(): void {
		const current = data.current;
		if (!current) {
			return;
		}
		byType = {
			student: current.byPatronType.student ?? "",
			teacher: current.byPatronType.teacher ?? "",
		};
		lines = current.cutLines !== null;
		color = current.cutLines?.color ?? "#c00000";
		width = current.cutLines?.widthMm ?? 0.2;
		editor.mark();
	}
	editor.loadWhenReady(() => data.current !== undefined, load);
	$effect(() => {
		dirty = editor.dirty;
	});
	const badWidth = $derived(lines && !(width >= 0.05 && width <= 2));

	function save(): Promise<void> {
		return editor.save(
			() => saveCardTemplateSettings(draft),
			i18n.t("config.blocks.cardTemplates.saved"),
		);
	}
</script>

<Card variant="outlined" gap="3" id="card-templates" data-testid="block-cardTemplates">
	<h2 class="title-lg">{i18n.t("config.blocks.cardTemplates.title")}</h2>
	<Hint>{i18n.t("config.blocks.cardTemplates.hint")}</Hint>
	{#if data.current}
		{@const current = data.current}
		<Grid from="md" gap="4">
			{#each TYPES as t (t)}
				<Field label={i18n.t(`config.blocks.cardTemplates.${t}`)}>
					<Select bind:value={byType[t]} data-testid="card-template-{t}">
						<option value=""
							>{i18n.t("config.blocks.cardTemplates.asDefault", {
								name: current.defaultTemplate,
							})}</option
						>
						{#each current.templates as tpl (tpl.name)}
							<option value={tpl.name}
								>{tpl.description
									? `${tpl.name} — ${tpl.description}`
									: tpl.name}</option
							>
						{/each}
					</Select>
				</Field>
			{/each}
		</Grid>
		<fieldset class="space-y-2">
			<legend class="label-text">{i18n.t("config.blocks.cardTemplates.cutLines")}</legend>
			<Checkbox bind:checked={lines} data-testid="cut-lines"
				>{i18n.t("config.blocks.cardTemplates.cutLinesOn")}</Checkbox
			>
			{#if lines}
				<Row gap="4" align="end">
					<Field label={i18n.t("config.blocks.cardTemplates.color")}>
						<input
							type="color"
							class="input h-10 w-20 cursor-pointer p-1 hover:ring-2 hover:ring-primary-300"
							bind:value={color}
							data-testid="cut-lines-color"
						/>
					</Field>
					<Field
						label={i18n.t("config.blocks.cardTemplates.width")}
						errors={badWidth
							? [i18n.t("config.section.range", { min: 0.05, max: 2 })]
							: []}
					>
						<Input
							type="number"
							class="w-28"
							min="0.05"
							max="2"
							step="0.05"
							bind:value={width}
							data-testid="cut-lines-width"
						/>
					</Field>
					<svg
						width="120"
						height="40"
						viewBox="0 0 120 40"
						role="img"
						aria-label={i18n.t("config.blocks.cardTemplates.sample")}
						class="rounded-base border border-surface-200 bg-white"
					>
						<line
							x1="0"
							y1="20"
							x2="120"
							y2="20"
							stroke={color}
							stroke-width={Math.max(0.5, width * 3.78)}
						/>
					</svg>
				</Row>
			{/if}
		</fieldset>
		{#if problem}
			<Alert>{problem}</Alert>
		{/if}
		<Row justify="between">
			<!-- printing on both sides needs the offset of the backs measured once (9.27) -->
			<Button
				icon={PrintIcon}
				href="/admin/cards/calibration"
				data-testid="card-calibration-open">{i18n.t("admin.calibration.open")}</Button
			>
			<Row>
				<DraftActions
					{dirty}
					saving={editor.saving}
					invalid={badWidth}
					onsave={save}
					onundo={load}
					testid="card-templates-save"
				/>
			</Row>
		</Row>
	{:else}
		<Loading />
	{/if}
</Card>
