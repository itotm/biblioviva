<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The classification of a record as a badge: pictogram, code and label (§3.17). -->
<script lang="ts">
	import { pictogramSrc } from "#lib/shared/classification.js";

	interface Props {
		node: { code: string; label: string; image?: string | null; color?: string | null } | null;
		/** Shown after the label for fiction with a reading level (its code). */
		readingLevel?: string | null;
		size?: "sm" | "md";
	}

	const { node, readingLevel = null, size = "sm" }: Props = $props();
	const px = $derived(size === "md" ? 28 : 20);
</script>

{#if node}
	<span
		class="inline-flex items-center gap-1.5 rounded-full border border-surface-200 bg-surface-50 py-0.5 pr-2.5 pl-0.5 font-semibold {size ===
		'md'
			? 'text-base'
			: 'text-sm'}"
		data-testid="classification-badge"
	>
		<img
			src={pictogramSrc(node)}
			alt=""
			width={px}
			height={px}
			class="rounded-full"
			style="width: {px}px; height: {px}px"
		/>
		<span class="font-mono">{node.code}</span>
		<span class="font-normal">{node.label}</span>
		{#if readingLevel}
			<span class="rounded-full bg-primary-100 px-1.5 text-primary-800">{readingLevel}</span>
		{/if}
	</span>
{/if}
