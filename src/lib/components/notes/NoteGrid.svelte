<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The grid of post-its (step 9.18): one column on phones, up to four on a wide desktop; the
     `bv-note-grid` class alternates the tilt of the notes. `narrow` for the strip of pinned notes. -->
<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		/** At most three columns (the pinned notes on the dashboard and the desk). */
		narrow?: boolean;
		"data-testid"?: string;
		children: Snippet;
	}

	const { narrow = false, children, ...rest }: Props = $props();
</script>

<ul
	class="bv-note-grid grid gap-5 sm:grid-cols-2 lg:grid-cols-3 {narrow ? '' : '2xl:grid-cols-4'}"
	{...rest}
>
	{@render children()}
</ul>
