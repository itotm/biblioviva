<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The genres, or the non-fiction classes with their subclasses, in the classification editor
     (step 11.1): one row per node with its pictogram, code, name and how many books use it; a
     click opens it in the side panel. Rows are reordered by drag and drop or with the arrow
     buttons (keyboard and touch); a subclass dropped on a class moves under it. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import type { CodeUsage, TaxonomyKind } from "#lib/shared/taxonomy.js";
	import Badge from "#lib/ui/Badge.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import PictogramThumb from "./PictogramThumb.svelte";
	import type { EditLeaf, EditNode, TaxonomyEditor } from "./taxonomy-editor.svelte.js";

	interface Props {
		editor: TaxonomyEditor;
		kind: TaxonomyKind;
		/** Records and copies per saved code. */
		usage: Record<string, CodeUsage>;
	}

	const { editor, kind, usage }: Props = $props();
	const i18n = useI18n();
	const GripIcon = icons.drag;
	const MoveIcon = icons.more;
	const ProblemIcon = icons.damaged;

	let dragging = $state<string | null>(null);
	let over = $state<{ key: string; after: boolean } | null>(null);

	function dragOver(e: DragEvent & { currentTarget: HTMLElement }, key: string): void {
		if (dragging === null) {
			return;
		}
		e.preventDefault();
		const box = e.currentTarget.getBoundingClientRect();
		over = { key, after: e.clientY > box.top + box.height / 2 };
	}

	function drop(e: DragEvent, key: string): void {
		e.preventDefault();
		if (dragging !== null) {
			editor.drop(dragging, key, over?.after ?? false);
		}
		dragging = null;
		over = null;
	}

	const usageOf = (node: EditLeaf): CodeUsage | null =>
		node.originalCode === null ? null : (usage[node.originalCode] ?? null);
	const marker = (key: string): string =>
		over?.key !== key
			? ""
			: over.after
				? "shadow-[inset_0_-3px_0_var(--color-primary-500)]"
				: "shadow-[inset_0_3px_0_var(--color-primary-500)]";
</script>

{#snippet row(node: EditLeaf, parent: EditNode | null, index: number, count: number)}
	{@const selected = editor.selected === node.key}
	{@const used = usageOf(node)}
	<li
		class="flex items-center gap-1 rounded-container border-2 p-1 transition-colors {selected
			? 'border-primary-500 bg-primary-50'
			: 'border-transparent hover:border-surface-200 hover:bg-surface-50'} {parent
			? 'ml-6 md:ml-10'
			: ''} {marker(node.key)}"
		draggable="true"
		ondragstart={(e) => {
			dragging = node.key;
			e.dataTransfer?.setData("text/plain", node.key);
		}}
		ondragend={() => {
			dragging = null;
			over = null;
		}}
		ondragover={(e) => dragOver(e, node.key)}
		ondragleave={() => {
			if (over?.key === node.key) {
				over = null;
			}
		}}
		ondrop={(e) => drop(e, node.key)}
		data-testid="taxonomy-node"
		data-code={node.code}
	>
		<GripIcon size={ICON_SIZE.sm} class="shrink-0 cursor-grab opacity-40" aria-hidden="true" />
		<button
			type="button"
			class="flex min-w-0 flex-1 items-center gap-3 rounded-base p-1 text-left"
			aria-current={selected ? "true" : undefined}
			onclick={() => (editor.selected = node.key)}
			data-testid="taxonomy-node-open"
		>
			<PictogramThumb
				code={node.code}
				image={node.image ?? parent?.image ?? null}
				color={node.color ?? parent?.color ?? null}
				size={parent ? "sm" : "md"}
			/>
			<span class="font-mono text-sm opacity-80">{node.code || "—"}</span>
			<span class="min-w-0 truncate font-semibold"
				>{node.label || i18n.t("config.taxonomy.untitled")}</span
			>
			{#if editor.problems[node.key]}
				<ProblemIcon
					size={ICON_SIZE.sm}
					class="shrink-0 text-error-600"
					aria-hidden="true"
				/>
				<span class="sr-only">{i18n.t("config.taxonomy.hasProblems")}</span>
			{/if}
		</button>
		{#if used && used.records > 0}
			<Badge class="hidden sm:inline-flex" data-testid="taxonomy-node-usage"
				>{i18n.t("config.taxonomy.usageShort", { records: used.records })}</Badge
			>
		{/if}
		<IconButton
			icon={MoveIcon}
			label={i18n.t("config.taxonomy.moveUp")}
			size="sm"
			class="[&>svg]:rotate-180"
			disabled={index === 0}
			onclick={() => editor.move(node.key, -1)}
		/>
		<IconButton
			icon={MoveIcon}
			label={i18n.t("config.taxonomy.moveDown")}
			size="sm"
			disabled={index === count - 1}
			onclick={() => editor.move(node.key, 1)}
		/>
	</li>
{/snippet}

<ul class="space-y-1" data-testid="taxonomy-list-{kind}">
	{#if kind === "fiction"}
		{#each editor.genres as node, i (node.key)}
			{@render row(node, null, i, editor.genres.length)}
		{/each}
	{:else}
		{#each editor.nonfiction as node, i (node.key)}
			{@render row(node, null, i, editor.nonfiction.length)}
			{#each node.children as child, j (child.key)}
				{@render row(child, node, j, node.children.length)}
			{/each}
		{/each}
	{/if}
</ul>
