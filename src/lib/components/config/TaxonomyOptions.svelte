<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The options of the classification (step 11.1): fiction filed by reading level with the scale of
     levels (Phase 12.6: code printed in the call number, label shown; a level in use that goes away
     asks where its books move on save), the level on each copy instead of the record (Q72; moving
     it is checked on save), and the call number patterns with an example built from the draft. New
     patterns apply to the copies added from now on; existing call numbers are not rewritten. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { suggestCallNumber } from "#lib/shared/classification.js";
	import { CALL_NUMBER_PLACEHOLDERS, unknownPlaceholders } from "#lib/shared/taxonomy.js";
	import Card from "#lib/ui/Card.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import type { TaxonomyEditor } from "./taxonomy-editor.svelte.js";

	interface Props {
		editor: TaxonomyEditor;
		/** The flag as saved (the note about moving the classes shows when it changes). */
		savedClassPerItem: boolean;
	}

	const { editor, savedClassPerItem }: Props = $props();
	const AddIcon = icons.add;
	const RemoveIcon = icons.delete;
	const UpIcon = icons.moveUp;
	const DownIcon = icons.moveDown;
	const i18n = useI18n();
	const PATTERNS = ["fiction", "fictionWithClass", "nonfiction"] as const;

	const scheme = $derived(editor.draft);
	const firstClass = $derived(
		editor.draft.nonfiction.flatMap((n) => [n.code, ...n.children.map((c) => c.code)])[0] ?? "",
	);
	function example(pattern: (typeof PATTERNS)[number]): string {
		const fiction = pattern !== "nonfiction";
		return suggestCallNumber(scheme, {
			kind: fiction ? "fiction" : "nonfiction",
			genreCode: fiction ? (editor.draft.genres[0]?.code ?? "") : null,
			classCode: fiction ? null : firstClass,
			readingLevel:
				pattern === "fictionWithClass"
					? (editor.draft.readingLevels[3]?.code ??
						editor.draft.readingLevels[0]?.code ??
						"4")
					: null,
			author: fiction ? "Delitto, Anna" : "Rossi, Anna",
			title: fiction ? "La casa segreta" : "Gli animali della fattoria",
		});
	}
</script>

<Card gap="4" data-testid="taxonomy-options">
	<div class="space-y-1">
		<Checkbox bind:checked={editor.fictionByClass} data-testid="option-fiction-by-class"
			>{i18n.t("config.taxonomy.options.fictionByClass")}</Checkbox
		>
		<Hint tone="faint">{i18n.t("config.taxonomy.options.fictionByClassHint")}</Hint>
	</div>
	{#if editor.fictionByClass}
		<section class="space-y-2" data-testid="reading-levels">
			<h3 class="font-semibold">{i18n.t("config.taxonomy.levels.title")}</h3>
			<Hint tone="faint">{i18n.t("config.taxonomy.levels.hint")}</Hint>
			{#each editor.readingLevels as level, index (level.key)}
				{@const problems = editor.levelIssues[level.key] ?? []}
				<Row align="center" data-testid="reading-level-row">
					<Input
						mono
						class="w-24"
						bind:value={level.code}
						aria-label={i18n.t("config.taxonomy.levels.code")}
						aria-invalid={problems.some((p) => p.startsWith("code")) || undefined}
						data-testid="reading-level-code"
					/>
					<Input
						class="grow"
						bind:value={level.label}
						aria-label={i18n.t("config.taxonomy.levels.label")}
						aria-invalid={problems.some((p) => p.startsWith("label")) || undefined}
						data-testid="reading-level-label"
					/>
					<IconButton
						icon={UpIcon}
						label={i18n.t("config.taxonomy.levels.up")}
						disabled={index === 0}
						onclick={() => editor.moveLevel(level.key, -1)}
					/>
					<IconButton
						icon={DownIcon}
						label={i18n.t("config.taxonomy.levels.down")}
						disabled={index === editor.readingLevels.length - 1}
						onclick={() => editor.moveLevel(level.key, 1)}
					/>
					<IconButton
						icon={RemoveIcon}
						label={i18n.t("config.taxonomy.levels.remove")}
						onclick={() => editor.removeLevel(level.key)}
						data-testid="reading-level-remove"
					/>
				</Row>
				{#each problems as p (p)}
					<Hint tone="error">{i18n.t(`config.taxonomy.problems.${p}`)}</Hint>
				{/each}
			{/each}
			<Button
				variant="tonal"
				icon={AddIcon}
				onclick={() => editor.addLevel()}
				data-testid="reading-level-add">{i18n.t("config.taxonomy.levels.add")}</Button
			>
		</section>
	{/if}
	<div class="space-y-1">
		<Checkbox bind:checked={editor.classPerItem} data-testid="option-class-per-item"
			>{i18n.t("config.taxonomy.options.classPerItem")}</Checkbox
		>
		<Hint tone="faint">{i18n.t("config.taxonomy.options.classPerItemHint")}</Hint>
		{#if editor.classPerItem !== savedClassPerItem}
			<Hint tone="primary" data-testid="option-class-per-item-note"
				>{i18n.t(
					editor.classPerItem
						? "config.taxonomy.options.toCopies"
						: "config.taxonomy.options.toRecords",
				)}</Hint
			>
		{/if}
	</div>
	<h3 class="font-semibold">{i18n.t("config.taxonomy.options.patterns")}</h3>
	<Hint tone="faint">
		{i18n.t("config.taxonomy.options.patternsHint", {
			// escaped: the message format would read `{{genre}}` as a placeholder of its own
			placeholders: CALL_NUMBER_PLACEHOLDERS.map((p) => `\\{\\{${p}\\}\\}`).join(" "),
		})}
	</Hint>
	{#each PATTERNS as key (key)}
		{@const unknown = unknownPlaceholders(editor.callNumber[key])}
		<Field
			label={i18n.t(`config.taxonomy.options.pattern.${key}`)}
			errors={editor.callNumber[key].trim() === ""
				? [i18n.t("config.taxonomy.problems.patternRequired")]
				: []}
			name="pattern-{key}"
		>
			<Input mono bind:value={editor.callNumber[key]} data-testid="pattern-{key}" />
			{#snippet after()}
				{#if unknown.length > 0}
					<Hint tone="error"
						>{i18n.t("config.taxonomy.options.unknownPlaceholders", {
							names: unknown.join(", "),
						})}</Hint
					>
				{/if}
				<Hint tone="faint" data-testid="pattern-example-{key}"
					>{i18n.t("config.taxonomy.options.example", { example: example(key) })}</Hint
				>
			{/snippet}
		</Field>
	{/each}
</Card>
