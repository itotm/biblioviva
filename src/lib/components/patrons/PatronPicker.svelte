<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Patron quick search (steps 4.3, 5.2): an accessible combobox (arrow keys, Enter, Escape) with
     class and photo thumbnails. The census uses it to photograph one person without going through
     the class; `search` is the remote query of the page's permission. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { SEARCH_MIN_CHARS } from "#lib/shared/text.js";
	import { findPatronsAtDesk } from "#lib/remote/circulation.remote.js";
	import type { QuickPatron } from "#lib/server/services/patron-search.js";
	import PatronOptions from "./PatronOptions.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Input from "#lib/ui/Input.svelte";

	interface Props {
		onpick: (patron: QuickPatron) => void;
		/** The remote query to call (default: the desk's, permission `loans`). */
		search?: typeof findPatronsAtDesk;
		label?: string;
		testid?: string;
	}

	const { onpick, search = findPatronsAtDesk, label, testid = "desk-patron" }: Props = $props();
	const i18n = useI18n();
	const uid = $props.id();
	let q = $state("");
	let debounced = $state("");
	let active = $state(0);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const value = q;
		clearTimeout(timer);
		timer = setTimeout(() => {
			debounced = value.trim();
			active = 0;
		}, 200);
		return () => clearTimeout(timer);
	});
	const results = $derived(debounced.length >= SEARCH_MIN_CHARS ? search(debounced) : null);
	const rows = $derived(results?.current ?? []);
	const open = $derived(debounced.length >= SEARCH_MIN_CHARS);
	const activeId = $derived(rows[active] ? `${uid}-list-opt-${rows[active]?.id}` : undefined);

	function pick(patron: QuickPatron): void {
		q = "";
		debounced = "";
		onpick(patron);
	}

	function onkeydown(e: KeyboardEvent): void {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			active = Math.min(active + 1, rows.length - 1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (e.key === "Enter") {
			const row = rows[active];
			if (row) {
				e.preventDefault();
				pick(row);
			}
		} else if (e.key === "Escape") {
			q = "";
			debounced = "";
		}
	}
</script>

<div class="relative">
	<Field label={label ?? i18n.t("circulation.checkout.search")}>
		<Input
			bind:value={q}
			placeholder={i18n.t("circulation.checkout.searchPlaceholder")}
			role="combobox"
			aria-expanded={open}
			aria-controls="{uid}-list"
			aria-activedescendant={open ? activeId : undefined}
			autocomplete="off"
			{onkeydown}
			data-testid="{testid}-search"
		/>
	</Field>
	{#if open}
		<PatronOptions id="{uid}-list" {rows} {active} onpick={pick} testid="{testid}-results" />
	{/if}
</div>
