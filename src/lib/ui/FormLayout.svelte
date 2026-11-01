<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Sections of fields with a sticky save bar; inline validation is done by the fields themselves (§3.18). -->
<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		/** Field sections: use <FormLayout.Section> markup (a <fieldset> with a legend) inside. */
		children: Snippet;
		/** Save/cancel buttons; rendered in a bar that sticks to the bottom on phones. */
		actions?: Snippet;
		/** Error summary shown above the fields. */
		errors?: Snippet;
		onsubmit?: (event: SubmitEvent) => void;
		/** Anything else (e.g. a spread remote `form`) goes onto the <form> element. */
		[attribute: string]: unknown;
	}

	const { children, actions, errors, onsubmit, ...rest }: Props = $props();
</script>

<form {...rest} class="space-y-6" {onsubmit} novalidate data-testid="form-layout">
	{#if errors}
		<div role="alert">{@render errors()}</div>
	{/if}
	<div class="space-y-6">{@render children()}</div>
	{#if actions}
		<div
			class="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t border-surface-200 bg-surface-50/95 p-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0"
		>
			{@render actions()}
		</div>
	{/if}
</form>
