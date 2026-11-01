<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The designer's side panel (steps 11.10, 11.16): the elements to add, then the properties of the
     chosen element — what it shows (a field, a text, an image, its HTML), where it is in
     millimetres, the text style — or, with nothing chosen, the background of the face. A value the
     element does not set itself shows, lighter, the one it gets from the style sheet; changing it
     writes it on the element. A card face takes a shipped background (step 11.17) or a picture
     uploaded into the template's `assets/`. -->
<script lang="ts">
	import { submitFile } from "#lib/ui/submit-file.js";
	import CardBackgroundPicker from "./CardBackgroundPicker.svelte";
	import { isCardBackgroundAsset } from "#lib/shared/card-backgrounds.js";
	import { uploadTemplateAssetFile, useCardBackground } from "#lib/remote/print-config.remote.js";
	import { toaster } from "#lib/ui/toaster.js";
	import FileButton from "#lib/ui/FileButton.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		DESIGN_FIELDS,
		DESIGN_TYPES,
		type DesignElement,
		type ElementType,
		NO_IMAGE,
	} from "#lib/shared/template-design.js";
	import { FONTS, type DesignStyle, type FontName } from "#lib/shared/template-style.js";
	import Button from "#lib/ui/Button.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Field from "#lib/ui/Field.svelte";
	import ColorInput from "#lib/ui/ColorInput.svelte";
	import Fieldbox from "#lib/ui/Fieldbox.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import InlineField from "#lib/ui/InlineField.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import SegmentedGroup from "#lib/ui/SegmentedGroup.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { icons } from "#lib/ui/icons.js";
	import type { TemplateDesigner } from "./template-designer.svelte.js";
	import { cardSheetFit, type CardSheetSpacing } from "#lib/shared/card-layout.js";
	import type { CardSize } from "#lib/shared/card-size.js";

	interface Props {
		designer: TemplateDesigner;
		assets: readonly string[];
		/** The template's name (its `assets/` take the pictures chosen or uploaded). */
		template: string;
		/** Called once a picture is in `assets/`: the page reads the folder again. */
		onassets?: () => void;
		/** Cards: the size the template names (null: the configuration's, `cardDefault`). */
		cardSize?: CardSize | null;
		cardDefault?: CardSize | null;
		/** Cards: the sheet a size must fit (`cardSheetFit`): larger sizes are refused. */
		cardSheet?: CardSheetSpacing | null;
		/** Cards: a new size (null: back to the configuration's). */
		onsize?: (size: CardSize | null) => void;
	}

	const {
		designer,
		assets,
		template,
		onassets,
		cardSize = null,
		cardDefault = null,
		cardSheet = null,
		onsize,
	}: Props = $props();
	const RotateIcon = icons.rotate;
	const shownSize = $derived(cardSize ?? cardDefault);
	const mmText = (v: number): string => String(v).replace(".", ",");
	/** The largest card the sheet takes (front and back side by side inside the margins). */
	const maxSize = $derived(
		cardSheet
			? cardSheetFit({ width: 1, height: 1 }, cardSheet).max
			: { width: 200, height: 200 },
	);
	const fits = (size: CardSize): boolean => !cardSheet || cardSheetFit(size, cardSheet).fits;

	function resize(key: "width" | "height", raw: string): void {
		const value = Number(raw.replace(",", "."));
		if (!shownSize || !Number.isFinite(value) || value < 20 || value > maxSize[key]) {
			return;
		}
		onsize?.({ ...shownSize, [key]: value });
	}
	const i18n = useI18n();
	const AddIcon = icons.add;
	const RemoveIcon = icons.delete;
	const MoveIcon = icons.more;
	const images = $derived(assets.filter((a) => /\.(png|jpe?g|webp|gif|svg)$/i.test(a)));
	const face = $derived(designer.current);
	const el = $derived(designer.selected);
	const box = $derived(el ? designer.box(el) : null);
	/** The look the preview gives the chosen element (its own values, or the style sheet's). */
	const shown = $derived(el ? designer.measured[el.id]?.style : undefined);
	const typeName = (t: ElementType): string => i18n.t(`config.designer.types.${t}`);
	const fieldName = (f: string): string =>
		i18n.t(`config.designer.fields.${f.replace(".", "_")}`);
	const texty = (t: ElementType): boolean => t === "field" || t === "text" || t === "html";

	function look<K extends keyof DesignStyle>(e: DesignElement, key: K): DesignStyle[K] {
		return e.style[key] ?? shown?.[key] ?? null;
	}

	function num(e: DesignElement, key: "x" | "y" | "w" | "h", raw: string): void {
		const value = Number(raw);
		const b = designer.box(e) ?? { x: 0, y: 0, w: 10, h: 5 };
		if (raw === "" || Number.isNaN(value)) {
			return;
		}
		if (key === "x" || key === "y") {
			designer.moveTo(e.id, key === "x" ? value : b.x, key === "y" ? value : b.y);
		} else {
			designer.resizeTo(e.id, key === "w" ? value : b.w, key === "h" ? value : b.h);
		}
	}

	// the face's background: a shipped one (with its bleed) or a picture of the folder
	const ImageIcon = icons.image;
	const UploadIcon = icons.upload;
	let picking = $state(false);
	let adding = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let uploadName = $state("");
	const uploadError = $derived(uploadTemplateAssetFile.fields.asset.issues()?.[0]?.message);
	function setBackground(asset: string | null): void {
		if (face) {
			face.backgroundImage = asset;
			face.backgroundBleed = isCardBackgroundAsset(asset);
		}
	}

	async function pickBackground(name: string): Promise<void> {
		adding = true;
		try {
			const result = await useCardBackground({ name: template, background: name });
			if (result.ok) {
				setBackground(result.file);
				onassets?.();
				picking = false;
				toaster.success({ title: i18n.t("config.designer.backgroundAdded") });
			} else {
				toaster.error({ title: i18n.t("config.designer.backgroundFailed") });
			}
		} finally {
			adding = false;
		}
	}

	async function onUpload(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = "";
		if (!file || !fileInput) {
			return;
		}
		uploadName = file.name;
		adding = true;
		try {
			if (await submitFile(uploadTemplateAssetFile, fileInput, file)) {
				setBackground(file.name);
				onassets?.();
				toaster.success({ title: i18n.t("config.designer.backgroundAdded") });
			}
		} finally {
			adding = false;
		}
	}

	function fontSize(e: DesignElement, raw: string): void {
		const value = Number(raw);
		e.style.fontSizePt = raw === "" || Number.isNaN(value) ? null : value;
	}
