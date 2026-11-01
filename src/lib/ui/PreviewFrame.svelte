<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A rendered label or spine band shown in a sandboxed frame at its size in mm (96 px per inch,
     times the zoom the document was rendered at); scrolls when wider than its container. -->
<script lang="ts">
	interface Props {
		html: string;
		title: string;
		widthMm: number;
		heightMm: number;
		zoom?: number;
		"data-testid"?: string;
	}

	const { html, title, widthMm, heightMm, zoom = 1, ...rest }: Props = $props();
	const PX_PER_MM = 96 / 25.4;
</script>

<!-- focusable: when the document is wider than the page, the keyboard can scroll it (axe:
     scrollable-region-focusable) -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="overflow-auto" role="region" aria-label={title} tabindex="0">
	<iframe
		{title}
		sandbox=""
		srcdoc={html}
		style="width:{widthMm * PX_PER_MM * zoom}px;height:{heightMm * PX_PER_MM * zoom}px"
		class="block border border-surface-200 bg-white"
		{...rest}
	></iframe>
</div>
