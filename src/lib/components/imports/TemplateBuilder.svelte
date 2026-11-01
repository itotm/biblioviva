<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Il modello del file" (step 9.19, Q115): the columns of an import by group — the required ones
     ticked and locked, the keys with what happens when they are left out, the optional ones — and,
     when a requirement can be given in more ways (the class of a student), the choice between them.
     The download carries the chosen headers; the browser remembers the choice. -->
<script lang="ts" generics="F extends string">
	import type { ResolvedPathname } from "$app/types";
	import { useI18n } from "#lib/i18n/context.js";
	import type { ColumnGroup } from "#lib/shared/import-columns.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import TitleHint from "#lib/ui/TitleHint.svelte";
	import { icons } from "#lib/ui/icons.js";

	interface Column {
		field: F;
		header: string;
		group: ColumnGroup;
		label: string;
		hint?: string;
		/** For a key: what happens when the file leaves it out. */
		missing?: string;
	}
	interface Props {
		columns: readonly Column[];
		/** Ways to give a required value (students: `class`, or `level` + `section`). */
		alternatives?: readonly { fields: readonly F[]; label: string }[];
		alternativesLabel?: string;
		/** The download address for a list of headers (`…/template.csv?columns=a,b`). */
		href: (headers: string) => ResolvedPathname;
		/** Where the browser keeps the choice. */
		storageKey: string;
	}

	const {
		columns,
		alternatives = [],
		alternativesLabel = "",
		href,
		storageKey,
	}: Props = $props();
	const i18n = useI18n();
	const DownloadIcon = icons.download;

	function remembered(): { optional: F[]; alternative: number } {
		try {
			const raw = localStorage.getItem(storageKey);
			const parsed = raw ? (JSON.parse(raw) as { optional?: F[]; alternative?: number }) : {};
			return { optional: parsed.optional ?? [], alternative: parsed.alternative ?? 0 };
		} catch {
			return { optional: [], alternative: 0 };
		}
	}
	const initial = remembered();
	let chosen = $state<F[]>(initial.optional);
	// svelte-ignore state_referenced_locally
	let alternative = $state(Math.min(initial.alternative, Math.max(0, alternatives.length - 1)));

	$effect(() => {
		try {
			localStorage.setItem(storageKey, JSON.stringify({ optional: chosen, alternative }));
		} catch {
			// private windows and blocked storage: the choice is simply not remembered
		}
	});

	const inAlternatives = $derived(new Set(alternatives.flatMap((a) => a.fields)));
	const required = $derived(
		columns.filter((c) => c.group === "required" && !inAlternatives.has(c.field)),
	);
	const optional = $derived(columns.filter((c) => c.group !== "required"));
	const headers = $derived(
		columns
			.filter(
				(c) =>
					(c.group === "required" &&
						(!inAlternatives.has(c.field) ||
							(alternatives[alternative]?.fields ?? []).includes(c.field))) ||
					(c.group !== "required" && chosen.includes(c.field)),
			)
			.map((c) => c.header),
	);

	function toggle(field: F, on: boolean): void {
		chosen = on
			? [...chosen.filter((f) => f !== field), field]
			: chosen.filter((f) => f !== field);
	}
</script>

{#snippet columnRow(c: Column, locked: boolean)}
	<Checkbox
		checked={locked || chosen.includes(c.field)}
		disabled={locked}
		onchange={(e) => toggle(c.field, e.currentTarget.checked)}
		data-testid="template-column-{c.header}"
	>
		<TitleHint title="{c.label} · {c.header}"
			>{[
				c.hint ?? "",
				c.missing ? i18n.t("common.import.template.ifMissing", { text: c.missing }) : "",
			]
				.filter(Boolean)
				.join(" ")}</TitleHint
		>
	</Checkbox>
{/snippet}

<Card gap="4" as="section" data-testid="template-builder">
	<h2 class="font-semibold">{i18n.t("common.import.template.title")}</h2>
	<Hint>{i18n.t("common.import.template.hint")}</Hint>
	<fieldset class="space-y-2">
		<legend class="label-text">{i18n.t("common.import.template.required")}</legend>
		{#each required as c (c.field)}
			{@render columnRow(c, true)}
		{/each}
		{#if alternatives.length}
			<fieldset class="space-y-1" data-testid="template-alternatives">
				<legend class="text-sm font-semibold">{alternativesLabel}</legend>
				{#each alternatives as alt, i (i)}
					<Row wrap={false} align="start" as="label">
						<input
							type="radio"
							class="mt-1 radio"
							name="{storageKey}-alternative"
							checked={alternative === i}
							onchange={() => (alternative = i)}
							data-testid="template-alternative-{i}"
						/>
						<span>{alt.label}</span>
					</Row>
				{/each}
			</fieldset>
		{/if}
	</fieldset>
	{#each ["key", "optional"] as const as group (group)}
		{@const list = optional.filter((c) => c.group === group)}
		{#if list.length}
			<fieldset class="space-y-2">
				<legend class="label-text"
					>{i18n.t(
						`common.import.template.${group === "key" ? "keys" : "optional"}`,
					)}</legend
				>
				{#if group === "key"}<Hint>{i18n.t("common.import.template.keysHint")}</Hint>{/if}
				{#each list as c (c.field)}
					{@render columnRow(c, false)}
				{/each}
			</fieldset>
		{/if}
	{/each}
	<Row>
		<Button
			icon={DownloadIcon}
			href={href(headers.join(","))}
			download
			data-testid="template-download">{i18n.t("common.import.template.download")}</Button
		>
		<code class="text-xs break-all opacity-70" data-testid="template-preview"
			>{headers.join(";")}</code
		>
	</Row>
</Card>
