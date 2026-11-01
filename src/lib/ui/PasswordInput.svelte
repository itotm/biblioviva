<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A password field with the eye button that shows what was typed (9.13, round 15): hidden by
     default, shown while the button is pressed on; every attribute passes through (remote-form
     spreads included, their `type` is replaced). -->
<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { useI18n } from "#lib/i18n/context.js";
	import { ICON_SIZE, icons } from "./icons.js";

	interface Props extends HTMLInputAttributes {
		/**
		 * The field's name for assistive technology: inside a `Field` the label also holds the eye
		 * button, whose text would otherwise join the input's name.
		 */
		label: string;
		class?: string;
	}

	let {
		label: fieldLabel,
		class: className = "",
		value = $bindable(),
		type: _type,
		...rest
	}: Props = $props();
	const i18n = useI18n();
	const ShowIcon = icons.view;
	const HideIcon = icons.hide;
	let visible = $state(false);
	const label = $derived(
		visible ? i18n.t("common.password.hide") : i18n.t("common.password.show"),
	);
</script>

<div class="relative {className}">
	<input
		class="input pr-12"
		bind:value
		{...rest}
		aria-label={fieldLabel}
		type={visible ? "text" : "password"}
	/>
	<button
		type="button"
		class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-base text-surface-600 transition-colors hover:bg-surface-200 hover:text-surface-950"
		aria-label={label}
		title={label}
		aria-pressed={visible}
		onclick={() => (visible = !visible)}
		data-testid="password-toggle"
	>
		{#if visible}
			<HideIcon size={ICON_SIZE.md} aria-hidden="true" />
		{:else}
			<ShowIcon size={ICON_SIZE.md} aria-hidden="true" />
		{/if}
	</button>
</div>
