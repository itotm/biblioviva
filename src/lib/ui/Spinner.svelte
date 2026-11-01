<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The turning icon of a wait, always next to a text that says what is going on (`wait`: the large
     one of the wait overlay). -->
<script lang="ts">
	import { ICON_SIZE, icons } from "./icons.js";

	interface Props {
		size?: "md" | "lg" | "wait";
	}

	const { size = "md" }: Props = $props();
	const LoadingIcon = icons.loading;
</script>

<!-- the large one turns slower: a whole turn a second looks frantic at that size -->
<LoadingIcon
	size={ICON_SIZE[size]}
	class="{size === 'wait'
		? 'animate-[spin_1.8s_linear_infinite]'
		: 'animate-spin'} text-primary-500"
	aria-hidden="true"
/>
