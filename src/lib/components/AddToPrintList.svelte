<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Aggiungi alla lista" (step 2.8): a button that opens a dialog to put entities into an existing
     print list or a new one. Used by the patron list (selection), the patron page, the catalogue
     (records: every copy, step 3.8), the record page and the fast-add summary. Without its button
     (`trigger={false}`) a page opens the dialog itself, from an entry of its header menu (`bind:open`). -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { addToList, getPrintLists } from "#lib/remote/print-lists.remote.js";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import { useFormat } from "#lib/ui/format.js";
	import { proposedListName } from "#lib/ui/list-name.js";
	import ConfirmDialog from "./ConfirmDialog.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";

	interface Props {
		entityIds?: number[];
		/** Item lists: every copy of these records. */
		biblioIds?: number[];
		kind?: "patrons" | "items";
		label?: string;
		size?: "md" | "sm";
		disabled?: boolean;
		/** Shows its own button (false: the page opens the dialog through `open`). */
		trigger?: boolean;
		open?: boolean;
	}

	let {
		entityIds = [],
		biblioIds = [],
		kind = "patrons",
		label,
		size = "md",
		disabled = false,
		trigger = true,
		open = $bindable(false),
	}: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const ListIcon = icons.lists;
	let target = $state<"existing" | "new">("existing");
	let listId = $state<number | "">("");
	let newName = $state("");
	const lists = $derived(open ? getPrintLists() : null);
	const candidates = $derived((lists?.current?.lists ?? []).filter((l) => l.kind === kind));
	/** The name of the new list when none is typed: "Lista 3 del 29/10/2026" (owner). */
	const proposed = $derived(
		proposedListName(
			(lists?.current?.lists ?? []).map((l) => l.name),
			(n, date) => i18n.t("printing.lists.defaultName", { n, date }),
			fmt,
		),
	);

	// every opening starts afresh, once the lists are known: an existing list when there is one
	// (a new list only by choice), the first of them, no name typed
	let prepared = false;
	$effect(() => {
		if (!open) {
			prepared = false;
			return;
		}
		if (prepared || !lists?.current) {
			return;
		}
		prepared = true;
		target = candidates.length === 0 ? "new" : "existing";
		listId = candidates[0]?.id ?? "";
		newName = "";
	});

	/** Adds the entries; false (the dialog stays open) when they could not be added. */
	async function confirm(): Promise<boolean> {
		const name = newName.trim() || proposed;
		const r = await addToList(
			target === "new" || listId === ""
				? { newName: name, kind, entityIds, biblioIds }
				: { listId, entityIds, biblioIds },
		);
		if (!r.ok) {
			toaster.error({ title: i18n.t("printing.addTo.newName") });
			return false;
		}
		toaster.success({
			title: i18n.t("printing.addTo.done", {
				added: r.added,
				skipped: r.skipped.length,
				name:
					target === "new" ? name : (candidates.find((l) => l.id === listId)?.name ?? ""),
			}),
		});
		newName = "";
		return true;
	}
</script>

{#if trigger}
	<Button
		{size}
		icon={ListIcon}
		onclick={() => (open = true)}
		disabled={disabled || (entityIds.length === 0 && biblioIds.length === 0)}
		data-testid="add-to-list">{label ?? i18n.t("printing.addTo.button")}</Button
	>
{/if}

<ConfirmDialog
	bind:open
	title={i18n.t("printing.addTo.title")}
	confirmLabel={i18n.t("printing.addTo.confirm")}
	onconfirm={confirm}
>
	<div class="space-y-3" data-testid="add-to-list-dialog">
		{#if candidates.length > 0}
			<Row wrap={false} align="center" as="label">
				<input type="radio" class="radio" value="existing" bind:group={target} />
				<span>{i18n.t("printing.addTo.existing")}</span>
			</Row>
			<Select
				bind:value={listId}
				disabled={target !== "existing"}
				data-testid="add-to-list-select"
			>
				{#each candidates as l (l.id)}
					<option value={l.id}
						>{l.name} ({i18n.t("printing.lists.count", { count: l.count })})</option
					>
				{/each}
			</Select>
		{/if}
		<Row wrap={false} align="center" as="label">
			<input type="radio" class="radio" value="new" bind:group={target} />
			<span>{i18n.t("printing.addTo.create")}</span>
		</Row>
		<Input
			placeholder={proposed}
			bind:value={newName}
			disabled={target !== "new"}
			maxlength={80}
			aria-label={i18n.t("printing.addTo.newName")}
			data-testid="add-to-list-name"
		/>
	</div>
</ConfirmDialog>
