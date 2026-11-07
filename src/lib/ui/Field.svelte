<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A labelled form control (step 1.15): label, the control (children), optional hint and error
     messages. The control keeps its own attributes (remote-form `fields.x.as(...)` spreads or
     `bind:value`), so the same wrapper serves every form; the field ties the hint and the errors to
     it (`aria-describedby`, `aria-invalid`: WCAG 1.3.1, 3.3.1). -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import Hint from "./Hint.svelte";

	interface Props {
		label: string;
		hint?: string;
		/** Messages shown under the control (`data-testid="field-error-<name>"` when `name` is set). */
		errors?: readonly { message: string }[] | string[];
		name?: string;
		/** Span both columns of a two-column grid. */
		span?: boolean;
		class?: string;
		children: Snippet;
		/** Extra content between the control and the messages (quick-pick buttons…). */
		after?: Snippet;
	}

	const {
		label,
		hint,
		errors = [],
		name,
		span = false,
		class: className = "",
		children,
		after,
	}: Props = $props();
	const messages = $derived(errors.map((e) => (typeof e === "string" ? e : e.message)));
	const uid = $props.id();
	const describedBy = $derived(
		[hint ? `${uid}-hint` : "", ...messages.map((_, i) => `${uid}-error-${i}`)]
			.filter(Boolean)
			.join(" "),
	);

	/**
	 * The control inside the label gets the ids of the hint and the errors, and the invalid state
	 * (an attachment: it runs again when they change).
	 */
	function describe(label: HTMLLabelElement): void {
		const control = label.querySelector("input, select, textarea");
		if (!control) {
			return;
		}
		if (describedBy) {
			control.setAttribute("aria-describedby", describedBy);
		} else {
			control.removeAttribute("aria-describedby");
		}
		if (messages.length > 0) {
			control.setAttribute("aria-invalid", "true");
		} else {
			control.removeAttribute("aria-invalid");
		}
	}
</script>

<div class={[span ? "md:col-span-2" : "", className].filter(Boolean).join(" ")}>
	<label class="label" {@attach describe}>
		<span class="label-text">{label}</span>
		{@render children()}
	</label>
	{#if hint}<Hint as="span" class="block" id="{uid}-hint">{hint}</Hint>{/if}
	{#if after}{@render after()}{/if}
	{#each messages as message, i (message)}
		<Hint
			as="span"
			tone="error"
			class="block"
			id="{uid}-error-{i}"
			data-testid={name ? `field-error-${name}` : undefined}>{message}</Hint
		>
	{/each}
</div>
