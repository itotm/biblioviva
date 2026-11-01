<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The ordered entries of a print list (step 2.8): each row with its position, its content (the
     caller's snippet: a copy or a patron), the arrows up and down and the removal; rows reorder by
     dragging one onto another. -->
<script lang="ts" generics="T extends { entityId: number }">
	import type { Snippet } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { moveInList, removeFromList, reorderList } from "#lib/remote/print-lists.remote.js";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import DividedList from "#lib/ui/DividedList.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		listId: number;
		/** The rows shown, in their order. */
		rows: readonly T[];
		/** A change of the list is running: the buttons wait. */
		busy: boolean;
		/** Runs a change of the list, marking the page busy meanwhile. */
		run: <R>(fn: () => Promise<R>) => Promise<R | undefined>;
		entry: Snippet<[T]>;
	}

	const { listId, rows, busy, run, entry }: Props = $props();
	const i18n = useI18n();
	const UpIcon = icons.more;
	const RemoveIcon = icons.close;
	let dragging = $state<number | null>(null);
	let dragOver = $state<number | null>(null);

	async function remove(entityId: number): Promise<void> {
		await run(() => removeFromList({ listId, entityIds: [entityId] }));
		toaster.info({ title: i18n.t("printing.list.removed") });
	}

	async function move(entityId: number, direction: "up" | "down"): Promise<void> {
		await run(() => moveInList({ listId, entityId, direction }));
	}

	async function drop(targetId: number): Promise<void> {
		const from = dragging;
		dragging = null;
		dragOver = null;
		if (from === null || from === targetId) {
			return;
		}
		const ids = rows.map((r) => r.entityId).filter((id) => id !== from);
		const at = ids.indexOf(targetId);
		ids.splice(at === -1 ? ids.length : at, 0, from);
		await run(() => reorderList({ listId, orderedIds: ids }));
	}
</script>

<Hint tone="faint">{i18n.t("printing.list.dragHint")}</Hint>
<DividedList ordered data-testid="list-entries">
	{#each rows as r, i (r.entityId)}
		{@const id = r.entityId}
		<li
			class="flex flex-wrap items-center gap-2 py-2 {dragOver === id ? 'bg-primary-50' : ''}"
			draggable="true"
			ondragstart={() => (dragging = id)}
			ondragover={(e) => {
				e.preventDefault();
				dragOver = id;
			}}
			ondragleave={() => (dragOver = null)}
			ondrop={() => drop(id)}
			data-testid="entry-{id}"
		>
			<span class="w-8 text-center font-mono text-sm opacity-60">{i + 1}</span>
			{@render entry(r)}
			<Row wrap={false} gap="1" as="span" class="ml-auto">
				<IconButton
					icon={UpIcon}
					label={i18n.t("printing.list.moveUp")}
					variant="tonal"
					size="sm"
					class="[&>svg]:rotate-180"
					onclick={() => move(id, "up")}
					disabled={busy || i === 0}
				/>
				<IconButton
					icon={UpIcon}
					label={i18n.t("printing.list.moveDown")}
					variant="tonal"
					size="sm"
					onclick={() => move(id, "down")}
					disabled={busy || i === rows.length - 1}
				/>
				<IconButton
					icon={RemoveIcon}
					label={i18n.t("printing.list.remove")}
					variant="error"
					size="sm"
					onclick={() => remove(id)}
					disabled={busy}
					data-testid="remove-entry-{id}"
				/>
			</Row>
		</li>
	{/each}
</DividedList>
