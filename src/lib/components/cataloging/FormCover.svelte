<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The cover block of the fast-add form (9.13, round 11): the cover found or photographed, what
     it is, and the camera to take (or replace) it; stored when the record is saved. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import CoverPhotoPanel from "#lib/components/catalog/CoverPhotoPanel.svelte";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import MediaCard from "#lib/ui/MediaCard.svelte";
	import Spinner from "#lib/ui/Spinner.svelte";
	import type { CoverChoiceState } from "./cover-choice.svelte.js";

	interface Props {
		choice: CoverChoiceState;
		/** The app's `covers.width`. */
		width: number;
	}

	const { choice, width }: Props = $props();
	const i18n = useI18n();
	const BookIcon = icons.book;
	const CameraIcon = icons.camera;
	const RemoveIcon = icons.delete;
	const cover = $derived(choice.cover);
</script>

<MediaCard
	title={i18n.t("catalog.fastAdd.cover.title")}
	status={choice.search === "searching"
		? i18n.t("catalog.fastAdd.cover.searching")
		: cover?.name
			? i18n.t("catalog.fastAdd.cover.found", { provider: cover.name })
			: cover
				? i18n.t("catalog.fastAdd.cover.photo")
				: choice.search === "none"
					? i18n.t("catalog.fastAdd.cover.none")
					: i18n.t("catalog.fastAdd.cover.empty")}
	statusTestId="form-cover-status"
	data-testid="form-cover"
>
	{#snippet media()}
		{#if cover}
			<img
				src={cover.dataUrl}
				alt={i18n.t("catalog.fastAdd.cover.alt")}
				class="h-28 w-auto max-w-20 rounded-base object-contain shadow"
				data-testid="form-cover-image"
			/>
		{:else}
			<div
				class="flex h-28 w-20 items-center justify-center rounded-base bg-surface-200 text-surface-500"
				aria-hidden="true"
			>
				{#if choice.search === "searching"}
					<Spinner />
				{:else}
					<BookIcon size={ICON_SIZE.lg} />
				{/if}
			</div>
		{/if}
	{/snippet}
	{#snippet actions()}
		<Button
			size="sm"
			variant={cover ? "tonal" : "primary"}
			icon={CameraIcon}
			onclick={() => (choice.camera = true)}
			data-testid="form-cover-photo"
			>{cover
				? i18n.t("catalog.fastAdd.cover.replace")
				: i18n.t("catalog.fastAdd.cover.take")}</Button
		>
		{#if cover}
			<Button
				size="sm"
				icon={RemoveIcon}
				onclick={() => choice.clear()}
				data-testid="form-cover-remove">{i18n.t("catalog.fastAdd.cover.remove")}</Button
			>
		{/if}
	{/snippet}
</MediaCard>
{#if choice.camera}
	<CoverPhotoPanel
		{width}
		oncover={(file) => choice.fromPhoto(file)}
		oncancel={() => (choice.camera = false)}
	/>
{/if}
