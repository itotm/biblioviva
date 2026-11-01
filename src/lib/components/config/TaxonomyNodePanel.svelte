<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The genre or class being edited (step 11.1): code (a changed code is a rename: its books
     follow on save), name, colour, pictogram (upload, choose one of the images already in the
     folder, or none), position in the tree, how many books use it, removal, and the spine band as
     it would be printed. Everything stays in the draft until "Salva". -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { submitFile } from "#lib/ui/submit-file.js";
	import { uploadPictogram } from "#lib/remote/taxonomy.remote.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import { DRAFT_IMAGE, draftImageSrc, type TaxonomyUsage } from "#lib/shared/taxonomy.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Field from "#lib/ui/Field.svelte";
	import FileButton from "#lib/ui/FileButton.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { icons } from "#lib/ui/icons.js";
	import PictogramThumb from "./PictogramThumb.svelte";
	import SpineBandPreview from "./SpineBandPreview.svelte";
	import type { EditNode, TaxonomyEditor } from "./taxonomy-editor.svelte.js";

	interface Props {
		editor: TaxonomyEditor;
		usage: TaxonomyUsage;
		/** Image files of the pictogram folder. */
		images: string[];
		/** Shown as a close button (the panel in a dialog on phones). */
		onclose?: () => void;
	}

	const { editor, usage, images, onclose }: Props = $props();
	const i18n = useI18n();
	const UploadIcon = icons.upload;
	const ImageIcon = icons.image;
	const RemoveIcon = icons.delete;
	const AddIcon = icons.add;
	const CloseIcon = icons.close;

	const place = $derived(editor.current);
	const problems = $derived(place ? (editor.problems[place.node.key] ?? []) : []);
	const codeErrors = $derived(
		problems
			.filter((p) => p.startsWith("code"))
			.map((p) => i18n.t(`config.taxonomy.problems.${p}`)),
	);
	const labelErrors = $derived(
		problems
			.filter((p) => p.startsWith("label"))
			.map((p) => i18n.t(`config.taxonomy.problems.${p}`)),
	);
	const used = $derived(
		place?.node.originalCode
			? (usage[place.kind][place.node.originalCode] ?? { records: 0, copies: 0 })
			: null,
	);
	const renamedTo = $derived(
		place?.node.originalCode ? editor.renames[place.node.originalCode] : undefined,
	);
	const subclasses = $derived(
		place?.kind === "nonfiction" && place.parent === null
			? ((place.node as EditNode).children?.length ?? 0)
			: 0,
	);
	const previewable = $derived(place !== null && problems.every((p) => !p.startsWith("code")));

	let fileInput = $state<HTMLInputElement>();
	let uploading = $state(false);
	const uploadError = $derived(uploadPictogram.fields.image.issues()?.[0]?.message);

	async function onFile(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = e.currentTarget.files?.[0];
		const key = place?.node.key;
		e.currentTarget.value = "";
		if (!file || !fileInput || !key) {
			return;
		}
		uploading = true;
		try {
			if ((await submitFile(uploadPictogram, fileInput, file)) && uploadPictogram.result) {
				const target = editor.find(key);
				if (target) {
					target.node.image = uploadPictogram.result.image;
				}
			}
		} finally {
			uploading = false;
		}
	}

	let gallery = $state(false);
	function choose(name: string): void {
		if (place) {
			place.node.image = name;
		}
		gallery = false;
	}

	let confirmRemove = $state(false);
	function askRemove(): void {
		if (!place) {
			return;
		}
		if (subclasses > 0 || (used?.records ?? 0) > 0) {
			confirmRemove = true;
		} else {
			editor.remove(place.node.key);
		}
	}
</script>

