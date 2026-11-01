<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The buttons under a picture capture (covers, patron photos): the camera action (open the
     camera, or take the shot), the upload of a file and, when the caller allows it, cancel. -->
<script lang="ts">
	import { icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import FileButton from "#lib/ui/FileButton.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		shootLabel: string;
		shootTestid: string;
		onshoot: () => void;
		shootDisabled?: boolean;
		uploadLabel: string;
		uploadTestid: string;
		onfile: (e: Event) => void;
		cancelLabel: string;
		oncancel?: () => void;
	}

	const {
		shootLabel,
		shootTestid,
		onshoot,
		shootDisabled = false,
		uploadLabel,
		uploadTestid,
		onfile,
		cancelLabel,
		oncancel,
	}: Props = $props();
</script>

<Row>
	<Button
		variant="primary"
		icon={icons.camera}
		onclick={onshoot}
		disabled={shootDisabled}
		data-testid={shootTestid}>{shootLabel}</Button
	>
	<FileButton icon={icons.upload} accept="image/*" onchange={onfile} data-testid={uploadTestid}
		>{uploadLabel}</FileButton
	>
	{#if oncancel}<Button onclick={oncancel}>{cancelLabel}</Button>{/if}
</Row>
