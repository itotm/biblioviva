<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The page outside the app's frame (the login, the change of a password due, 9.51): its cards in
     the middle of the window on the soft gradient of the primary colour. -->
<script lang="ts">
	import type { Snippet } from "svelte";

	const { children }: { children: Snippet } = $props();
</script>

<main
	class="flex min-h-svh flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary-100 via-surface-100 to-surface-100 p-4"
>
	{@render children()}
</main>
