<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	Photos from a class picture (PLAN.md step 13.3, Q103–Q109): the first visit finds the photo
	frames in the browser (OpenCV.js, lazily loaded with its progress, like the cover capture) and
	sends their corners; the server straightens each one. Then a list of the photos, each with a
	drop-down of the class's or list's patrons — one patron per photo, one photo per patron, saved
	as drafts — and "Salva le foto" with a summary first. "Correggi riquadri" shows the frames on the
	picture: drag a corner, remove a frame, draw a missing one. Desktop: picture and list side by
	side; phone: the picture above the list. The kind and the corrections share one toolbar over the
	picture; saving and removing the sheet are the page's actions.
-->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { goto } from "$app/navigation";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		addSheetFrame,
		assignSheetFrame,
		deleteClassSheet,
		deleteSheetFrame,
		getClassSheet,
		ignoreSheetFrame,
		moveSheetFrame,
		saveClassSheet,
		setClassSheetKind,
		setSheetFrames,
	} from "#lib/remote/class-sheets.remote.js";
	import { getCensusGroups, getCensusList } from "#lib/remote/patrons.remote.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import SheetPicture from "#lib/components/patrons/SheetPicture.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Spinner from "#lib/ui/Spinner.svelte";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import { SHEET_KINDS, type SheetKind } from "#lib/shared/sheet-frames.js";
	import type { Quad } from "#lib/vision/dewarp.js";
	import { loadOpenCv, type LoadProgress } from "#lib/vision/loader.js";
	import VisionLoading from "#lib/components/VisionLoading.svelte";
	import { imageDataOf } from "#lib/vision/picture.js";
	import QueryState from "#lib/ui/QueryState.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const sheetQuery = $derived(getClassSheet(data.id));
	const view = $derived(sheetQuery.current);
	const SaveIcon = icons.save;
	const DeleteIcon = icons.delete;
	const FramesIcon = icons.frames;
	const AddFrameIcon = icons.addFrame;
	const IgnoreIcon = icons.ignore;
	const UndoIcon = icons.undo;
	const DoneIcon = icons.available;
	const CameraIcon = icons.camera;
	const KIND_ICONS = { photo: icons.camera, scan: icons.scanned } as const;
	const KIND_LABELS = {
		photo: "patrons.census.sheet.kindPhoto",
		scan: "patrons.census.sheet.kindScan",
	} as const;
	const KIND_HINTS = {
		photo: "patrons.census.sheet.kindPhotoHint",
		scan: "patrons.census.sheet.kindScanHint",
	} as const;

	let phase = $state<"idle" | "loading" | "detecting" | "failed">("idle");
	let attempted = false;
	let progress = $state<LoadProgress>({ loaded: 0, total: null });
	let mode = $state<"view" | "edit" | "draw">("view");
	let selected = $state<number | null>(null);
	let busy = $state(false);
	let confirmSave = $state(false);
	let confirmDelete = $state(false);
	let justSaved = $state(false);

	const set = $derived(view?.sheet.set);
	const backHref = $derived(
		set === undefined
			? resolve("census")
			: "list" in set
				? resolve(`census?list=${set.list}`)
				: resolve(`census?group=${set.group ?? "none"}`),
	);
	const members = $derived(new Map((view?.members ?? []).map((m) => [m.id, m])));
	const holder = $derived(new Map((view?.taken ?? []).map((t) => [t.patronId, t])));
	const nameOf = (id: number | null): string => {
		const m = id === null ? undefined : members.get(id);
		return m ? patronSortName(m) : "";
	};
	const frames = $derived(view?.sheet.frames ?? []);
	/** No frame given to anyone, ignored or saved yet: a change of kind looks for the photos again. */
	const untouched = $derived(frames.every((f) => f.state === "pending" && f.patronId === null));
	const withPhoto = $derived((view?.members ?? []).filter((m) => m.hasPhoto).length);
	const stillMissing = $derived((view?.members ?? []).filter((m) => !m.hasPhoto));

	// the first visit looks for the frames once
	$effect(() => {
		if (view && !view.sheet.detected && !attempted) {
			attempted = true;
			void detect(view.detection, view.sheet.kind);
		}
	});

	/** Finds the frames in the browser; `replace`: again, after the kind changed (none used yet). */
	async function detect(
		options: {
			minAspect: number;
			maxAspect: number;
			maxFrames: number;
		},
		kind: SheetKind,
		replace = false,
	): Promise<void> {
		phase = "loading";
		let cv;
		// the frame finder (and its geometry) loads with OpenCV, not with the page
		let frames;
		try {
			[cv, frames] = await Promise.all([
				loadOpenCv((p) => (progress = p)),
				import("#lib/vision/frames.js"),
			]);
		} catch {
			phase = "failed";
			return;
		}
		phase = "detecting";
		try {
			const img = new Image();
			img.src = `/media/class-sheets/${data.id}`;
			await img.decode();
			performance.mark("frames-detect-start");
			const found = frames.detectFrames(cv, imageDataOf(img), {
				...options,
				...(kind === "scan" ? frames.SCAN_DETECTION : {}),
			});
			performance.measure("frames-detect", "frames-detect-start");
			const r = await setSheetFrames({
				id: data.id,
				frames: found.map((f) => f.quad),
				replace,
			});
			if (!r.ok) {
				toaster.error({ title: r.message });
			}
			phase = "idle";
		} catch {
			phase = "failed";
		}
	}

	/** Runs a change; a refusal is explained in a toast. */
	async function change(run: () => Promise<{ ok: boolean; message?: string }>): Promise<boolean> {
		busy = true;
		try {
			const r = await run();
			if (!r.ok && r.message) {
				toaster.error({ title: r.message });
			}
			return r.ok;
		} finally {
			busy = false;
		}
	}

	const assign = (frame: number, value: string): Promise<boolean> =>
		change(() =>
			assignSheetFrame({ id: data.id, frame, patron: value === "" ? null : Number(value) }),
		);

	const ignore = (frame: number, ignored: boolean): Promise<boolean> =>
		change(() => ignoreSheetFrame({ id: data.id, frame, ignored }));

	async function onmove(frame: number, corners: Quad): Promise<void> {
		await change(() => moveSheetFrame({ id: data.id, frame, corners }));
	}

	async function onadd(corners: Quad): Promise<void> {
		if (await change(() => addSheetFrame({ id: data.id, corners }))) {
			mode = "edit";
		}
	}

	/**
	 * "Foto" or "Scansione": while no frame is given to anyone, ignored or saved, the photos are
	 * looked for again the way of the new kind; afterwards the frames are only reshaped.
	 */
	async function setKind(kind: SheetKind): Promise<void> {
		if (!view || view.sheet.kind === kind) {
			return;
		}
		const again = untouched;
		const detection = view.detection;
		if ((await change(() => setClassSheetKind({ id: data.id, kind }))) && again) {
			selected = null;
			await detect(detection, kind, true);
		}
	}

	async function removeFrame(): Promise<void> {
		if (selected === null) {
			return;
		}
		const frame = selected;
		if (await change(() => deleteSheetFrame({ id: data.id, frame }))) {
			selected = null;
		}
	}

	async function save(): Promise<void> {
		const count = view?.plan.save.length ?? 0;
		const ok = await change(() => saveClassSheet({ id: data.id, confirmReplace: true }));
		if (ok) {
			confirmSave = false;
			justSaved = true;
			toaster.success({ title: i18n.t("patrons.census.sheet.savedToast", { count }) });
			void getCensusGroups().refresh();
			if (set) {
				void getCensusList(set).refresh();
			}
		}
	}

	async function removeSheet(): Promise<void> {
		if (await change(() => deleteClassSheet(data.id))) {
			confirmDelete = false;
			toaster.success({ title: i18n.t("patrons.census.sheet.deletedToast") });
			await goto(backHref);
		}
	}

	const replaced = $derived(
		(view?.plan.save ?? []).filter((s) => s.replaces).map((s) => nameOf(s.patronId)),
	);
