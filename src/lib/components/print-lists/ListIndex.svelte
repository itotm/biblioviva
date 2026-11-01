<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Stampe (step 2.8): every list the account may see, with its kind, count and last print date;
     "Nuova lista utenti" (`patrons`) and "Nuova lista libri" (`catalog`); delete. Under the lists
     the classes, printed like lists of patrons (owner): the cards of a whole class without making
     a list of it. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { goto } from "$app/navigation";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		createList,
		deleteList,
		getPrintClasses,
		getPrintLists,
	} from "#lib/remote/print-lists.remote.js";
	import { useFormat } from "#lib/ui/format.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import CardPrintDialog from "#lib/components/patrons/CardPrintDialog.svelte";
	import { stageSections } from "#lib/ui/stage-sections.js";
	import { proposedListName } from "#lib/ui/list-name.js";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Button from "#lib/ui/Button.svelte";
	import ChoiceButtons from "#lib/ui/ChoiceButtons.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Field from "#lib/ui/Field.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	interface Props {
		permissions: readonly string[];
	}

	const { permissions }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const lists = getPrintLists();
	const canPatrons = $derived(permissions.includes("patrons"));
	const canItems = $derived(permissions.includes("catalog"));
	const classes = $derived(canPatrons ? getPrintClasses() : null);
	const OpenIcon = icons.view;
	const KINDS = [
		["all", icons.lists],
		["patrons", icons.patrons],
		["items", icons.catalog],
	] as const;
	const PatronsIcon = icons.patrons;
	const BooksIcon = icons.catalog;
	const DeleteIcon = icons.delete;
	const PrintedIcon = icons.print;

	let kind = $state<"all" | "patrons" | "items">("all");
	let newKind = $state<"patrons" | "items" | null>(null);
	let newName = $state("");
	let confirmDelete = $state<{ id: number; name: string } | null>(null);
	/** The class whose cards are being printed. */
	let printing = $state<{ groupId: number; count: number } | null>(null);
	let printDialog = $state(false);
	const visible = $derived(
		(lists.current?.lists ?? []).filter((l) => kind === "all" || l.kind === kind),
	);
	const sections = $derived(
		kind === "items"
			? []
			: stageSections(
					classes?.current?.groups ?? [],
					classes?.current?.stages ?? [],
					i18n.t("patrons.census.stageOthers"),
				),
	);

	/**
	 * The name of a new list when none is typed: "Lista 3 del 29/10/2026" (owner), counted again
	 * when the lists arrive (a button pressed before they are loaded).
	 */
	const proposed = $derived(
		proposedListName(
			(lists.current?.lists ?? []).map((l) => l.name),
			(n, date) => i18n.t("printing.lists.defaultName", { n, date }),
			fmt,
		),
	);

	function startNew(k: "patrons" | "items"): void {
		newName = "";
		newKind = k;
	}

	async function create(): Promise<void> {
		if (newKind === null) {
			return;
		}
		const r = await createList({ kind: newKind, name: newName.trim() || proposed });
		toaster.success({ title: i18n.t("printing.lists.created") });
		newName = "";
		newKind = null;
		await goto(resolve(`print-lists/${r.id}`));
	}

	async function remove(): Promise<void> {
		if (!confirmDelete) {
			return;
		}
		await deleteList({ id: confirmDelete.id });
		toaster.success({ title: i18n.t("printing.lists.deleted") });
		confirmDelete = null;
	}
</script>

