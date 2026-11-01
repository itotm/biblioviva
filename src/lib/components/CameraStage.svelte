<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The stage of a camera flow (census, stocktaking): full screen on a phone, so the camera and
     what it read fill the screen and the work goes on one-handed; an ordinary card from md up. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLElement> {
		children: Snippet;
	}

	const { children, ...rest }: Props = $props();
</script>

<section
	{...rest}
	class="fixed inset-0 z-50 flex flex-col gap-3 overflow-y-auto bg-surface-50 p-4 md:static md:z-auto md:rounded-container md:border md:border-surface-200 md:shadow-[var(--bv-shadow-card)]"
>
	{@render children()}
</section>
