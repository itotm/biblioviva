<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Template folders (step 11.6): the card, label and slip templates with where each comes from
     (shipped with BiblioViva, a customised copy, or added here) and the settings that use it;
     duplicate, customise a built-in one, rename (the settings follow), delete (a customised copy
     gives the original back), and the images and fonts of `assets/` uploaded or removed. Every
     operation is one change of the history. Previews stay on the "Template di stampa" page. -->
<script lang="ts">
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import { Tabs } from "@skeletonlabs/skeleton-svelte";
	import { submitFile } from "#lib/ui/submit-file.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { formatBytes } from "#lib/shared/bytes.js";
	import {
		deleteTemplateAssetFile,
		deleteTemplateFolder,
		duplicateTemplateFolder,
		getTemplateFolders,
		renameTemplateFolder,
		uploadTemplateAssetFile,
	} from "#lib/remote/print-config.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Disclosure from "#lib/ui/Disclosure.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import QueryState from "#lib/ui/QueryState.svelte";

	type Kind = "cards" | "labels" | "slips";
	type Folder = NonNullable<typeof folders.current>["templates"][number];

	const i18n = useI18n();
	const fmt = useFormat();
	const folders = getTemplateFolders();
	const CopyIcon = icons.add;
	const RenameIcon = icons.edit;
	const RemoveIcon = icons.delete;
	const UploadIcon = icons.upload;
	const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;

	let kind = $state<Kind>("cards");
	const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i;

	// one dialog for duplicate / rename / delete
	let action = $state<{ op: "duplicate" | "customise" | "rename" | "delete"; t: Folder } | null>(
		null,
	);
	let open = $state(false);
	let newName = $state("");
	let pending = $state(false);
	const taken = $derived(
		(folders.current?.templates ?? []).some(
			(t) => t.kind === action?.t.kind && t.name === newName,
		),
	);
	const nameOk = $derived(NAME.test(newName) && !taken);

	function ask(op: "duplicate" | "customise" | "rename" | "delete", t: Folder): void {
		action = { op, t };
		newName = op === "duplicate" ? `${t.name}-copia` : t.name;
		open = true;
	}

	function errorText(result: { code: string | null; details: string[] }): string {
		return result.code
			? i18n.t(`config.templates.errors.${result.code}`, {
					details: result.details.map(settingName).join(", "),
					name: newName,
					maxMb: folders.current?.maxAssetMb ?? 5,
				})
			: i18n.t("config.archive.failed");
	}

	async function run(): Promise<void> {
		if (!action) {
			return;
		}
		pending = true;
		try {
			const { op, t } = action;
			const result =
				op === "duplicate"
					? await duplicateTemplateFolder({ kind: t.kind, from: t.name, to: newName })
					: op === "customise"
						? await duplicateTemplateFolder({ kind: t.kind, from: t.name, to: t.name })
						: op === "rename"
							? await renameTemplateFolder({
									kind: t.kind,
									from: t.name,
									to: newName,
								})
							: await deleteTemplateFolder({ kind: t.kind, name: t.name });
			if (result.ok) {
				toaster.success({ title: i18n.t(`config.templates.done.${op}`) });
			} else {
				toaster.error({ title: errorText(result) });
			}
		} finally {
			pending = false;
		}
	}

	/** A setting's name as the settings pages show it. */
	function settingName(key: string): string {
		const byType = /^cards\.templateByPatronType\.(\w+)$/.exec(key);
		if (byType) {
			return i18n.t(
				`config.blocks.cardTemplates.${byType[1] === "teacher" ? "teacher" : "student"}`,
			);
		}
		return /^[\w.]+$/.test(key) && key.includes(".")
			? i18n.t(`config.fields.${key}.label`)
			: key;
	}

	// assets: one hidden form, filled before each upload
	let fileInput = $state<HTMLInputElement>();
	let picker = $state<HTMLInputElement>();
	let uploadFor = $state<Folder | null>(null);
	let uploadName = $state("");
	let uploading = $state(false);
	const uploadError = $derived(uploadTemplateAssetFile.fields.asset.issues()?.[0]?.message);

	function pick(t: Folder): void {
		uploadFor = t;
		picker?.click();
	}

	async function onFile(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = "";
		if (!file || !uploadFor || !fileInput) {
			return;
		}
		uploadName = file.name;
		uploading = true;
		try {
			if (await submitFile(uploadTemplateAssetFile, fileInput, file)) {
				toaster.success({
					title: i18n.t("config.templates.done.upload", { name: file.name }),
				});
			}
		} finally {
			uploading = false;
		}
	}

	async function removeAsset(t: Folder, file: string): Promise<void> {
		const result = await deleteTemplateAssetFile({ kind: t.kind, name: t.name, file });
		if (result.ok) {
			toaster.success({ title: i18n.t("config.templates.done.removeAsset", { name: file }) });
		} else {
			toaster.error({ title: errorText(result) });
		}
	}

	const tabValue = (v: string): Kind => (v === "labels" || v === "slips" ? v : "cards");