{#if place}
	{@const node = place.node}
	{@const parent = place.parent}
	<div class="space-y-4" data-testid="taxonomy-panel">
		<Row justify="between" align="center" wrap={false}>
			<h2 class="title-lg">
				{i18n.t(
					place.kind === "fiction"
						? "config.taxonomy.panel.genre"
						: parent
							? "config.taxonomy.panel.subclass"
							: "config.taxonomy.panel.class",
				)}
				<span class="font-mono">{node.code}</span>
			</h2>
			{#if onclose}
				<IconButton
					icon={CloseIcon}
					label={i18n.t("common.actions.close")}
					onclick={onclose}
				/>
			{/if}
		</Row>

		<Field label={i18n.t("config.taxonomy.fields.code")} errors={codeErrors} name="code">
			<Input
				mono
				bind:value={node.code}
				maxlength={32}
				autocomplete="off"
				data-testid="taxonomy-code"
			/>
		</Field>
		{#if renamedTo && used && used.records > 0}
			<Hint tone="primary" data-testid="taxonomy-rename-note">
				{i18n.t("config.taxonomy.renameNote", {
					records: used.records,
					from: node.originalCode ?? "",
					to: renamedTo,
				})}
			</Hint>
		{/if}
		<Field label={i18n.t("config.taxonomy.fields.label")} errors={labelErrors} name="label">
			<Input bind:value={node.label} maxlength={120} data-testid="taxonomy-label" />
		</Field>

		<fieldset class="space-y-2">
			<legend class="label-text">{i18n.t("config.taxonomy.fields.color")}</legend>
			<Checkbox
				checked={node.color === null}
				onchange={(e) =>
					(node.color = e.currentTarget.checked ? null : (parent?.color ?? "#64748b"))}
				data-testid="taxonomy-color-none"
			>
				{parent
					? i18n.t("config.taxonomy.color.inherit", { code: parent.code })
					: i18n.t("config.taxonomy.color.none")}
			</Checkbox>
			{#if node.color !== null}
				<Row align="center" gap="3">
					<input
						type="color"
						class="h-10 w-14 cursor-pointer rounded-base border border-surface-300 hover:border-primary-500"
						value={/^#[0-9a-fA-F]{6}$/.test(node.color) ? node.color : "#64748b"}
						oninput={(e) => (node.color = e.currentTarget.value)}
						aria-label={i18n.t("config.taxonomy.fields.color")}
						data-testid="taxonomy-color"
					/>
					<Input
						mono
						class="w-32"
						value={node.color}
						oninput={(e) => (node.color = e.currentTarget.value.trim())}
						maxlength={7}
						aria-label={i18n.t("config.taxonomy.color.hex")}
						data-testid="taxonomy-color-text"
					/>
				</Row>
				{#if problems.includes("colorFormat")}
					<Hint tone="error">{i18n.t("config.taxonomy.problems.colorFormat")}</Hint>
				{/if}
			{/if}
		</fieldset>

		<fieldset class="space-y-2">
			<legend class="label-text">{i18n.t("config.taxonomy.fields.pictogram")}</legend>
			<Row align="center" gap="3">
				<PictogramThumb
					code={node.code}
					image={node.image ?? parent?.image ?? null}
					color={node.color ?? parent?.color ?? null}
					size="lg"
				/>
				<Row gap="2">
					<FileButton
						icon={UploadIcon}
						accept="image/png,image/jpeg,image/webp"
						onchange={onFile}
						disabled={uploading}
						data-testid="pictogram-file"
						>{i18n.t("config.taxonomy.pictogram.upload")}</FileButton
					>
					{#if images.length > 0}
						<Button
							icon={ImageIcon}
							onclick={() => (gallery = true)}
							data-testid="pictogram-choose"
							>{i18n.t("config.taxonomy.pictogram.choose")}</Button
						>
					{/if}
					{#if node.image}
						<Button
							variant="error-tonal"
							icon={RemoveIcon}
							onclick={() => (node.image = null)}
							data-testid="pictogram-remove"
							>{i18n.t("config.taxonomy.pictogram.remove")}</Button
						>
					{/if}
				</Row>
			</Row>
			<Hint tone="faint" data-testid="pictogram-hint">
				{node.image && !node.image.startsWith(DRAFT_IMAGE) && !images.includes(node.image)
					? i18n.t("config.taxonomy.pictogram.missing", { name: node.image })
					: node.image
						? i18n.t("config.taxonomy.pictogram.own")
						: parent?.image
							? i18n.t("config.taxonomy.pictogram.inherited", { code: parent.code })
							: i18n.t("config.taxonomy.pictogram.placeholder")}
			</Hint>
			{#if uploadError}
				<Alert data-testid="pictogram-error">{uploadError}</Alert>
			{/if}
			<form
				{...uploadPictogram}
				enctype="multipart/form-data"
				class="hidden"
				aria-hidden="true"
				data-testid="pictogram-form"
			>
				<input {...uploadPictogram.fields.image.as("file")} bind:this={fileInput} />
			</form>
		</fieldset>

		{#if place.kind === "nonfiction"}
			<Field
				label={i18n.t("config.taxonomy.fields.position")}
				hint={subclasses > 0 ? i18n.t("config.taxonomy.position.locked") : undefined}
			>
				<Select
					value={parent?.key ?? ""}
					onchange={(e) => editor.reparent(node.key, e.currentTarget.value || null)}
					disabled={subclasses > 0}
					data-testid="taxonomy-parent"
				>
					<option value="">{i18n.t("config.taxonomy.position.top")}</option>
					{#each editor.nonfiction.filter((n) => n.key !== node.key) as n (n.key)}
						<option value={n.key}
							>{i18n.t("config.taxonomy.position.under", {
								code: n.code,
								label: n.label,
							})}</option
						>
					{/each}
				</Select>
			</Field>
			{#if !parent}
				<Button
					icon={AddIcon}
					onclick={() => editor.addClass(node.key)}
					data-testid="taxonomy-add-child">{i18n.t("config.taxonomy.addSubclass")}</Button
				>
			{/if}
		{/if}

		<Hint data-testid="taxonomy-usage">
			{used === null
				? i18n.t("config.taxonomy.usage.new")
				: used.records === 0
					? i18n.t("config.taxonomy.usage.none")
					: i18n.t("config.taxonomy.usage.some", {
							records: used.records,
							copies: used.copies,
						})}
		</Hint>

		<Button
			variant="error-outlined"
			icon={RemoveIcon}
			disabled={!editor.canRemove(node.key)}
			onclick={askRemove}
			data-testid="taxonomy-remove"
			>{i18n.t(
				place.kind === "fiction"
					? "config.taxonomy.remove.genre"
					: "config.taxonomy.remove.class",
			)}</Button
		>

		{#if previewable}
			<SpineBandPreview draft={editor.draft} kind={place.kind} code={node.code.trim()} />
		{:else}
			<Hint tone="faint">{i18n.t("config.taxonomy.preview.needsCode")}</Hint>
		{/if}
	</div>

	<ConfirmDialog
		bind:open={confirmRemove}
		title={i18n.t("config.taxonomy.remove.confirmTitle", { code: node.code })}
		description={[
			subclasses > 0
				? i18n.t("config.taxonomy.remove.withSubclasses", { count: subclasses })
				: "",
			(used?.records ?? 0) > 0
				? i18n.t("config.taxonomy.remove.inUse", { records: used?.records ?? 0 })
				: "",
		]
			.filter(Boolean)
			.join(" ")}
		tone="error"
		confirmLabel={i18n.t("config.taxonomy.remove.confirm")}
		onconfirm={() => editor.remove(node.key)}
	/>

	<Modal
		bind:open={gallery}
		title={i18n.t("config.taxonomy.pictogram.gallery")}
		width="lg"
		animated
		data-testid="pictogram-gallery"
	>
		<ul
			class="grid max-h-[60vh] grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2 overflow-auto"
		>
			{#each images as name (name)}
				<li>
					<button
						type="button"
						class="flex w-full flex-col items-center gap-1 rounded-container border-2 p-2 hover:border-primary-500 hover:bg-primary-50 {node.image ===
						name
							? 'border-primary-500 bg-primary-50'
							: 'border-surface-200'}"
						onclick={() => choose(name)}
						data-testid="pictogram-option"
						data-name={name}
					>
						<img src={draftImageSrc(name)} alt="" class="size-14 object-contain" />
						<span class="w-full truncate text-center font-mono text-xs">{name}</span>
					</button>
				</li>
			{/each}
		</ul>
	</Modal>
{/if}
