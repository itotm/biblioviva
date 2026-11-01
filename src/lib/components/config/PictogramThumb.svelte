<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A pictogram in the classification editor (step 11.1): the node's image (a saved file or an
     upload not saved yet), else — or when the file cannot be loaded — a disc with its colour and
     code like the placeholder the labels print. Subclasses pass the image and colour they inherit. -->
<script lang="ts">
	import { draftImageSrc } from "#lib/shared/taxonomy.js";

	interface Props {
		code: string;
		image: string | null;
		color: string | null;
		size?: "sm" | "md" | "lg";
	}

	const { code, image, color, size = "md" }: Props = $props();
	const SIZE = {
		sm: "size-8 text-[0.6rem]",
		md: "size-10 text-xs",
		lg: "size-20 text-xl",
	} as const;
	const src = $derived(image ? draftImageSrc(image) : null);
	/** The last source that failed to load (a file named in the configuration but missing). */
	let failed = $state<string | null>(null);
</script>

{#if src && src !== failed}
	<img
		{src}
		onerror={() => (failed = src)}
		alt=""
		class="{SIZE[size]} shrink-0 rounded-full object-contain"
		data-testid="pictogram-image"
	/>
{:else}
	<span
		class="{SIZE[
			size
		]} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-surface-800 font-bold text-white [text-shadow:0_0_2px_#1f2937]"
		style="background-color: {color ?? '#64748b'}"
		aria-hidden="true"
		data-testid="pictogram-placeholder">{code.slice(0, 4)}</span
	>
{/if}