<Page width="2xl">
	<PageHeader title={i18n.t("printing.lists.title")} icon="print">
		{#snippet actions()}
			{#if canPatrons}
				<Button
					variant="primary"
					icon={PatronsIcon}
					onclick={() => startNew("patrons")}
					data-testid="new-patron-list">{i18n.t("printing.lists.newPatrons")}</Button
				>
			{/if}
			{#if canItems}
				<Button
					variant={canPatrons ? "tonal" : "primary"}
					icon={BooksIcon}
					onclick={() => startNew("items")}
					data-testid="new-item-list">{i18n.t("printing.lists.newItems")}</Button
				>
			{/if}
		{/snippet}
		{#snippet views()}
			<!-- only for an account that sees both kinds -->
			{#if canPatrons && canItems}
				<ChoiceButtons
					choices={KINDS.map(([key, icon]) => ({
						key,
						icon,
						label: i18n.t(`printing.lists.kinds.${key}`),
					}))}
					current={kind}
					onselect={(k) => (kind = k)}
					label={i18n.t("printing.lists.kind")}
					testid="kind-filter"
					itemTestid="kind-"
					framed={false}
				/>
			{/if}
		{/snippet}
	</PageHeader>

	<QueryState query={lists}>
		{#if visible.length === 0}
			<EmptyState title={i18n.t("printing.lists.empty")} icon="lists" />
		{:else}
			<Grid from="sm" lg3 as="ul" data-testid="print-lists">
				{#each visible as l (l.id)}
					<Card as="li" class="flex flex-col gap-3" data-testid="print-list-{l.id}">
						<a
							href={resolve(`print-lists/${l.id}`)}
							class="text-lg font-bold text-primary-700 hover:underline"
							data-testid="open-list-{l.id}">{l.name}</a
						>
						<Row align="center" class="text-sm">
							<Badge tone="primary">{i18n.t(`printing.lists.kinds.${l.kind}`)}</Badge>
							<Badge>{i18n.t("printing.lists.count", { count: l.count })}</Badge>
							<span
								class="inline-flex items-center gap-1 opacity-70"
								data-testid="last-printed"
							>
								<PrintedIcon size={ICON_SIZE.sm} aria-hidden="true" />
								{l.lastPrintedAt
									? i18n.t("printing.lists.lastPrinted", {
											when: fmt.dateTime(l.lastPrintedAt),
										})
									: i18n.t("printing.lists.neverPrinted")}
							</span>
						</Row>
						<Row class="mt-auto">
							<Button
								variant="primary"
								icon={OpenIcon}
								href={resolve(`print-lists/${l.id}`)}
								>{i18n.t("printing.lists.open")}</Button
							>
							<Button
								variant="error-tonal"
								icon={DeleteIcon}
								onclick={() => (confirmDelete = { id: l.id, name: l.name })}
								data-testid="delete-list-{l.id}"
								>{i18n.t("common.actions.delete")}</Button
							>
						</Row>
					</Card>
				{/each}
			</Grid>
		{/if}

		<!-- the classes under the lists (owner) -->
		{#if sections.length > 0}
			<section class="space-y-4" data-testid="print-classes">
				<div>
					<h2 class="h4">{i18n.t("printing.lists.classes")}</h2>
					<Hint>{i18n.t("printing.lists.classesHint")}</Hint>
				</div>
				{#each sections as section (section.key)}
					{#if section.title}<h3 class="title-lg">{section.title}</h3>{/if}
					<Grid from="sm" lg3 as="ul">
						{#each section.groups as g (g.groupId)}
							<Card
								as="li"
								gap="3"
								data-testid="print-class-{g.label.replaceAll(' ', '')}"
							>
								<span class="text-lg font-bold">{g.label}</span>
								<Row align="center" class="text-sm">
									<Badge tone="secondary"
										>{i18n.t("printing.lists.classKind")}</Badge
									>
									<Badge
										>{i18n.t("printing.lists.count", {
											count: g.total,
										})}</Badge
									>
								</Row>
								<Row>
									<Button
										variant="primary"
										icon={PrintedIcon}
										onclick={() => {
											printing = {
												groupId: g.groupId ?? 0,
												count: g.total,
											};
											printDialog = true;
										}}
										data-testid="print-class-cards"
										>{i18n.t("printing.list.print")}</Button
									>
								</Row>
							</Card>
						{/each}
					</Grid>
				{/each}
			</section>
		{/if}
	</QueryState>

	<ConfirmDialog
		open={newKind !== null}
		title={i18n.t(
			newKind === "items" ? "printing.lists.newItemsTitle" : "printing.lists.newPatronsTitle",
		)}
		confirmLabel={i18n.t(
			newKind === "items" ? "printing.lists.newItems" : "printing.lists.newPatrons",
		)}
		onconfirm={create}
		oncancel={() => (newKind = null)}
	>
		<Field label={i18n.t("printing.lists.name")}
			><Input
				bind:value={newName}
				placeholder={proposed}
				maxlength={80}
				data-testid="new-list-name"
			/></Field
		>
	</ConfirmDialog>
	<ConfirmDialog
		open={confirmDelete !== null}
		title={i18n.t("printing.lists.deleteTitle", { name: confirmDelete?.name ?? "" })}
		description={i18n.t("printing.lists.deleteDescription")}
		tone="error"
		confirmLabel={i18n.t("common.actions.delete")}
		onconfirm={remove}
		oncancel={() => (confirmDelete = null)}
	/>
	<CardPrintDialog
		bind:open={printDialog}
		query={printing ? `group=${printing.groupId}` : ""}
		count={printing?.count}
		markGroupId={printing?.groupId}
	/>
</Page>
