<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The scheme of the segnatura in two questions (Q143), in the first-run wizard and in the
     classification page: the order (genre and level, level and genre, genre only, free) and the
     end (the author's initials computed, editable per title, nothing), with examples computed
     from the choice. Without reading levels the orders with the level are not offered. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import {
		CALL_NUMBER_ENDS,
		CALL_NUMBER_ORDERS,
		callNumberScheme,
		suggestCallNumber,
		type CallNumberEnd,
		type CallNumberOrder,
	} from "#lib/shared/classification.js";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Select from "#lib/ui/Select.svelte";

	interface Props {
		order: CallNumberOrder;
		end: CallNumberEnd;
		/** Fiction is filed by reading level: the orders with the level are offered. */
		levels: boolean;
		/** Codes for the examples (the first genre, a level, a non-fiction class). */
		example?: { genre: string; level: string; classCode: string };
		/** The saved patterns match no order and end (written by hand in the classification page). */
		custom?: boolean;
		testid?: string;
	}

	let {
		order = $bindable(),
		end = $bindable(),
		levels,
		example = { genre: "B", level: "4", classCode: "590" },
		custom = false,
		testid = "call-number-scheme",
	}: Props = $props();
	const i18n = useI18n();

	const orders = $derived(
		CALL_NUMBER_ORDERS.filter((o) => levels || o === "genre" || o === "free"),
	);
	const scheme = $derived({
		callNumber: callNumberScheme(levels || order === "free" ? order : "genre", end),
	});
	const examples = $derived(
		[
			...(levels && order !== "free"
				? [
						{
							kind: "fiction",
							genreCode: example.genre,
							readingLevel: example.level,
							classCode: null,
						},
					]
				: []),
			{ kind: "fiction", genreCode: example.genre, readingLevel: null, classCode: null },
			{
				kind: "nonfiction",
				genreCode: null,
				readingLevel: null,
				classCode: example.classCode,
			},
		]
			.map((p) =>
				suggestCallNumber(scheme, {
					...p,
					author: p.kind === "fiction" ? "Delitto, Anna" : "Rossi, Anna",
					title: "",
				}),
			)
			.filter(Boolean),
	);
</script>

<div class="space-y-2" data-testid={testid}>
	<Grid from="sm" gap="3">
		<Field
			label={i18n.t("catalog.callNumberScheme.order")}
			hint={i18n.t("catalog.callNumberScheme.orderHint")}
		>
			<Select
				value={custom ? "" : order}
				onchange={(e) => (order = e.currentTarget.value as CallNumberOrder)}
				data-testid="{testid}-order"
			>
				{#if custom}
					<option value="" disabled>{i18n.t("catalog.callNumberScheme.custom")}</option>
				{/if}
				{#each orders as o (o)}
					<option value={o}>{i18n.t(`catalog.callNumberScheme.orders.${o}`)}</option>
				{/each}
			</Select>
		</Field>
		{#if order !== "free" && !custom}
			<Field label={i18n.t("catalog.callNumberScheme.end")}>
				<Select bind:value={end} data-testid="{testid}-end">
					{#each CALL_NUMBER_ENDS as e (e)}
						<option value={e}>{i18n.t(`catalog.callNumberScheme.ends.${e}`)}</option>
					{/each}
				</Select>
			</Field>
		{/if}
	</Grid>
	<Hint data-testid="{testid}-examples">
		{custom
			? i18n.t("catalog.callNumberScheme.customHint")
			: order === "free"
				? i18n.t("catalog.callNumberScheme.freeHint")
				: i18n.t("catalog.callNumberScheme.examples", { examples: examples.join(" · ") })}
	</Hint>
</div>
