<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Fast add, the code is already in the catalogue (step 3.6): the record found, how many copies
     it has, and the choice between adding copies to it, opening it or scanning another book. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import type { ExistingRecord } from "./fast-add.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		existing: ExistingRecord;
		/** How many copies to add. */
		copies: number;
		busy: boolean;
		issues: readonly { field: string; message: string }[];
		onadd: () => void;
		onback: () => void;
	}

	let { existing, copies = $bindable(), busy, issues, onadd, onback }: Props = $props();
	const i18n = useI18n();
	const BookIcon = icons.book;
	const AddIcon = icons.add;
	const BackIcon = icons.back;
</script>

<Card padding="lg" gap="4" as="section" data-testid="stage-duplicate">
	<h2 class="h4">{i18n.t("catalog.fastAdd.duplicate.heading")}</h2>
	<Row align="start" gap="4" class="rounded-lg bg-surface-50 p-4">
		<span class="rounded-full bg-primary-50 p-3 text-primary-500">
			<BookIcon size={ICON_SIZE.xl} aria-hidden="true" />
		</span>
		<div class="min-w-0 flex-1">
			<p class="text-lg font-semibold" data-testid="duplicate-title">
				{existing.title}
			</p>
			<p class="opacity-80">
				{existing.author} · {existing.publisher}{existing.publicationYear
					? `, ${existing.publicationYear}`
					: ""}
			</p>
			<p class="mt-1 text-sm font-semibold text-primary-700" data-testid="duplicate-copies">
				{i18n.t("catalog.fastAdd.duplicate.copies", { count: existing.copies })}
			</p>
		</div>
	</Row>
	<Row align="end" gap="3">
		<Field label={i18n.t("catalog.fastAdd.form.copies")} class="w-32"
			><Input
				type="number"
				min={1}
				max={100}
				bind:value={copies}
				data-testid="duplicate-count"
			/></Field
		>
		<Button
			variant="primary"
			icon={AddIcon}
			disabled={busy}
			onclick={onadd}
			data-testid="duplicate-add">{i18n.t("catalog.fastAdd.duplicate.addCopy")}</Button
		>
		<Button href="/catalog/{existing.id}">{i18n.t("catalog.fastAdd.duplicate.open")}</Button>
		<Button icon={BackIcon} onclick={onback} data-testid="duplicate-back"
			>{i18n.t("catalog.fastAdd.duplicate.another")}</Button
		>
	</Row>
	{#each issues as issue (issue.field)}
		<p class="text-error-700" role="alert">{issue.message}</p>
	{/each}
</Card>
