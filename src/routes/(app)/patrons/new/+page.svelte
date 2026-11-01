<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- New patron (step 2.1): the form and, next to it, the photo (9.13, round 11: taken before the
     save like the cover of a new book, stored once the patron exists, then the patron opens). -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { goto } from "$app/navigation";
	import { useI18n } from "#lib/i18n/context.js";
	import { createPatron, savePhotoData } from "#lib/remote/patrons.remote.js";
	import CameraStage from "#lib/components/CameraStage.svelte";
	import PhotoCapture from "#lib/components/patrons/PhotoCapture.svelte";
	import { photosOn } from "#lib/ui/features.js";
	import PatronForm from "#lib/components/patrons/PatronForm.svelte";
	import Button from "#lib/ui/Button.svelte";
	import MediaCard from "#lib/ui/MediaCard.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Page from "#lib/ui/Page.svelte";
	import { toaster } from "#lib/ui/toaster.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";

	const { data } = $props();
	const i18n = useI18n();
	const CameraIcon = icons.camera;
	const RemoveIcon = icons.delete;
	const NoPhotoIcon = icons.noPhoto;

	let photo = $state<string | null>(null);
	let camera = $state(false);
	let saving = $state(false);

	async function onPhoto(file: File): Promise<void> {
		photo = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () =>
				typeof reader.result === "string"
					? resolve(reader.result)
					: reject(new Error("read"));
			reader.onerror = () => reject(new Error("read"));
			reader.readAsDataURL(file);
		});
		camera = false;
	}

	// the remote form keeps its last result for the whole visit: only a new one counts
	const previousResult = createPatron.result;
	$effect(() => {
		const r = createPatron.result;
		if (r && r !== previousResult && !saving) {
			saving = true;
			void finish(r.id);
		}
	});

	async function finish(id: number): Promise<void> {
		if (photo) {
			const data = photo.slice(photo.indexOf(",") + 1);
			const ok = await savePhotoData({ id, data }).then(
				(r) => r.ok,
				() => false,
			);
			if (!ok) {
				toaster.error({ title: i18n.t("patrons.photo.notSaved") });
			}
		}
		await goto(resolve(`patrons/${id}`));
	}
</script>

<Page width="md">
	<PageHeader
		title={i18n.t("patrons.form.createTitle")}
		icon="patron"
		backHref="/patrons"
		backLabel={i18n.t("common.actions.back")}
	/>
	<!-- the photo, left out while photos are switched off (9.38) -->
	{#if photosOn()}
		<MediaCard
			class="mb-4"
			title={i18n.t("patrons.photo.title")}
			status={photo
				? i18n.t("patrons.photo.withForm")
				: data.photoRequired
					? i18n.t("patrons.photo.requiredHint")
					: i18n.t("patrons.photo.optionalHint")}
			statusTestId="new-photo-status"
			data-testid="new-photo"
		>
			{#snippet media()}
				{#if photo}
					<img
						src={photo}
						alt={i18n.t("patrons.photo.title")}
						class="h-28 w-21 rounded-base object-cover shadow"
						data-testid="new-photo-image"
					/>
				{:else}
					<div
						class="flex h-28 w-21 items-center justify-center rounded-base bg-surface-200 text-surface-500"
						aria-hidden="true"
					>
						<NoPhotoIcon size={ICON_SIZE.lg} />
					</div>
				{/if}
			{/snippet}
			{#snippet actions()}
				<Button
					size="sm"
					variant={photo ? "tonal" : "primary"}
					icon={CameraIcon}
					onclick={() => (camera = true)}
					data-testid="new-photo-take"
					>{photo
						? i18n.t("patrons.photo.retakePhoto")
						: i18n.t("patrons.photo.take")}</Button
				>
				{#if photo}
					<Button
						size="sm"
						icon={RemoveIcon}
						onclick={() => (photo = null)}
						data-testid="new-photo-remove">{i18n.t("patrons.photo.remove")}</Button
					>
				{/if}
			{/snippet}
		</MediaCard>
		{#if camera}
			<CameraStage data-testid="photo-panel">
				<h2 class="h4">{i18n.t("patrons.photo.title")}</h2>
				<PhotoCapture
					onphoto={onPhoto}
					oncancel={() => (camera = false)}
					width={data.photoWidth}
					height={data.photoHeight}
					autostart
				/>
			</CameraStage>
		{/if}
	{/if}
	<PatronForm
		form={createPatron}
		rules={data.rules}
		submitLabel={i18n.t("patrons.form.create")}
		cancelHref="/patrons"
	/>
</Page>
