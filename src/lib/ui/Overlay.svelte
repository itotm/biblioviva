<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A layer over the whole of its positioned parent that lets the pointer through: the camera's
     framing guides, the designer's grid. An SVG drawn over a picture takes the same `overlay-fill`
     class of app.css directly (an SVG cannot be wrapped in a component). -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLDivElement> {
		children?: Snippet;
	}

	const { children, ...rest }: Props = $props();
</script>

<div class="overlay-fill pointer-events-none" {...rest}>{@render children?.()}</div>
