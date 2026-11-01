<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Classification picker (§3.17, step 3.1): kind toggle, genre tiles with pictograms (plus the
     associated class when the flag is on), two-level non-fiction tiles with breadcrumb, and with
     `allowLater` the choice "Classifica dopo" (kind `""`, step 9.21). It edits plain values; the
     surrounding form carries them in hidden inputs. -->
<script lang="ts">
	import Legend from "#lib/ui/Legend.svelte";
	import ToggleButton from "#lib/ui/ToggleButton.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import SegmentedGroup from "#lib/ui/SegmentedGroup.svelte";
	import SelectCard from "#lib/ui/SelectCard.svelte";
	import { pictogramSrc } from "#lib/shared/classification.js";

	interface Leaf {
		code: string;
		label: string;
		image: string | null;
		color: string | null;
	}
	interface Node extends Leaf {
		children: Leaf[];
	}
	interface Options {
		fictionByClass: boolean;
		classPerItem: boolean;
		readingLevels: { code: string; label: string }[];
		genres: Leaf[];
		nonfiction: Node[];
	}
	interface Props {
		options: Options;
		/** `""`: classified later, the record waits in the list of books to classify. */
		kind: "fiction" | "nonfiction" | "";
		genreCode: string;
		classCode: string;
		readingLevel: string;
		/** Offer "Classifica dopo" (the record forms; never the classification flow itself). */
		allowLater?: boolean;
	}

	let {
		options,
		kind = $bindable(),
		genreCode = $bindable(),
		classCode = $bindable(),
		readingLevel = $bindable(),
		allowLater = false,
	}: Props = $props();
	const i18n = useI18n();
	const BackIcon = icons.back;
	const CheckIcon = icons.confirm;

	// the parent whose children are shown; derived from the selection when a child is picked
	let openParent = $state<string | null>(null);
	const parentOf = $derived(
		options.nonfiction.find((n) => n.children.some((c) => c.code === classCode))?.code ?? null,
	);
	const shownParent = $derived(openParent ?? parentOf);
	const parentNode = $derived(options.nonfiction.find((n) => n.code === shownParent) ?? null);
	const showReadingLevel = $derived(
		kind === "fiction" && options.fictionByClass && !options.classPerItem,
	);

	const kinds = $derived(
		allowLater
			? (["fiction", "nonfiction", ""] as const)
			: (["fiction", "nonfiction"] as const),
	);

	function pickKind(next: "fiction" | "nonfiction" | ""): void {
		kind = next;
		if (next !== "nonfiction") {
			classCode = "";
		}
		if (next !== "fiction") {
			genreCode = "";
			readingLevel = "";
		}
	}
</script>

{#snippet tile(node: Leaf, selected: boolean, onclick: () => void, testid: string)}
	<SelectCard
		{selected}
		role="radio"
		row
		padding="2"
		class="whitespace-normal"
		{onclick}
		data-testid={testid}
	>
		<img
			src={pictogramSrc(node)}
			alt=""
			width="40"
			height="40"
			class="size-10 shrink-0 rounded-full"
		/>
		<span class="min-w-0">
			<span class="block font-mono text-sm opacity-70">{node.code}</span>
			<span class="block leading-tight font-semibold break-words">{node.label}</span>
		</span>
		{#if selected}<CheckIcon
				size={ICON_SIZE.md}
				class="ml-auto shrink-0 text-primary-700"
				aria-hidden="true"
			/>{/if}
	</SelectCard>
{/snippet}

<div class="space-y-4" data-testid="classification-picker">
	<fieldset>
		<legend class="mb-1 label-text">{i18n.t("catalog.picker.kind")}</legend>
		<SegmentedGroup
			fit
			radio
			size="md"
			options={kinds.map((k) => ({
				value: k,
				label: i18n.t(`catalog.picker.${k || "later"}`),
				testid: `kind-${k || "later"}`,
			}))}
			value={kind}
			onselect={pickKind}
		/>
	</fieldset>

	{#if kind === ""}
		<Hint tone="soft" data-testid="classify-later-hint"
			>{i18n.t("catalog.picker.laterHint")}</Hint
		>
	{:else if kind === "fiction"}
		<fieldset>
			<Legend>{i18n.t("catalog.picker.genre")}</Legend>
			<Grid cols="auto" gap="2" role="radiogroup">
				{#each options.genres as g (g.code)}
					{@render tile(
						g,
						genreCode === g.code,
						() => (genreCode = g.code),
						`genre-${g.code}`,
					)}
				{/each}
			</Grid>
		</fieldset>
		{#if showReadingLevel}
			<fieldset>
				<legend class="mb-1 label-text">{i18n.t("catalog.picker.readingLevel")}</legend>
				<SegmentedGroup
					fit
					radio
					options={[
						{
							value: "",
							label: i18n.t("catalog.picker.anyClass"),
							testid: "reading-level-none",
						},
						...options.readingLevels.map((l) => ({
							value: l.code,
							label: l.label,
							testid: `reading-level-${l.code}`,
						})),
					]}
					value={readingLevel}
					onselect={(code) => (readingLevel = code)}
				/>
			</fieldset>
		{/if}
	{:else}
		<fieldset>
			<Legend>
				{#if parentNode}
					{i18n.t("catalog.picker.children", { label: parentNode.label })}
				{:else}
					{i18n.t("catalog.picker.class")}
				{/if}
			</Legend>
			{#if parentNode}
				<Row align="center" class="mb-2">
					<Button
						size="sm"
						icon={BackIcon}
						onclick={() => {
							openParent = null;
							if (parentOf) {
								classCode = "";
							}
						}}
						data-testid="picker-back">{i18n.t("catalog.picker.back")}</Button
					>
					<ToggleButton
						pressed={classCode === parentNode.code}
						outlined
						onclick={() => (classCode = parentNode.code)}
						data-testid="picker-parent-{parentNode.code}"
					>
						{i18n.t("catalog.picker.parentOnly", { label: parentNode.label })}
					</ToggleButton>
				</Row>
				<Grid cols="auto" gap="2" role="radiogroup">
					{#each parentNode.children as c (c.code)}
						{@render tile(
							c,
							classCode === c.code,
							() => (classCode = c.code),
							`class-${c.code}`,
						)}
					{/each}
				</Grid>
			{:else}
				<Grid cols="auto" gap="2" role="radiogroup">
					{#each options.nonfiction as n (n.code)}
						{@render tile(
							n,
							classCode === n.code,
							() => {
								if (n.children.length > 0) {
									openParent = n.code;
									if (
										classCode !== n.code &&
										!n.children.some((c) => c.code === classCode)
									) {
										classCode = n.code;
									}
								} else {
									classCode = n.code;
								}
							},
							`class-${n.code}`,
						)}
					{/each}
				</Grid>
			{/if}
		</fieldset>
	{/if}
</div>
