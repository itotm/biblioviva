<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The segnatura a copy gets, shown and not typed (Q143): its label, the value in large type
     and a hint; in the copy dialogs and in the record form. -->
<script lang="ts">
	import CodeText from "#lib/ui/CodeText.svelte";
	import Hint from "#lib/ui/Hint.svelte";

	interface Props {
		label: string;
		value: string;
		hint: string;
		testid: string;
	}

	const { label, value, hint, testid }: Props = $props();
</script>

<div class="space-y-1" data-testid={testid}>
	<span class="label-text">{label}</span>
	<CodeText>{value}</CodeText>
	<Hint as="span">{hint}</Hint>
</div>
