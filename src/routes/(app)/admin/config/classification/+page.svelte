<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Classification editor (step 11.1): genres, the non-fiction classes with their subclasses, the
     Dewey map and the options, edited as a draft; the side panel (a dialog on phones) edits the
     chosen node with the spine band as it would print. "Salva" shows what the change does to the
     catalogue first, then writes `classification.json` (the previous version goes in the
     history) and updates the catalogue together. Leaving with unsaved changes asks first. -->
<script lang="ts">
	import { Dialog, Portal, Tabs } from "@skeletonlabs/skeleton-svelte";
	import { MediaQuery } from "svelte/reactivity";
	import { useI18n } from "#lib/i18n/context.js";
	import { getTaxonomyEditor } from "#lib/remote/taxonomy.remote.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import DeweyMapEditor from "#lib/components/config/DeweyMapEditor.svelte";
	import TaxonomyList from "#lib/components/config/TaxonomyList.svelte";
	import TaxonomyNodePanel from "#lib/components/config/TaxonomyNodePanel.svelte";
	import TaxonomyOptions from "#lib/components/config/TaxonomyOptions.svelte";
	import TaxonomySaveDialog from "#lib/components/config/TaxonomySaveDialog.svelte";
	import { TaxonomyEditor } from "#lib/components/config/taxonomy-editor.svelte.js";
	import { LeaveGuard } from "#lib/components/config/leave-guard.svelte.js";
	import type { TaxonomyKind } from "#lib/shared/taxonomy.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import DialogFrame from "#lib/ui/DialogFrame.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Loading from "#lib/ui/Loading.svelte";

	const i18n = useI18n();
	const source = getTaxonomyEditor();
	const wide = new MediaQuery("min-width: 1024px", false);
	const SaveIcon = icons.save;
	const UndoIcon = icons.undo;
	const AddIcon = icons.add;

	let editor = $state<TaxonomyEditor | null>(null);
	$effect(() => {
		const current = source.current;
		if (current && editor === null) {
			editor = new TaxonomyEditor(current.draft);
		}
	});

	let tab = $state<"fiction" | "nonfiction" | "dewey" | "options">("fiction");
	const panelKind = $derived(tab === "fiction" || tab === "nonfiction" ? tab : null);
	const panelOpen = $derived(
		editor?.current !== null && editor?.current?.kind === panelKind && panelKind !== null,
	);
	let saveOpen = $state(false);

	function discard(): void {
		if (editor && source.current) {
			editor.reset(source.current.draft);
		}
	}

	async function saved(result: {
		records: number;
		callNumbers: number;
		bands: number;
	}): Promise<void> {
		await source.refresh();
		if (editor && source.current) {
			editor.reset(source.current.draft);
		}
		toaster.success({
			title: i18n.t("config.taxonomy.saved"),
			description:
				result.records > 0 || result.bands > 0
					? i18n.t("config.taxonomy.savedDetail", {
							records: result.records,
							callNumbers: result.callNumbers,
							bands: result.bands,
						})
					: undefined,
		});
	}

	// leaving with unsaved changes: the browser asks on reload or close, the page asks otherwise
	const guard = new LeaveGuard(() => editor?.dirty ?? false);

	const count = (kind: TaxonomyKind): number =>
		kind === "fiction"
			? (editor?.genres.length ?? 0)
			: (editor?.nonfiction.reduce((n, c) => n + 1 + c.children.length, 0) ?? 0);
</script>

