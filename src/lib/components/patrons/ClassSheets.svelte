<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	"Da un'immagine con più foto" on the census page of a class or a list (PLAN.md step 13.3): its
	pictures, newest first, and the upload — a file, or the phone's camera through the file input's
	`capture`. The picture is drawn upright and scaled in the browser, sent, and its page opens,
	where the photos are found. With the demo data loaded, while a photo is missing, the two sample
	pictures can be tried: a scan (the frames are rectangles, turned at most) and a photo taken at
	an angle (9.26).
-->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { goto } from "$app/navigation";
	import { tick } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { submitFile } from "#lib/ui/submit-file.js";
	import { useFormat } from "#lib/ui/format.js";
	import { getClassSheets, uploadClassSheet } from "#lib/remote/class-sheets.remote.js";
	import { icons } from "#lib/ui/icons.js";
	import { uprightJpeg } from "#lib/vision/picture.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import FileButton from "#lib/ui/FileButton.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Spinner from "#lib/ui/Spinner.svelte";
	import TitleHint from "#lib/ui/TitleHint.svelte";

	interface Props {
		set: { group: number } | { list: number };
		/** `photos.sheet.maxPixels`: the longest side sent. */
		maxPixels: number;
		/** Offer the demo's sample pictures: demo data loaded, a photo missing (Q109). */
		samples?: boolean;
	}

	const { set, maxPixels, samples = false }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const PictureIcon = icons.classPicture;
	const UploadIcon = icons.upload;
	const CameraIcon = icons.camera;
	const ScanIcon = icons.scanned;
	const sheets = $derived(getClassSheets(set));
	const target = $derived("list" in set ? `list:${set.list}` : `group:${set.group}`);
	let busy = $state(false);
	let failure = $state("");
	let pictureInput = $state<HTMLInputElement>();
	/** The kind the picture sent starts as (a photo, or the demo's sample of a scan). */
	let kind = $state<"photo" | "scan">("photo");
	const issue = $derived(uploadClassSheet.fields.picture.issues()?.[0]?.message);

	/**
	 * Sends a picture; `asIs` keeps its bytes (the demo's sample, which the public demo recognises
	 * by them and is upright already), every other one is drawn upright and scaled first.
	 */
	async function send(
		file: Blob,
		asIs = false,
		sampleKind: "photo" | "scan" = "photo",
	): Promise<void> {
		if (!pictureInput) {
			return;
		}
		busy = true;
		failure = "";
		kind = sampleKind;
		// the hidden field takes the kind before the form is read
		await tick();
		try {
			let upright = file;
			if (!asIs) {
				try {
					upright = await uprightJpeg(file, maxPixels);
				} catch {
					// a format the browser cannot draw: the server says what is wrong with it
				}
			}
			const ok = await submitFile(
				uploadClassSheet,
				pictureInput,
				new File([upright], "picture.jpg", { type: upright.type }),
			);
			const id = uploadClassSheet.result?.id;
			if (ok && id) {
				await goto(resolve(`census/sheets/${id}`));
			}
		} finally {
			busy = false;
		}
	}

	async function onFile(e: Event): Promise<void> {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (file) {
			await send(file);
		}
	}

	/** A sample of the demo: it opens as the kind it shows. */
	async function tryDemo(sample: "photo" | "scan"): Promise<void> {
		const response = await fetch(`/media/demo/class-picture?kind=${sample}`);
		if (!response.ok) {
			failure = i18n.t("common.status.error");
			return;
		}
		await send(await response.blob(), true, sample);
	}
</script>

<Card gap="3" as="section" data-testid="class-sheets">
	<h2 class="h4">{i18n.t("patrons.census.sheets.title")}</h2>
	<Hint>{i18n.t("patrons.census.sheets.hint")}</Hint>
	<Row>
		<FileButton
			icon={UploadIcon}
			accept="image/*"
			onchange={onFile}
			disabled={busy}
			data-testid="sheet-upload">{i18n.t("patrons.census.sheets.upload")}</FileButton
		>
		<FileButton
			icon={CameraIcon}
			accept="image/*"
			capture="environment"
			onchange={onFile}
			disabled={busy}
			class="md:hidden"
			data-testid="sheet-take">{i18n.t("patrons.census.sheets.take")}</FileButton
		>
		{#if samples}
			<Button
				icon={ScanIcon}
				onclick={() => tryDemo("scan")}
				disabled={busy}
				data-testid="sheet-demo-scan">{i18n.t("patrons.census.sheets.demoScan")}</Button
			>
			<Button
				icon={PictureIcon}
				onclick={() => tryDemo("photo")}
				disabled={busy}
				data-testid="sheet-demo-photo">{i18n.t("patrons.census.sheets.demoPhoto")}</Button
			>
		{/if}
	</Row>
	{#if samples}
		<Hint data-testid="sheet-demo-hint">{i18n.t("patrons.census.sheets.demoHint")}</Hint>
	{/if}
	{#if busy}
		<Row wrap={false} align="center" as="p" aria-live="polite">
			<Spinner />
			<span>{i18n.t("patrons.census.sheets.uploading")}</span>
		</Row>
	{/if}
	{#if issue || failure}
		<Alert data-testid="sheet-upload-error">{issue || failure}</Alert>
	{/if}
	<form {...uploadClassSheet} enctype="multipart/form-data" class="hidden" aria-hidden="true">
		<input {...uploadClassSheet.fields.target.as("hidden", target)} />
		<input {...uploadClassSheet.fields.kind.as("hidden", kind)} />
		<input {...uploadClassSheet.fields.picture.as("file")} bind:this={pictureInput} />
	</form>

	{#if sheets.ready}
		{#if sheets.current.length === 0}
			<p class="text-sm opacity-70" data-testid="class-sheets-empty">
				{i18n.t("patrons.census.sheets.empty")}
			</p>
		{:else}
			<ul class="space-y-2" data-testid="class-sheets-list">
				{#each sheets.current as s (s.id)}
					<li>
						<a
							href={resolve(`census/sheets/${s.id}`)}
							class="flex items-center gap-3 card p-2 hover:bg-primary-50"
							data-testid="class-sheet-{s.id}"
						>
							<img
								src="/media/class-sheets/{s.id}"
								alt=""
								width="64"
								height="64"
								loading="lazy"
								class="h-16 w-16 shrink-0 rounded-base object-cover ring-1 ring-surface-200"
							/>
							<TitleHint
								class="min-w-0 grow"
								title={i18n.t("patrons.census.sheets.item", {
									date: fmt.date(s.createdAt, "medium"),
								})}
								>{s.detected
									? i18n.t("patrons.census.sheets.counts", {
											frames: s.frames,
											saved: s.saved,
											pending: s.pending,
										})
									: i18n.t("patrons.census.sheets.notDetected")}</TitleHint
							>
							<PictureIcon class="shrink-0 opacity-50" aria-hidden="true" />
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</Card>