</script>

<div class="space-y-4" data-testid="designer-panel">
	<fieldset class="space-y-2">
		<legend class="label-text">{i18n.t("config.designer.add")}</legend>
		<Row gap="2">
			{#each DESIGN_TYPES[designer.kind] as t (t)}
				<Button
					size="sm"
					icon={AddIcon}
					disabled={t === "image" && images.length === 0}
					onclick={() =>
						designer.add(t, {
							text:
								t === "text" || t === "html"
									? i18n.t("config.designer.newText")
									: undefined,
							image: images[0],
						})}
					data-testid="designer-add-{t}">{typeName(t)}</Button
				>
			{/each}
		</Row>
		{#if images.length === 0}
			<Hint tone="faint">{i18n.t("config.designer.noImages")}</Hint>
		{/if}
	</fieldset>

	{#if el}
		<Fieldbox data-testid="designer-properties">
			<Row justify="between" align="center">
				<h3 class="font-semibold">{typeName(el.type)}</h3>
				<Row gap="1">
					<IconButton
						icon={MoveIcon}
						size="sm"
						class="[&>svg]:rotate-180"
						label={i18n.t("config.designer.backward")}
						onclick={() => designer.reorder(el.id, -1)}
					/>
					<IconButton
						icon={MoveIcon}
						size="sm"
						label={i18n.t("config.designer.forward")}
						onclick={() => designer.reorder(el.id, 1)}
					/>
					<IconButton
						icon={RemoveIcon}
						size="sm"
						variant="error"
						label={i18n.t("common.actions.delete")}
						onclick={() => designer.remove(el.id)}
						data-testid="designer-remove"
					/>
				</Row>
			</Row>
			{#if el.type === "field"}
				<Field label={i18n.t("config.designer.field")}>
					<Select bind:value={el.field} data-testid="designer-field">
						{#each DESIGN_FIELDS[designer.kind] as f (f)}
							<option value={f}>{fieldName(f)}</option>
						{/each}
					</Select>
				</Field>
			{:else if el.type === "text"}
				<Field label={i18n.t("config.designer.text")}>
					<textarea
						class="textarea"
						rows="2"
						bind:value={el.text}
						maxlength={500}
						data-testid="designer-text"></textarea>
				</Field>
			{:else if el.type === "html"}
				<Field label={i18n.t("config.designer.content")}>
					<textarea
						class="textarea font-mono text-sm"
						rows="4"
						spellcheck="false"
						bind:value={el.html}
						data-testid="designer-html"></textarea>
				</Field>
				<Hint tone="faint">{i18n.t("config.designer.contentHint")}</Hint>
			{:else if el.type === "image"}
				<Field label={i18n.t("config.designer.image")}>
					<Select bind:value={el.image} data-testid="designer-image">
						{#each images as a (a)}<option value={a}>{a}</option>{/each}
					</Select>
				</Field>
			{/if}
			<div class="grid grid-cols-4 gap-2">
				{#each ["x", "y", "w", "h"] as const as k (k)}
					<Field label={i18n.t(`config.designer.geometry.${k}`)}>
						<Input
							type="number"
							step="0.5"
							min="0"
							value={box ? Math.round(box[k] * 100) / 100 : ""}
							onchange={(e) => num(el, k, e.currentTarget.value)}
							data-testid="designer-{k}"
						/>
					</Field>
				{/each}
			</div>
			{#if !el.placed}
				<Hint tone="faint" data-testid="designer-unplaced"
					>{i18n.t("config.designer.unplacedHint")}</Hint
				>
			{/if}
			{#if texty(el.type)}
				<div class="grid grid-cols-2 gap-2">
					<Field label={i18n.t("config.designer.fontSize")}>
						<Input
							type="number"
							min="4"
							max="96"
							step="0.5"
							value={el.style.fontSizePt ?? ""}
							placeholder={shown?.fontSizePt ? String(shown.fontSizePt) : ""}
							onchange={(e) => fontSize(el, e.currentTarget.value)}
							data-testid="designer-font-size"
						/>
					</Field>
					<Field label={i18n.t("config.designer.font")}>
						<Select
							value={el.style.font ?? ""}
							onchange={(e) =>
								(el.style.font =
									e.currentTarget.value === ""
										? null
										: (e.currentTarget.value as FontName))}
							data-testid="designer-font"
						>
							<option value="">{i18n.t("config.designer.inherited")}</option>
							{#each Object.keys(FONTS) as FontName[] as f (f)}
								<option value={f}>{i18n.t(`config.designer.fonts.${f}`)}</option>
							{/each}
						</Select>
					</Field>
				</div>
				<Row gap="4">
					<Checkbox
						checked={look(el, "bold") ?? false}
						onchange={(e) => (el.style.bold = e.currentTarget.checked)}
						data-testid="designer-bold">{i18n.t("config.designer.bold")}</Checkbox
					>
					<Checkbox
						checked={look(el, "italic") ?? false}
						onchange={(e) => (el.style.italic = e.currentTarget.checked)}
						>{i18n.t("config.designer.italic")}</Checkbox
					>
					<Checkbox
						checked={look(el, "uppercase") ?? false}
						onchange={(e) => (el.style.uppercase = e.currentTarget.checked)}
						>{i18n.t("config.designer.uppercase")}</Checkbox
					>
				</Row>
				<Row gap="3" align="center">
					<SegmentedGroup
						fit
						role="group"
						aria-label={i18n.t("config.designer.align")}
						options={(["left", "center", "right"] as const).map((a) => ({
							value: a,
							label: i18n.t(`config.designer.aligns.${a}`),
							testid: `designer-align-${a}`,
						}))}
						value={look(el, "align")}
						onselect={(a) => (el.style.align = a)}
					/>
					<InlineField label={i18n.t("config.designer.color")}>
						<ColorInput
							value={look(el, "color") ?? "#000000"}
							oninput={(e) => (el.style.color = e.currentTarget.value)}
						/>
					</InlineField>
				</Row>
			{:else if el.type === "box"}
				<!-- one row each, so a colour appearing beside one never moves the other -->
				<Row gap="3" align="center" wrap={false} data-testid="designer-border-row">
					<Checkbox
						checked={el.border !== null}
						onchange={(e) =>
							(el.border = e.currentTarget.checked
								? { color: "#000000", widthMm: 0.3 }
								: null)}>{i18n.t("config.designer.border")}</Checkbox
					>
					{#if el.border}
						<ColorInput
							bind:value={el.border.color}
							aria-label={i18n.t("config.designer.borderColor")}
						/>
					{/if}
				</Row>
				<Row gap="3" align="center" wrap={false} data-testid="designer-fill-row">
					<Checkbox
						checked={el.fill !== null}
						onchange={(e) => (el.fill = e.currentTarget.checked ? "#eeeeee" : null)}
						>{i18n.t("config.designer.fill")}</Checkbox
					>
					{#if el.fill !== null}
						<ColorInput
							bind:value={el.fill}
							aria-label={i18n.t("config.designer.fillColor")}
						/>
					{/if}
				</Row>
			{/if}
		</Fieldbox>
	{:else if face}
		<Fieldbox data-testid="designer-face">
			{#if face.root}
				<h3 class="font-semibold">{i18n.t("config.designer.background")}</h3>
				<Row gap="4" align="center">
					<Checkbox
						checked={face.background !== null}
						onchange={(e) =>
							(face.background = e.currentTarget.checked ? "#ffffff" : null)}
						>{i18n.t("config.designer.backgroundColor")}</Checkbox
					>
					{#if face.background !== null}
						<ColorInput
							bind:value={face.background}
							aria-label={i18n.t("config.designer.backgroundColor")}
						/>
					{/if}
				</Row>
				<Field label={i18n.t("config.designer.backgroundImage")}>
					<Select
						value={face.backgroundImage ?? ""}
						onchange={(e) => setBackground(e.currentTarget.value || null)}
						data-testid="designer-background-image"
					>
						<option value="">{i18n.t("config.designer.inherited")}</option>
						<option value={NO_IMAGE}>{i18n.t("config.designer.noImage")}</option>
						{#each images as a (a)}<option value={a}>{a}</option>{/each}
					</Select>
				</Field>
				{#if designer.kind === "cards"}
					<Row gap="2">
						<Button
							icon={ImageIcon}
							onclick={() => (picking = true)}
							disabled={adding}
							data-testid="designer-pick-background"
							>{i18n.t("config.designer.chooseBackground")}</Button
						>
						<FileButton
							icon={UploadIcon}
							accept="image/png,image/jpeg,image/webp"
							onchange={onUpload}
							disabled={adding}
							data-testid="designer-upload-background"
							>{i18n.t("config.designer.uploadBackground")}</FileButton
						>
					</Row>
					{#if uploadError}<Hint tone="error">{uploadError}</Hint>{/if}
					<form
						{...uploadTemplateAssetFile}
						enctype="multipart/form-data"
						class="hidden"
						aria-hidden="true"
					>
						<input {...uploadTemplateAssetFile.fields.kind.as("hidden", "cards")} />
						<input {...uploadTemplateAssetFile.fields.name.as("hidden", template)} />
						<input
							{...uploadTemplateAssetFile.fields.filename.as("hidden", uploadName)}
						/>
						<input
							{...uploadTemplateAssetFile.fields.asset.as("file")}
							bind:this={fileInput}
						/>
					</form>
					<CardBackgroundPicker
						bind:open={picking}
						widthMm={designer.size.widthMm}
						heightMm={designer.size.heightMm}
						pending={adding}
						onpick={pickBackground}
					/>
				{/if}
			{/if}
			{#if designer.kind === "cards" && shownSize}
				<!-- the card's size: its own, or the configuration's (step 11.17) -->
				<h3 class="font-semibold">{i18n.t("config.designer.cardSize")}</h3>
				<Row gap="2" align="end">
					<Field label={i18n.t("config.designer.cardWidth")} class="w-28">
						<Input
							type="number"
							step="0.1"
							min="20"
							max={maxSize.width}
							value={shownSize.width}
							onchange={(e) => resize("width", e.currentTarget.value)}
							data-testid="designer-card-width"
						/>
					</Field>
					<Field label={i18n.t("config.designer.cardHeight")} class="w-28">
						<Input
							type="number"
							step="0.1"
							min="20"
							max={maxSize.height}
							value={shownSize.height}
							onchange={(e) => resize("height", e.currentTarget.value)}
							data-testid="designer-card-height"
						/>
					</Field>
					<IconButton
						icon={RotateIcon}
						variant="tonal"
						label={i18n.t("config.designer.cardRotate")}
						disabled={!fits({ width: shownSize.height, height: shownSize.width })}
						onclick={() =>
							onsize?.({ width: shownSize.height, height: shownSize.width })}
						data-testid="designer-card-rotate"
					/>
				</Row>
				{#if cardSize && cardDefault}
					<Button
						size="sm"
						onclick={() => onsize?.(null)}
						data-testid="designer-card-default"
						>{i18n.t("config.designer.cardDefault", {
							width: mmText(cardDefault.width),
							height: mmText(cardDefault.height),
						})}</Button
					>
				{:else if cardDefault}
					<Hint tone="faint">{i18n.t("config.designer.cardDefaultHint")}</Hint>
				{/if}
			{/if}
			<Hint tone="faint">{i18n.t("config.designer.chooseHint")}</Hint>
		</Fieldbox>
	{/if}
</div>