{#snippet tree(kind: TaxonomyKind, ed: TaxonomyEditor, usage: NonNullable<typeof source.current>)}
	<div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
		<Card gap="3" variant="outlined">
			<TaxonomyList editor={ed} {kind} usage={usage.usage[kind]} />
			<Button
				icon={AddIcon}
				onclick={() => (kind === "fiction" ? ed.addGenre() : ed.addClass())}
				data-testid="taxonomy-add-{kind}"
				>{i18n.t(
					kind === "fiction" ? "config.taxonomy.addGenre" : "config.taxonomy.addClass",
				)}</Button
			>
			<Hint tone="faint">{i18n.t("config.taxonomy.dragHint")}</Hint>
		</Card>
		{#if wide.current}
			<Card variant="outlined" class="lg:sticky lg:top-4">
				{#if ed.current?.kind === kind}
					<TaxonomyNodePanel editor={ed} usage={usage.usage} images={usage.images} />
				{:else}
					<EmptyState
						title={i18n.t(
							kind === "fiction"
								? "config.taxonomy.pickGenre"
								: "config.taxonomy.pickClass",
						)}
						icon="classification"
					/>
				{/if}
			</Card>
		{/if}
	</div>
{/snippet}

<Page width="2xl">
	<PageHeader
		title={i18n.t("config.taxonomy.title")}
		icon="classification"
		backHref="/admin/config"
		backLabel={i18n.t("admin.home.sections.config.title")}
	>
		{#snippet actions()}
			{#if editor?.dirty}
				<Badge tone="warning" data-testid="taxonomy-dirty"
					>{i18n.t("config.taxonomy.unsaved")}</Badge
				>
			{/if}
			<Button
				icon={UndoIcon}
				onclick={discard}
				disabled={!editor?.dirty}
				data-testid="taxonomy-discard">{i18n.t("config.taxonomy.discard")}</Button
			>
			<Button
				variant="primary"
				icon={SaveIcon}
				onclick={() => (saveOpen = true)}
				disabled={!editor?.dirty || editor.invalid}
				data-testid="taxonomy-save">{i18n.t("common.actions.save")}</Button
			>
		{/snippet}
	</PageHeader>

	{#if source.error}
		<Alert>{i18n.t("common.status.error")}</Alert>
	{:else if !source.current || !editor}
		<Loading />
	{:else}
		{@const data = source.current}
		<Hint data-testid="taxonomy-file"
			>{i18n.t("config.taxonomy.intro", { file: data.file })}</Hint
		>
		{#if editor.dirty && editor.invalid}
			<Alert tone="warning" data-testid="taxonomy-invalid"
				>{i18n.t("config.taxonomy.invalid")}</Alert
			>
		{/if}
		{#if data.orphans.length > 0}
			<Alert tone="warning" data-testid="taxonomy-orphans">
				{i18n.t("config.taxonomy.orphans", {
					codes: data.orphans.map((o) => `${o.code} (${o.records})`).join(", "),
				})}
			</Alert>
		{/if}
		<Tabs
			value={tab}
			onValueChange={(d) => (tab = d.value as typeof tab)}
			data-testid="taxonomy-tabs"
		>
			<Tabs.List>
				<Tabs.Trigger value="fiction" data-testid="taxonomy-tab-fiction"
					>{i18n.t("config.taxonomy.tabs.fiction")} ({count("fiction")})</Tabs.Trigger
				>
				<Tabs.Trigger value="nonfiction" data-testid="taxonomy-tab-nonfiction"
					>{i18n.t("config.taxonomy.tabs.nonfiction")} ({count(
						"nonfiction",
					)})</Tabs.Trigger
				>
				<Tabs.Trigger value="dewey" data-testid="taxonomy-tab-dewey"
					>{i18n.t("config.taxonomy.tabs.dewey")} ({editor.deweyMap.length})</Tabs.Trigger
				>
				<Tabs.Trigger value="options" data-testid="taxonomy-tab-options"
					>{i18n.t("config.taxonomy.tabs.options")}</Tabs.Trigger
				>
			</Tabs.List>
			<Tabs.Content value="fiction" class="py-4">
				{@render tree("fiction", editor, data)}
			</Tabs.Content>
			<Tabs.Content value="nonfiction" class="py-4">
				{@render tree("nonfiction", editor, data)}
			</Tabs.Content>
			<Tabs.Content value="dewey" class="py-4">
				<DeweyMapEditor {editor} />
			</Tabs.Content>
			<Tabs.Content value="options" class="py-4">
				<TaxonomyOptions {editor} savedClassPerItem={data.draft.classPerItem} />
			</Tabs.Content>
		</Tabs>

		{#if !wide.current}
			<Dialog
				open={panelOpen}
				onOpenChange={(d) => {
					if (!d.open && editor) {
						editor.selected = null;
					}
				}}
			>
				{#if panelOpen}
					<Portal>
						<DialogFrame width="lg" scroll data-testid="taxonomy-panel-dialog">
							<TaxonomyNodePanel
								{editor}
								usage={data.usage}
								images={data.images}
								onclose={() => {
									if (editor) {
										editor.selected = null;
									}
								}}
							/>
						</DialogFrame>
					</Portal>
				{/if}
			</Dialog>
		{/if}

		<TaxonomySaveDialog bind:open={saveOpen} {editor} onsaved={saved} />
	{/if}

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
