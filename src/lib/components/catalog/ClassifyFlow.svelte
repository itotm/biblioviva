<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- One book of the classification flow (step 9.21, Q117): what helps to classify it (cover,
     title, author, publisher, series, subjects, notes, the class its Dewey number points to), the
     classification choice of the record form, the call number its copies will get, then
     "Salva e avanti" (the next book still to classify) or "Salta". -->
<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import { getClassificationOptions } from "#lib/remote/catalog.remote.js";
	import {
		classifyRecord,
		getClassifyTarget,
		previewClassifiedCallNumber,
	} from "#lib/remote/classify.remote.js";
	import { formatSeries } from "#lib/shared/series.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import ClassificationPicker from "./ClassificationPicker.svelte";
	import { coversOn } from "#lib/ui/features.js";

	interface Props {
		id: number;
	}

	const { id }: Props = $props();
	const i18n = useI18n();
	const SaveIcon = icons.confirm;
	const SkipIcon = icons.moveDown;
	const ListIcon = icons.lists;
	// svelte-ignore state_referenced_locally
	const target = getClassifyTarget(id);
	const options = getClassificationOptions();

	let kind = $state<"fiction" | "nonfiction" | "">("fiction");
	let genreCode = $state("");
	let classCode = $state("");
	let readingLevel = $state("");
	let proposed = false;
	let issues = $state<string[]>([]);
	let busy = $state(false);
	let ended = $state(false);

	// the class of the Dewey number is proposed once, when the record arrives
	$effect(() => {
		const t = target.current;
		if (t && !proposed) {
			proposed = true;
			if (t.deweyClass) {
				kind = "nonfiction";
				classCode = t.deweyClass;
			}
		}
	});

	const chosen = $derived(
		kind !== "" && (kind === "fiction" ? genreCode !== "" : classCode !== ""),
	);
	const callNumber = $derived(
		chosen && kind !== ""
			? previewClassifiedCallNumber({ id, kind, genreCode, classCode, readingLevel })
			: null,
	);

	async function save(): Promise<void> {
		const t = target.current;
		if (!t || kind === "") {
			return;
		}
		busy = true;
		try {
			const r = await classifyRecord({ id, kind, genreCode, classCode, readingLevel });
			if (!r.ok) {
				issues = r.issues;
				return;
			}
			toaster.success({ title: i18n.t("catalog.toClassify.flow.saved", { title: t.title }) });
			await next(r.next);
		} finally {
			busy = false;
		}
	}

	async function next(nextId: number | null): Promise<void> {
		if (nextId === null) {
			ended = true;
			return;
		}
		await goto(resolve(`catalog/to-classify/${nextId}`));
	}
</script>

{#if ended}
	<EmptyState title={i18n.t("catalog.toClassify.flow.end")} icon="toClassify">
		{#snippet action()}
			<Button variant="primary" icon={ListIcon} href="/catalog/to-classify"
				>{i18n.t("catalog.toClassify.flow.backToList")}</Button
			>
		{/snippet}
	</EmptyState>
{:else if target.current && options.current}
	{@const t = target.current}
	<Card padding="lg" gap="3" as="section" data-testid="classify-record">
		<div class="flex gap-4">
			{#if t.hasCover && coversOn()}
				<img
					src="/media/covers/{t.id}/main"
					alt=""
					class="h-32 w-auto shrink-0 rounded-container object-contain"
				/>
			{/if}
			<Row column gap="1" align="start" class="min-w-0">
				<h2 class="text-xl font-bold" data-testid="classify-title">
					<a href={resolve(`catalog/${t.id}`)} class="anchor">{t.title}</a>
				</h2>
				{#if t.subtitle}<p class="opacity-80">{t.subtitle}</p>{/if}
				<p>
					{t.author} · {t.publisher}{t.publicationYear ? `, ${t.publicationYear}` : ""}
				</p>
				{#if t.series}
					<p class="text-sm">{formatSeries(t.series, t.seriesNumber)}</p>
				{/if}
				<Hint>
					{#if t.isbn}ISBN {t.isbn} ·
					{/if}{i18n.t("catalog.toClassify.flow.copies", {
						count: t.copies,
					})}
				</Hint>
			</Row>
		</div>
		{#if t.subjects.length}
			<p class="text-sm">
				<strong>{i18n.t("catalog.toClassify.flow.subjects")}:</strong>
				{t.subjects.join(", ")}
			</p>
		{/if}
		{#if t.notes}
			<p class="text-sm">
				<strong>{i18n.t("catalog.toClassify.flow.notes")}:</strong>
				{t.notes}
			</p>
		{/if}
	</Card>

	{#if t.classified}
		<Alert tone="success" role="status">{i18n.t("catalog.toClassify.flow.already")}</Alert>
	{:else}
		<Card padding="lg" gap="4" as="section">
			{#if t.deweyClass && t.dewey}
				<Hint tone="soft" data-testid="classify-dewey">
					{i18n.t("catalog.toClassify.flow.dewey", {
						dewey: t.dewey,
						code: t.deweyClass,
					})}
				</Hint>
			{/if}
			<ClassificationPicker
				options={options.current}
				bind:kind
				bind:genreCode
				bind:classCode
				bind:readingLevel
			/>
			{#if callNumber?.current}
				<div data-testid="classify-call-number">
					<p>
						<span class="label-text"
							>{i18n.t("catalog.toClassify.flow.callNumber")}:</span
						>
						<strong class="font-mono">{callNumber.current}</strong>
					</p>
					<Hint>{i18n.t("catalog.toClassify.flow.callNumberHint")}</Hint>
				</div>
			{/if}
			{#if issues.length}
				<Alert tone="error" role="alert">
					{issues.join(" · ")}
				</Alert>
			{/if}
		</Card>
	{/if}

	<Row>
		{#if !t.classified}
			<Button
				variant="primary"
				icon={SaveIcon}
				onclick={save}
				disabled={busy || !chosen}
				data-testid="classify-save">{i18n.t("catalog.toClassify.flow.saveNext")}</Button
			>
		{/if}
		<Button
			icon={SkipIcon}
			onclick={() => next(t.next)}
			disabled={busy}
			data-testid="classify-skip">{i18n.t("catalog.toClassify.flow.skip")}</Button
		>
		<Button icon={ListIcon} href="/catalog/to-classify"
			>{i18n.t("catalog.toClassify.flow.backToList")}</Button
		>
	</Row>
{/if}
