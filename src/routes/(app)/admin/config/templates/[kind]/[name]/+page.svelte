<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The template editor (steps 11.10, 11.16): "Disegno" places fields, texts, the barcode, the photo
     or the pictogram, images and free HTML on the real card or label with the mouse, the keyboard
     or the numbers of the side panel; "Codice" edits the HTML, CSS and template.json of the folder
     (slips have only this). Both edit the same draft of the files: switching writes the drawing
     into the files or reads the files into the drawing, so a change made in one is what the other
     shows. The preview is the draft rendered as printing renders it; "Salva" writes the folder,
     only when the draft prints. -->
<script lang="ts">
	import ChoiceButtons from "#lib/ui/ChoiceButtons.svelte";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import TemplateDesignerCanvas from "#lib/components/config/TemplateDesignerCanvas.svelte";
	import TemplateDesignerPanel from "#lib/components/config/TemplateDesignerPanel.svelte";
	import { LeaveGuard } from "#lib/components/config/leave-guard.svelte.js";
	import {
		GRID_STEPS,
		TemplateDesigner,
		type FaceSize,
		type GridStep,
	} from "#lib/components/config/template-designer.svelte.js";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getTemplateSource,
		previewTemplateDraft,
		saveTemplateDraft,
	} from "#lib/remote/template-editor.remote.js";
	import type { DesignElement } from "#lib/shared/template-design.js";
	import { readCardSize, writeCardSize, type CardSize } from "#lib/shared/card-size.js";
	import Alert from "#lib/ui/Alert.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import InlineField from "#lib/ui/InlineField.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import PreviewFrame from "#lib/ui/PreviewFrame.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import SegmentedGroup from "#lib/ui/SegmentedGroup.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Loading from "#lib/ui/Loading.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	const { data } = $props();
	const i18n = useI18n();
	// svelte-ignore state_referenced_locally
	const source = getTemplateSource({ kind: data.kind, name: data.name });
	const SaveIcon = icons.save;
	const UndoIcon = icons.undo;
	const DesignIcon = icons.edit;
	const PX_PER_MM = 96 / 25.4;

	type Preview = Awaited<ReturnType<typeof previewTemplateDraft>>;
	// svelte-ignore state_referenced_locally
	const designable = data.kind !== "slips";
	let mode = $state<"design" | "code">("code");
	let designer = $state<TemplateDesigner | null>(null);
	/** The draft: the files as the code editor shows them (the drawing is written into them on switching). */
	let files = $state<Record<string, string>>({});
	let savedFiles = $state("");
	let file = $state("");
	let zoom = $state<1 | 2 | 3>(2);
	let preview = $state<Preview | null>(null);
	let saving = $state(false);
	let problems = $state<string[]>([]);

	function load(): void {
		const s = source.current;
		if (!s) {
			return;
		}
		files = { ...s.files };
		savedFiles = JSON.stringify(s.files);
		// the first face (front, top, label, slip) rather than the alphabetical first
		file =
			[s.faces[0]?.file, "slip.html"].find((f) => f !== undefined && f in s.files) ??
			Object.keys(s.files).find((f) => f.endsWith(".html")) ??
			"";
		if (designable && s.faces.length > 0) {
			const d = new TemplateDesigner(s.kind === "cards" ? "cards" : "labels", s.faces);
			d.grid = savedGrid();
			d.load(files);
			designer = d;
			mode = "design";
		} else {
			designer = null;
			mode = "code";
		}
	}
	let loaded = false;
	$effect(() => {
		if (source.current && !loaded) {
			loaded = true;
			load();
		}
	});

	// the grid is a convenience of this browser, kept between visits
	const GRID_KEY = "biblioviva.designer-grid";
	function savedGrid(): GridStep {
		try {
			const v = Number(localStorage.getItem(GRID_KEY) ?? "2");
			return GRID_STEPS.find((g) => g === v) ?? 2;
		} catch {
			return 2;
		}
	}
	function chooseGrid(d: TemplateDesigner, value: number): void {
		d.grid = GRID_STEPS.find((g) => g === value) ?? 2;
		try {
			localStorage.setItem(GRID_KEY, String(d.grid));
		} catch {
			// private window: the choice lasts for this page
		}
	}

	/** Switching writes the drawing into the files, or reads the files into the drawing. */
	function switchTo(next: "design" | "code"): void {
		if (next === mode || !designer) {
			return;
		}
		if (next === "code") {
			files = designer.write($state.snapshot(files));
		} else {
			// a size changed in the code is drawn on faces of that size
			const size = readCardSize(files["template.json"] ?? "");
			const real = size ?? source.current?.cardDefault;
			if (
				designer.kind === "cards" &&
				real &&
				(real.width !== designer.size.widthMm || real.height !== designer.size.heightMm)
			) {
				mode = next;
				setCardSize(size, true);
				return;
			}
			designer.load($state.snapshot(files));
		}
		mode = next;
	}

	/**
	 * A new size for the card (step 11.17), or the configuration's with null: written in the
	 * draft's `template.json`, the drawing made again on faces of the new size.
	 */
	function setCardSize(size: CardSize | null, fromCode = false): void {
		const d = designer;
		const s = source.current;
		if (!d || !s) {
			return;
		}
		// from the code editor the files are the draft; from the drawing, the drawing written out
		const drawn = fromCode ? $state.snapshot(files) : d.write($state.snapshot(files));
		drawn["template.json"] = writeCardSize(drawn["template.json"] ?? "{}", size);
		files = drawn;
		const real = size ?? s.cardDefault ?? { width: d.size.widthMm, height: d.size.heightMm };
		const next = new TemplateDesigner(
			"cards",
			s.faces.map((f) => ({ ...f, widthMm: real.width, heightMm: real.height })),
		);
		next.grid = d.grid;
		next.face = d.face;
		next.load(files);
		designer = next;
	}

	/** The files as they are now, from the drawing or from the code editor. */
	const current = $derived(
		mode === "design" && designer ? designer.write($state.snapshot(files)) : files,
	);
	const dirty = $derived(savedFiles !== "" && JSON.stringify(current) !== savedFiles);
	const guard = new LeaveGuard(() => dirty);

	// the preview follows the draft, a moment after the last change; in the drawing every element
	// carries a mark, so the canvas can measure where it is drawn
	const request = $derived(
		!source.current
			? null
			: mode === "design" && designer
				? { files: designer.write($state.snapshot(files), true), zoom }
				: { files: $state.snapshot(files), zoom: 1 as const },
	);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let asked = 0;
	$effect(() => {
		const r = request;
		clearTimeout(timer);
		if (!r) {
			preview = null;
			return;
		}
		const ticket = ++asked;
		timer = setTimeout(() => {
			void previewTemplateDraft({ kind: data.kind, name: data.name, ...r }).then((p) => {
				if (ticket === asked) {
					preview = p;
				}
			});
		}, 350);
	});

	const faceDoc = $derived.by(() => {
		const p = preview?.ok ? preview.preview : null;
		const face = designer?.size;
		if (!p || !face) {
			return { html: "", heightMm: 0 };
		}
		if (p.kind === "cards") {
			return { html: face.doc === "back" ? p.back : p.front, heightMm: p.heightMm };
		}
		const doc = p.kind === "labels" ? p.docs.find((d) => d.stock === face.doc) : undefined;
		return { html: doc?.html ?? "", heightMm: doc?.heightMm ?? 0 };
	});

	/** A face's name on its button: front and back of a card in words, a label by its file. */
	function faceName(f: FaceSize): string {
		const name =
			designer?.kind === "cards" && (f.doc === "front" || f.doc === "back")
				? i18n.t(`config.designer.${f.doc}`)
				: f.file.replace(".html", "");
		return f.variant ? `${name} · ${f.variant}` : name;
	}

	function describe(e: DesignElement): string {
		const type = i18n.t(`config.designer.types.${e.type}`);
		return e.type === "field"
			? `${type}: ${i18n.t(`config.designer.fields.${(e.field ?? "").replace(".", "_")}`)}`
			: e.type === "text"
				? `${type}: ${e.text ?? ""}`
				: type;
	}

	async function save(): Promise<void> {
		saving = true;
		problems = [];
		try {
			const result = await saveTemplateDraft({
				kind: data.kind,
				name: data.name,
				files: $state.snapshot(current),
			});
			if (result.ok) {
				toaster.success({ title: i18n.t("config.designer.saved") });
				await source.refresh();
				const s = source.current;
				if (s) {
					files = { ...s.files };
					savedFiles = JSON.stringify(s.files);
					designer?.load(files);
				}
			} else {
				problems = result.problems;
			}
		} finally {
			saving = false;
		}
	}

	function discard(): void {
		const face = designer?.face ?? 0;
		loaded = false;
		load();
		loaded = true;
		if (designer) {
			designer.face = Math.min(face, designer.faces.length - 1);
		}
	}