</script>

<Page width="2xl">
	<PageHeader
		title={i18n.t("config.templates.title")}
		icon="print"
		backHref="/admin/config"
		backLabel={i18n.t("admin.home.sections.config.title")}
	>
		{#snippet views()}
			<AreaTabs area="templates" current="edit" />
		{/snippet}
	</PageHeader>
	<Hint>{i18n.t("config.templates.hint")}</Hint>

	<form
		{...uploadTemplateAssetFile}
		enctype="multipart/form-data"
		class="hidden"
		aria-hidden="true"
		data-testid="asset-form"
	>
		<input {...uploadTemplateAssetFile.fields.kind.as("hidden", uploadFor?.kind ?? "cards")} />
		<input {...uploadTemplateAssetFile.fields.name.as("hidden", uploadFor?.name ?? "")} />
		<input {...uploadTemplateAssetFile.fields.filename.as("hidden", uploadName)} />
		<input {...uploadTemplateAssetFile.fields.asset.as("file")} bind:this={fileInput} />
	</form>
	<input
		type="file"
		class="hidden"
		aria-hidden="true"
		tabindex="-1"
		accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.woff2,.woff,.ttf"
		bind:this={picker}
		onchange={onFile}
		data-testid="asset-input"
	/>
	{#if uploadError}
		<Alert data-testid="asset-error">{uploadError}</Alert>
	{/if}

	<QueryState query={folders}>
		{#snippet children(f)}
			<Tabs value={kind} onValueChange={(e) => (kind = tabValue(e.value))}>
				<Tabs.List>
					{#each ["cards", "labels", "slips"] as const as k (k)}
						<Tabs.Trigger value={k} data-testid="templates-tab-{k}"
							>{i18n.t(`admin.templates.kinds.${k}`)}</Tabs.Trigger
						>
					{/each}
				</Tabs.List>
				{#each ["cards", "labels", "slips"] as const as k (k)}
					<Tabs.Content value={k} class="space-y-4">
						{#each (folders.current?.templates ?? []).filter((t) => t.kind === k) as t (`${t.kind}/${t.name}`)}
							<Card gap="3" as="section" data-testid="template-{t.kind}-{t.name}">
								<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
									<div class="min-w-0 space-y-1.5">
										<h2 class="title-lg font-mono break-all">{t.name}</h2>
										{#if t.description}<p>{t.description}</p>{/if}
										<Row gap="1">
											<Badge
												tone={t.source === "builtin"
													? "neutral"
													: t.overridesBuiltin
														? "secondary"
														: "success"}
												data-testid="template-source"
												>{i18n.t(
													`config.templates.source.${t.source === "builtin" ? "builtin" : t.overridesBuiltin ? "customised" : "added"}`,
												)}</Badge
											>
											{#if t.labelKind}
												<Badge tone="primary"
													>{i18n.t(
														`printing.labels.kinds.${t.labelKind}`,
													)}</Badge
												>
											{/if}
											{#if t.error}
												<Badge tone="error"
													>{i18n.t("config.templates.broken")}</Badge
												>
											{/if}
										</Row>
									</div>
									<Row gap="2" class="sm:justify-end">
										{#if t.source === "builtin"}
											<Button
												icon={RenameIcon}
												onclick={() => ask("customise", t)}
												data-testid="template-customise"
												>{i18n.t("config.templates.customise")}</Button
											>
										{/if}
										<Button
											icon={CopyIcon}
											onclick={() => ask("duplicate", t)}
											data-testid="template-duplicate"
											>{i18n.t("config.templates.duplicate")}</Button
										>
										{#if t.source === "config"}
											<Button
												icon={RenameIcon}
												variant="primary"
												href="/admin/config/templates/{t.kind}/{t.name}"
												data-testid="template-edit"
												>{i18n.t("config.templates.edit")}</Button
											>
											{#if !t.overridesBuiltin}
												<Button
													icon={RenameIcon}
													onclick={() => ask("rename", t)}
													data-testid="template-rename"
													>{i18n.t("config.templates.rename")}</Button
												>
											{/if}
											<Button
												icon={RemoveIcon}
												variant="error-outlined"
												disabled={t.usedBy.length > 0 &&
													!t.overridesBuiltin}
												onclick={() => ask("delete", t)}
												data-testid="template-delete"
												>{i18n.t(
													t.overridesBuiltin
														? "config.templates.restore"
														: "common.actions.delete",
												)}</Button
											>
										{/if}
									</Row>
								</div>
								{#if t.error}
									<Alert>{t.error}</Alert>
								{/if}
								<Hint tone="faint" data-testid="template-used">
									{t.usedBy.length > 0
										? i18n.t("config.templates.usedBy", {
												settings: t.usedBy.map(settingName).join(", "),
											})
										: i18n.t("config.templates.unused")}
								</Hint>

								<Disclosure
									summary={i18n.t("config.templates.assets", {
										count: t.assets.length,
									})}
									data-testid="template-assets"
								>
									{#if t.assets.length === 0}
										<Hint tone="faint"
											>{i18n.t("config.templates.noAssets")}</Hint
										>
									{:else}
										<ul class="grid gap-2 sm:grid-cols-2">
											{#each t.assets as a (a.file)}
												<li
													class="flex items-center gap-3 rounded-base border border-surface-200 p-2"
													data-testid="asset-{a.file}"
												>
													{#if IMAGE.test(a.file)}
														<img
															src="/media/templates/{t.kind}/{t.name}/{a.file}"
															alt=""
															class="size-12 shrink-0 rounded-base bg-surface-100 object-contain"
															loading="lazy"
														/>
													{:else}
														<span
															class="flex size-12 shrink-0 items-center justify-center rounded-base bg-surface-100 font-mono text-xs"
															>{a.file.split(".").pop()}</span
														>
													{/if}
													<div class="min-w-0 flex-1">
														<p class="font-mono text-sm break-all">
															{a.file}
														</p>
														<Hint as="span" tone="faint" class="block"
															>{formatBytes(a.bytes, fmt.locale)} · {a
																.usedIn.length > 0
																? i18n.t(
																		"config.templates.usedIn",
																		{
																			files: a.usedIn.join(
																				", ",
																			),
																		},
																	)
																: i18n.t(
																		"config.templates.assetUnused",
																	)}</Hint
														>
													</div>
													{#if t.source === "config"}
														<IconButton
															icon={RemoveIcon}
															label={i18n.t("common.actions.delete")}
															variant="error"
															size="sm"
															disabled={a.usedIn.length > 0}
															onclick={() => removeAsset(t, a.file)}
															data-testid="asset-remove"
														/>
													{/if}
												</li>
											{/each}
										</ul>
									{/if}
									{#if t.source === "config"}
										<Row align="center" gap="2">
											<Button
												icon={UploadIcon}
												onclick={() => pick(t)}
												disabled={uploading}
												data-testid="asset-upload"
												>{i18n.t("config.templates.upload")}</Button
											>
											<Hint as="span" tone="faint"
												>{i18n.t("config.templates.uploadHint", {
													maxMb: f.maxAssetMb,
												})}</Hint
											>
										</Row>
									{:else}
										<Hint tone="faint"
											>{i18n.t("config.templates.builtinAssets")}</Hint
										>
									{/if}
								</Disclosure>
								<Disclosure
									summary={i18n.t("config.templates.files", {
										count: t.files.length,
									})}
								>
									<ul class="font-mono text-sm">
										{#each t.files.filter((f) => !f.startsWith("assets/")) as f (f)}
											<li>{f}</li>
										{/each}
									</ul>
									<Hint tone="faint">{i18n.t("config.templates.filesHint")}</Hint>
								</Disclosure>
							</Card>
						{/each}
					</Tabs.Content>
				{/each}
			</Tabs>
		{/snippet}
	</QueryState>
</Page>

<ConfirmDialog
	bind:open
	title={action
		? i18n.t(`config.templates.dialog.${action.op}.title`, { name: action.t.name })
		: ""}
	description={action
		? i18n.t(`config.templates.dialog.${action.op}.hint`, { name: action.t.name })
		: ""}
	tone={action?.op === "delete" ? "error" : "primary"}
	confirmLabel={action ? i18n.t(`config.templates.dialog.${action.op}.confirm`) : ""}
	confirmDisabled={(action?.op === "duplicate" || action?.op === "rename") &&
		(!nameOk || (action.op === "rename" && newName === action.t.name))}
	{pending}
	onconfirm={run}
>
	{#if action && (action.op === "duplicate" || action.op === "rename")}
		<Field
			label={i18n.t("config.templates.dialog.name")}
			hint={i18n.t("config.templates.dialog.nameHint")}
			errors={newName && !NAME.test(newName)
				? [i18n.t("config.templates.dialog.badName")]
				: taken && !(action.op === "rename" && newName === action.t.name)
					? [i18n.t("config.templates.dialog.taken")]
					: []}
		>
			<Input mono bind:value={newName} maxlength={64} data-testid="template-name" />
		</Field>
	{/if}
</ConfirmDialog>
