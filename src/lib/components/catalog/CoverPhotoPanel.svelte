<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Photographing a cover (step 3.7, 9.13 round 6): the camera opens at once, full screen on a
     phone, in portrait. On the record page (`biblioId`) the straightened cover is uploaded as the
     record's cover; in the fast-add form (no record yet) it is handed to `oncover`, which keeps it
     until the record is saved. The capture (and OpenCV behind it) loads only when the panel opens. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { uploadCover } from "#lib/remote/catalog.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { submitFile } from "#lib/ui/submit-file.js";
	import CameraStage from "../CameraStage.svelte";

	interface Props {
		/** The record whose cover is uploaded; without it the picture goes to `oncover`. */
		biblioId?: number;
		/** The app's `covers.width`. */
		width: number;
		/** The cover was uploaded (with `biblioId`). */
		onsaved?: () => void;
		/** The picture taken, when there is no record to upload it to. */
		oncover?: (file: File) => void | Promise<void>;
		oncancel: () => void;
	}

	const { biblioId, width, onsaved, oncover, oncancel }: Props = $props();
	const i18n = useI18n();
	const coverForm = $derived(biblioId === undefined ? null : uploadCover.for(String(biblioId)));
	const coverError = $derived(coverForm?.fields.cover.issues()?.[0]?.message);
	let coverInput = $state<HTMLInputElement>();

	async function onCover(file: File): Promise<void> {
		if (!coverForm) {
			await oncover?.(file);
			return;
		}
		if (await submitFile(coverForm, coverInput, file)) {
			onsaved?.();
		}
	}
</script>

<CameraStage data-testid="cover-panel" onclose={oncancel}>
	<Row wrap={false} align="center" justify="between">
		<h2 class="h4">{i18n.t("catalog.cover.title")}</h2>
	</Row>
	{#await import("./CoverCapture.svelte") then { default: CoverCapture }}
		<CoverCapture
			oncover={onCover}
			{oncancel}
			{width}
			autostart
			pending={(coverForm?.pending ?? 0) > 0}
		/>
	{/await}
	{#if coverError}
		<Alert data-testid="cover-error">{coverError}</Alert>
	{/if}
	{#if coverForm && biblioId !== undefined}
		<form
			{...coverForm}
			enctype="multipart/form-data"
			class="hidden"
			aria-hidden="true"
			data-testid="cover-form"
		>
			<input {...coverForm.fields.id.as("hidden", String(biblioId))} />
			<input {...coverForm.fields.cover.as("file")} bind:this={coverInput} />
		</form>
	{/if}
</CameraStage>