</script>

{#snippet editToggle()}
	<Button
		icon={mode === "view" ? FramesIcon : DoneIcon}
		variant={mode === "view" ? "tonal" : "primary"}
		onclick={() => {
			mode = mode === "view" ? "edit" : "view";
			selected = null;
		}}
		data-testid="sheet-edit"
		>{mode === "view"
			? i18n.t("patrons.census.sheet.edit")
			: i18n.t("patrons.census.sheet.editDone")}</Button
	>
{/snippet}

<Page width="2xl">
	<PageHeader
		title={i18n.t("patrons.census.sheet.title")}
		icon="classPicture"
		{backHref}
		backLabel={i18n.t("patrons.census.sheet.back")}
	>
		{#snippet actions()}
			<Button
				variant="primary"
				icon={SaveIcon}
				disabled={busy || (view?.plan.save.length ?? 0) === 0}
				onclick={() => (confirmSave = true)}
				data-testid="sheet-save">{i18n.t("patrons.census.sheet.save")}</Button
			>
			{#if view}
				<Button
					variant="error-outlined"
					icon={DeleteIcon}
					disabled={busy}
					onclick={() => (confirmDelete = true)}
					data-testid="sheet-delete">{i18n.t("patrons.census.sheet.deleteSheet")}</Button
				>
			{/if}
		{/snippet}
	</PageHeader>

	<QueryState query={sheetQuery}>
		{#snippet children(view)}
			<Hint tone="primary" data-testid="sheet-progress">
				{i18n.t("patrons.census.sheet.progress", {
					label: view.label,
					done: withPhoto,
					total: view.members.length,
				})}
			</Hint>

			{#if phase === "loading"}
				<VisionLoading {progress} testid="sheet-loading" />
			{:else if phase === "detecting" || (!view.sheet.detected && phase !== "failed")}
				<Row
					wrap={false}
					align="center"
					as="p"
					aria-live="polite"
					data-testid="sheet-detecting"
				>
					<Spinner />
					<span>{i18n.t("patrons.census.sheet.detecting")}</span>
				</Row>
			{:else if phase === "failed"}
				<Alert data-testid="sheet-failed">{i18n.t("catalog.cover.loadFailed")}</Alert>
			{:else}
				<Hint data-testid="sheet-found">
					{frames.length > 0
						? i18n.t("patrons.census.sheet.found", { count: frames.length })
						: i18n.t("patrons.census.sheet.none")}
				</Hint>
			{/if}

			{#if view.sheet.detected}
				<div class="grid items-start gap-4 md:grid-cols-2">
					<section
						class="min-w-0 space-y-3"
						aria-label={i18n.t("patrons.census.sheet.pictureAlt")}
					>
						<!-- one toolbar over the picture, in the look of the other choices (a card with
						     the current one filled): the kind on the first row, the corrections on the
						     second ("Correggi riquadri", then adding and removing a frame) -->
						<Card gap="3" data-testid="sheet-toolbar">
							<fieldset class="min-w-0">
								<legend class="sr-only"
									>{i18n.t("patrons.census.sheet.kind")}</legend
								>
								<Row role="radiogroup" data-testid="sheet-kind">
									{#each SHEET_KINDS as k (k)}
										<Button
											icon={KIND_ICONS[k]}
											variant={view.sheet.kind === k ? "primary" : "tonal"}
											role="radio"
											aria-checked={view.sheet.kind === k}
											disabled={busy}
											onclick={() => void setKind(k)}
											data-testid="sheet-kind-{k}"
											>{i18n.t(KIND_LABELS[k])}</Button
										>
									{/each}
								</Row>
							</fieldset>
							<Row divided>
								{@render editToggle()}
								{#if mode !== "view"}
									<Button
										icon={AddFrameIcon}
										variant={mode === "draw" ? "primary" : "tonal"}
										onclick={() => (mode = mode === "draw" ? "edit" : "draw")}
										disabled={busy}
										data-testid="sheet-add-frame"
										>{i18n.t("patrons.census.sheet.addFrame")}</Button
									>
								{/if}
								{#if selected !== null && mode === "edit"}
									{@const position =
										frames.find((f) => f.id === selected)?.position ?? 0}
									<Button
										icon={DeleteIcon}
										variant="error-tonal"
										onclick={removeFrame}
										disabled={busy}
										data-testid="sheet-delete-frame"
										>{i18n.t("patrons.census.sheet.deleteFrame", {
											n: position,
										})}</Button
									>
								{/if}
							</Row>
						</Card>
						<Hint data-testid="sheet-kind-hint"
							>{i18n.t(KIND_HINTS[view.sheet.kind])}{untouched
								? ` ${i18n.t("patrons.census.sheet.kindAgain")}`
								: ""}</Hint
						>
						<SheetPicture
							src="/media/class-sheets/{data.id}"
							width={view.sheet.width}
							height={view.sheet.height}
							{frames}
							kind={view.sheet.kind}
							{mode}
							bind:selected
							alt={i18n.t("patrons.census.sheet.pictureAlt")}
							{onmove}
							{onadd}
						/>
						{#if mode !== "view"}
							<Hint data-testid="sheet-edit-hint"
								>{mode === "draw"
									? i18n.t("patrons.census.sheet.addFrameHint")
									: view.sheet.kind === "scan"
										? i18n.t("patrons.census.sheet.editHintScan")
										: i18n.t("patrons.census.sheet.editHint")}</Hint
							>
						{/if}
					</section>

					<section class="min-w-0 space-y-3">
						<ul class="space-y-2" data-testid="sheet-frames">
							{#each frames as f (f.id)}
								<li>
									<Card
										padding="none"
										class="flex items-center gap-3 p-2 {f.id === selected
											? 'ring-2 ring-warning-500'
											: ''}"
										data-testid="sheet-row-{f.position}"
										data-state={f.state}
									>
										{#if f.state === "erased"}
											<span
												class="h-24 w-[72px] shrink-0 rounded-base bg-surface-300 ring-1 ring-surface-200"
												aria-hidden="true"
											></span>
										{:else}
											<img
												src="/media/class-sheets/frames/{f.id}?v={f.version}"
												alt={i18n.t("patrons.census.sheet.frame", {
													n: f.position,
												})}
												width="72"
												height="96"
												class="h-24 w-[72px] shrink-0 rounded-base object-cover ring-1 ring-surface-200 {f.state ===
												'ignored'
													? 'opacity-40 grayscale'
													: ''}"
											/>
										{/if}
										<div class="min-w-0 grow space-y-1">
											<p class="font-semibold">
												{i18n.t("patrons.census.sheet.frame", {
													n: f.position,
												})}
											</p>
											{#if f.state === "saved"}
												<Badge
													tone="success"
													data-testid="sheet-saved-{f.position}"
													>{i18n.t("patrons.census.sheet.saved", {
														name: nameOf(f.patronId),
													})}</Badge
												>
											{:else if f.state === "ignored"}
												<Hint>{i18n.t("patrons.census.sheet.ignored")}</Hint
												>
											{:else if f.state === "erased"}
												<Hint data-testid="sheet-erased-{f.position}"
													>{i18n.t("patrons.census.sheet.erased")}</Hint
												>
											{:else}
												<label class="block">
													<span class="sr-only"
														>{i18n.t("patrons.census.sheet.choose")}
														{i18n.t("patrons.census.sheet.frame", {
															n: f.position,
														})}</span
													>
													<Select
														value={f.patronId === null
															? ""
															: String(f.patronId)}
														disabled={busy}
														onchange={(e) =>
															void assign(
																f.id,
																e.currentTarget.value,
															).then((ok) => {
																if (!ok) {
																	void sheetQuery.refresh();
																}
															})}
														data-testid="sheet-choose-{f.position}"
													>
														<option value=""
															>{i18n.t(
																"patrons.census.sheet.nobody",
															)}</option
														>
														{#each view.members as m (m.id)}
															{@const other = holder.get(m.id)}
															{@const elsewhere =
																other !== undefined &&
																!(
																	other.sheetId === data.id &&
																	other.position === f.position
																)}
															<option
																value={String(m.id)}
																disabled={elsewhere}
																>{elsewhere
																	? i18n.t(
																			"patrons.census.sheet.takenBy",
																			{
																				name: patronSortName(
																					m,
																				),
																				n:
																					other?.position ??
																					0,
																			},
																		)
																	: `${patronSortName(m)} — ${
																			m.hasPhoto
																				? i18n.t(
																						"patrons.census.sheet.hasPhoto",
																					)
																				: i18n.t(
																						"patrons.census.sheet.noPhoto",
																					)
																		}`}</option
															>
														{/each}
													</Select>
												</label>
											{/if}
										</div>
										{#if f.state === "pending"}
											<Button
												size="sm"
												icon={IgnoreIcon}
												onclick={() => void ignore(f.id, true)}
												disabled={busy}
												data-testid="sheet-ignore-{f.position}"
												>{i18n.t("patrons.census.sheet.ignore")}</Button
											>
										{:else if f.state === "ignored"}
											<Button
												size="sm"
												icon={UndoIcon}
												onclick={() => void ignore(f.id, false)}
												disabled={busy}
												data-testid="sheet-unignore-{f.position}"
												>{i18n.t("patrons.census.sheet.unignore")}</Button
											>
										{/if}
									</Card>
								</li>
							{/each}
						</ul>

						{#if justSaved && stillMissing.length > 0}
							<Card gap="2" as="section" data-testid="sheet-still-missing">
								<h2 class="h4">{i18n.t("patrons.census.sheet.missingTitle")}</h2>
								<p class="text-sm">
									{stillMissing.map((m) => patronSortName(m)).join(", ")}
								</p>
								<Button href={backHref} icon={CameraIcon}
									>{i18n.t("patrons.census.sheet.byCamera")}</Button
								>
							</Card>
						{/if}
					</section>
				</div>
			{/if}

			<ConfirmDialog
				bind:open={confirmSave}
				title={i18n.t("patrons.census.sheet.saveTitle")}
				description={i18n.t("patrons.census.sheet.saveSummary", {
					count: view.plan.save.length,
				})}
				confirmLabel={i18n.t("patrons.census.sheet.save")}
				onconfirm={save}
			>
				{#if replaced.length > 0}
					<Alert tone="warning" data-testid="sheet-save-replaces">
						{i18n.t("patrons.census.sheet.saveReplaces", {
							names: replaced.join(", "),
						})}
					</Alert>
				{/if}
				{#if view.plan.unassigned > 0}
					<Hint>
						{i18n.t("patrons.census.sheet.saveUnassigned", {
							count: view.plan.unassigned,
						})}
					</Hint>
				{/if}
			</ConfirmDialog>
			<ConfirmDialog
				bind:open={confirmDelete}
				title={i18n.t("patrons.census.sheet.deleteSheetTitle")}
				description={i18n.t("patrons.census.sheet.deleteSheetDescription")}
				tone="error"
				confirmLabel={i18n.t("patrons.census.sheet.deleteSheet")}
				onconfirm={removeSheet}
			/>
		{/snippet}
	</QueryState>
</Page>
