<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A label with its control beside it, for toolbars and compact rows (the designer's grid and
     colour): `Field` puts the label above instead. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLLabelAttributes } from "svelte/elements";

	interface Props extends HTMLLabelAttributes {
		label: string;
		children: Snippet;
	}

	const { label, children, ...rest }: Props = $props();
</script>

<label class="inline-flex items-center gap-2" {...rest}>
	<span class="label-text">{label}</span>
	{@render children()}
</label>