</script>

<Page width="2xl">
	<PageHeader
		title={i18n.t("config.designer.title", { name: data.name })}
		docTitle="{data.name} · {i18n.t('config.templates.title')}"
		icon="print"
		backHref="/admin/config/templates"
		backLabel={i18n.t("config.templates.title")}
	>
		{#snippet actions()}
			<Button icon={UndoIcon} onclick={discard} disabled={!dirty || saving}
				>{i18n.t("config.section.discard")}</Button
			>
			<Button
				variant="primary"
				icon={SaveIcon}
				onclick={save}
				disabled={!dirty || saving || (preview !== null && !preview.ok)}
				data-testid="designer-save">{i18n.t("config.section.save")}</Button
			>
		{/snippet}
	</PageHeader>

	<QueryState query={source} errorText={i18n.t("config.designer.notEditable")}>
		{#snippet children(s)}
			{#if designable}
				<ChoiceButtons
					choices={[
						{
							key: "design",
							label: i18n.t("config.designer.design"),
							icon: DesignIcon,
						},
						{ key: "code", label: i18n.t("config.designer.code"), icon: icons.code },
					]}
					current={mode}
					onselect={(k) => switchTo(k)}
					label={i18n.t("config.designer.modes")}
					itemTestid="designer-tab-"
				/>
			{/if}
			{#if problems.length > 0 || (preview && !preview.ok)}
				<Alert as="div" data-testid="designer-problems">
					<p class="font-semibold">{i18n.t("config.designer.problems")}</p>
					<BulletList>
						{#each [...problems, ...(preview && !preview.ok ? preview.problems : [])] as p, i (i)}
							<li>{p}</li>
						{/each}
					</BulletList>
				</Alert>
			{/if}

			{#if mode === "design" && designer}
				{@const d = designer}
				<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
					<Card gap="3">
						<Row justify="between" align="center">
							<SegmentedGroup
								fit
								role="group"
								class="flex-wrap"
								aria-label={i18n.t("config.designer.faces")}
								options={d.sizes.map((f, i) => ({
									value: i,
									label: faceName(f),
									testid: `designer-face-${f.file}`,
								}))}
								value={d.face}
								onselect={(i) => {
									d.face = i;
									d.selectedId = null;
								}}
							/>
							<SegmentedGroup
								fit
								role="group"
								aria-label={i18n.t("config.designer.zoom")}
								options={([1, 2, 3] as const).map((z) => ({
									value: z,
									label: `${z * 100}%`,
								}))}
								value={zoom}
								onselect={(z) => (zoom = z)}
							/>
							<InlineField label={i18n.t("config.designer.grid")}>
								<Select
									auto
									value={String(d.grid)}
									onchange={(e) => chooseGrid(d, Number(e.currentTarget.value))}
									data-testid="designer-grid-step"
								>
									{#each GRID_STEPS as g (g)}
										<option value={String(g)}
											>{i18n.t(
												`config.designer.gridSteps.s${String(g).replace(".", "")}`,
											)}</option
										>
									{/each}
								</Select>
							</InlineField>
						</Row>
						{#if d.size.doc === null}
							<Alert tone="warning">{i18n.t("config.designer.noStock")}</Alert>
						{/if}
						<TemplateDesignerCanvas
							designer={d}
							html={faceDoc.html}
							scale={PX_PER_MM * zoom}
							documentHeightMm={faceDoc.heightMm || d.size.heightMm}
							{describe}
						/>
						<Hint tone="faint">{i18n.t("config.designer.canvasHint")}</Hint>
						{#if d.unplaced > 0}
							<Hint tone="faint" data-testid="designer-flow"
								>{i18n.t("config.designer.flowHint", { count: d.unplaced })}</Hint
							>
						{/if}
						{#if (d.current?.locked ?? 0) > 0}
							<Hint tone="faint" data-testid="designer-locked"
								>{i18n.t("config.designer.lockedHint", {
									count: d.current?.locked ?? 0,
								})}</Hint
							>
						{/if}
					</Card>
					<Card gap="3">
						<TemplateDesignerPanel
							designer={d}
							assets={s.assets}
							template={data.name}
							onassets={() => void source.refresh()}
							cardSize={readCardSize(current["template.json"] ?? "")}
							cardDefault={s.cardDefault}
							cardSheet={s.cardSheet}
							onsize={setCardSize}
						/>
					</Card>
				</div>
			{:else}
				<div class="grid gap-4 xl:grid-cols-2">
					<Card gap="3">
						<SegmentedGroup
							role="group"
							class="flex-wrap"
							aria-label={i18n.t("config.designer.files")}
						>
							{#each Object.keys(files) as f (f)}
								<button
									type="button"
									class="btn font-mono btn-sm {file === f
										? 'preset-filled-primary-500'
										: 'hover:preset-tonal'}"
									aria-pressed={file === f}
									onclick={() => (file = f)}
									data-testid="designer-file-{f}">{f}</button
								>
							{/each}
						</SegmentedGroup>
						{#if file in files}
							<textarea
								class="textarea h-[60vh] font-mono text-sm"
								spellcheck="false"
								aria-label={file}
								bind:value={files[file]}
								data-testid="designer-code"></textarea>
						{/if}
						{#if designable}
							<Hint tone="faint">{i18n.t("config.designer.codeHint")}</Hint>
						{/if}
					</Card>
					<Card gap="3">
						<h2 class="font-semibold">{i18n.t("config.designer.preview")}</h2>
						{#if preview?.ok}
							{@const p = preview.preview}
							{#if p.kind === "cards"}
								<Row gap="3">
									<PreviewFrame
										title={i18n.t("config.designer.front")}
										html={p.front}
										widthMm={p.widthMm}
										heightMm={p.heightMm}
										data-testid="designer-preview"
									/>
									<PreviewFrame
										title={i18n.t("config.designer.back")}
										html={p.back}
										widthMm={p.widthMm}
										heightMm={p.heightMm}
									/>
								</Row>
							{:else if p.kind === "labels"}
								<Row gap="3" align="start">
									{#each p.docs as doc, i (doc.stock)}
										<PreviewFrame
											title={doc.variant
												? `${doc.stock} · ${doc.variant}`
												: doc.stock}
											html={doc.html}
											widthMm={doc.widthMm}
											heightMm={doc.heightMm}
											data-testid={i === 0 ? "designer-preview" : undefined}
										/>
									{/each}
								</Row>
							{:else}
								<PreviewFrame
									title={i18n.t("config.designer.preview")}
									html={p.html}
									widthMm={150}
									heightMm={190}
									data-testid="designer-preview"
								/>
							{/if}
						{:else if !preview}
							<Loading size="md" />
						{/if}
					</Card>
				</div>
			{/if}
		{/snippet}
	</QueryState>

	<ConfirmDialog
		bind:open={guard.open}
		title={i18n.t("config.leave.title")}
		description={i18n.t("config.leave.description")}
		tone="error"
		confirmLabel={i18n.t("config.leave.confirm")}
		onconfirm={() => guard.leave()}
		oncancel={() => guard.stay()}
	/>
</Page>
