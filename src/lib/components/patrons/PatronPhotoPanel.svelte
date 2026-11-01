<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Photographing a patron (steps 2.3–2.4): the camera or a file, the picture sent through the
     hidden photo form of that patron, the form's error under it. The caller draws the container
     and the heading (the patron page's panel, the census stage). -->
<script lang="ts">
	import { uploadPhoto } from "#lib/remote/patrons.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import { submitFile } from "#lib/ui/submit-file.js";
	import PhotoCapture from "./PhotoCapture.svelte";

	interface Props {
		patronId: number;
		/** Start with the camera open (the census) or with the two buttons. */
		autostart?: boolean;
		oncancel?: () => void;
		/** After the photo is saved. */
		onsaved: () => void | Promise<void>;
		errorTestid?: string;
		formTestid?: string;
	}

	const {
		patronId,
		autostart = false,
		oncancel,
		onsaved,
		errorTestid = "photo-error",
		formTestid,
	}: Props = $props();
	const photoForm = $derived(uploadPhoto.for(String(patronId)));
	const photoError = $derived(photoForm.fields.photo.issues()?.[0]?.message);
	let photoInput = $state<HTMLInputElement>();
	let capture = $state<PhotoCapture>();

	async function onPhoto(file: File): Promise<void> {
		if (await submitFile(photoForm, photoInput, file)) {
			await onsaved();
		}
	}

	/** Back to the start: the camera again (autostart) or the two buttons. */
	export function reset(): void {
		capture?.reset();
	}
</script>

<PhotoCapture
	bind:this={capture}
	{autostart}
	onphoto={onPhoto}
	{oncancel}
	pending={photoForm.pending > 0}
/>
{#if photoError}
	<Alert data-testid={errorTestid}>
		{photoError}
	</Alert>
{/if}
<form
	{...photoForm}
	enctype="multipart/form-data"
	class="hidden"
	aria-hidden="true"
	data-testid={formTestid}
>
	<input {...photoForm.fields.id.as("hidden", String(patronId))} />
	<input {...photoForm.fields.photo.as("file")} bind:this={photoInput} />
</form>
