<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Nuovo libro" fast-add flow (PLAN.md step 3.6): scan the ISBN/EAN (or search without a code),
     duplicate check, parallel metadata lookup (the most complete record opens, 9.14), prefilled
     record with the classification, the copies block and the cover (downloaded while the form is
     shown, or photographed, 9.13 round 11), one-shot save and a confirmation with the barcodes.
     Keyboard flow: scan → Enter (save). -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { fulfilWishWith, getWish } from "#lib/remote/wishlist.remote.js";
	import { toaster } from "#lib/ui/toaster.js";
	import { untrack } from "svelte";
	import { debugReport } from "#lib/debug.js";
	import { useI18n } from "#lib/i18n/context.js";
	import { addItems } from "#lib/remote/catalog.remote.js";
	import { checkIsbn, fastAdd, lookupMetadata } from "#lib/remote/cataloging.remote.js";
	import type { BiblioDraft } from "#lib/server/metadata/types.js";
	import type { BiblioFormInput } from "#lib/shared/catalog-schema.js";
	import { suggestCallNumber, suggestClassFromDewey } from "#lib/shared/classification.js";
	import { isoDateIn } from "#lib/shared/dates.js";
	import { ean13Valid } from "#lib/shared/isbn.js";
	import { formatSeries } from "#lib/shared/series.js";
	import type { ScanKind } from "#lib/shared/scan.js";
	import BiblioForm, {
		type BiblioFormState,
		type FieldApi,
	} from "#lib/components/catalog/BiblioForm.svelte";
	import CodeStage from "#lib/components/cataloging/CodeStage.svelte";
	import DoneStage from "#lib/components/cataloging/DoneStage.svelte";
	import DuplicateStage from "#lib/components/cataloging/DuplicateStage.svelte";
	import type { ExistingRecord, SavedBook } from "#lib/components/cataloging/fast-add.js";
	import FormCover from "#lib/components/cataloging/FormCover.svelte";
	import { coversOn } from "#lib/ui/features.js";
	import LookupStage from "#lib/components/cataloging/LookupStage.svelte";
	import SearchStage from "#lib/components/cataloging/SearchStage.svelte";
	import {
		type CoverChoice,
		CoverChoiceState,
		storeCover,
	} from "#lib/components/cataloging/cover-choice.svelte.js";
	import FormSection from "#lib/ui/FormSection.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Steps from "#lib/ui/Steps.svelte";
	import { icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Field from "#lib/ui/Field.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const options = $derived(data.options);
	const ScanIcon = icons.scan;
	const OthersIcon = icons.view;

	type Stage = "code" | "search" | "duplicate" | "lookup" | "form" | "done";
	let stage = $state<Stage>("code");
	// svelte-ignore state_referenced_locally
	let material = $state(data.options.itemTypes[0]?.code ?? "libro");
	let codeMessage = $state<string | null>(null);

	// --- lookup
	let lookupQuery = $state<
		{ kind: "isbn"; isbn: string } | { kind: "search"; title: string; author: string } | null
	>(null);
	let lookupAttempt = $state(0);
	const lookup = $derived(
		stage === "lookup" && lookupQuery
			? lookupMetadata({ ...lookupQuery, ...(lookupAttempt ? {} : {}) })
			: null,
	);
	// diagnostic log (9.13, round 12): each stage of the flow with what led to it
	$effect(() => {
		debugReport("fastadd", `stage ${stage}`, {
			query: lookupQuery?.kind ?? null,
			isbn: lookupQuery?.kind === "isbn" ? lookupQuery.isbn : null,
			candidate: untrack(() => candidate?.source ?? null),
			autoPicked: untrack(() => autoPicked?.count ?? null),
			material,
		});
	});
	// Q85: an ISBN lookup opens the form with the most complete record (the list comes first from
	// the server); "Altre schede" goes back to the list, which then stays (step 9.14)
	let autoPicked = $state<{ isbn: string; count: number } | null>(null);
	$effect(() => {
		const current = lookup?.current;
		if (stage !== "lookup" || lookupQuery?.kind !== "isbn" || !current) {
			return;
		}
		const isbn = lookupQuery.isbn;
		const best = current.candidates[0];
		if (best && autoPicked?.isbn !== isbn) {
			autoPicked = { isbn, count: current.candidates.length };
			openForm(best);
		}
	});
	// --- from the wishlist (step 9.15): `?wish=<id>` prefills the search and the form, and the
	// wish leaves the list once the record (or a copy of an existing one) is saved
	const wishId = $derived(Number(page.url.searchParams.get("wish")) || null);
	const wishQuery = $derived(wishId ? getWish(wishId) : null);
	const fromWish = $derived(wishQuery?.current ?? null);
	let wishPrefilled = false;
	$effect(() => {
		if (fromWish && !wishPrefilled) {
			wishPrefilled = true;
			searchTitle = fromWish.title ?? fromWish.series ?? "";
			searchAuthor = fromWish.author ?? "";
		}
	});
	async function fulfilFromWish(biblioId: number): Promise<void> {
		const w = untrack(() => fromWish);
		if (!w) {
			return;
		}
		const r = await fulfilWishWith({ id: w.id, biblioId }).catch(() => ({ removed: false }));
		if (r.removed) {
			toaster.success({ title: i18n.t("circulation.wishlist.fastAdd.fulfilled") });
		}
		// "Aggiungi un altro" starts without the wish
		await goto(resolve("cataloging/new"), { replace: true, shallow: true });
	}
	let searchTitle = $state("");
	let searchAuthor = $state("");
	let searchError = $state<string | null>(null);

	// --- duplicate
	let existing = $state<ExistingRecord | null>(null);
	let dupCopies = $state(1);
	let dupBusy = $state(false);
	let dupIssues = $state<{ field: string; message: string }[]>([]);

	// --- form
	let candidate = $state<BiblioDraft | null>(null);
	let initial = $state<Partial<BiblioFormInput> & Record<string, unknown>>({});
	let formKey = $state(0);
	let deweyClass = $state<string | null>(null);

	// --- cover (9.13, round 11): looked up while the form is shown, replaced by a photo if wrong
	// or missing, stored only when the record is saved
	const coverChoice = new CoverChoiceState();

	// --- done
	let saved = $state<SavedBook | null>(null);
	async function saveChosenCover(biblioId: number, choice: CoverChoice): Promise<void> {
		const ok = await storeCover(biblioId, choice);
		if (saved?.biblioId === biblioId && saved.cover) {
			saved = { ...saved, cover: { ...saved.cover, state: ok ? "saved" : "failed" } };
		}
	}
	// the remote form keeps its last result for the whole visit: the book saved before leaving
	// the page must not come back as this visit's confirmation (9.13, round 9)
	const previousResult = fastAdd.result;
	$effect(() => {
		const r = fastAdd.result;
		if (r && r !== previousResult && saved?.biblioId !== r.biblioId) {
			const choice = untrack(() => coverChoice.cover);
			saved = {
				...r,
				copiesOnly: false,
				cover: choice
					? { dataUrl: choice.dataUrl, name: choice.name, state: "saving" }
					: null,
			};
			stage = "done";
			if (choice) {
				void saveChosenCover(r.biblioId, choice);
			}
			void fulfilFromWish(r.biblioId);
		}
	});

	const providerName = (id: string): string =>
		data.providers.find((p) => p.id === id)?.name ?? i18n.t(`catalog.lookup.providers.${id}`);
	const searchingOn = $derived(data.providers.map((p) => p.name).join(", "));

	function reset(): void {
		coverChoice.clear();
		stage = "code";
		autoPicked = null;
		codeMessage = null;
		lookupQuery = null;
		existing = null;
		candidate = null;
		saved = null;
		searchTitle = "";
		searchAuthor = "";
	}

	async function onscan(kind: Exclude<ScanKind, "invalid">, value: string): Promise<void> {
		codeMessage = null;
		if (kind === "isbn") {
			const check = await checkIsbn(value);
			if (check.existing) {
				existing = check.existing;
				dupCopies = 1;
				dupIssues = [];
				stage = "duplicate";
				return;
			}
			lookupQuery = { kind: "isbn", isbn: check.isbn ?? value };
			stage = "lookup";
			return;
		}
		// an EAN-13 that is not an ISBN (a DVD): no lookup, straight to the form
		if (ean13Valid(value)) {
			codeMessage = i18n.t("catalog.fastAdd.code.eanNotIsbn", { ean: value });
			openForm(null, { ean: value });
			return;
		}
		codeMessage = i18n.t("catalog.fastAdd.code.notACode");
	}

	function runSearch(): void {
		const title = searchTitle.trim();
		const author = searchAuthor.trim();
		if (!title && !author) {
			searchError = i18n.t("catalog.fastAdd.search.empty");
			return;
		}
		searchError = null;
		lookupQuery = { kind: "search", title, author };
		stage = "lookup";
	}

	function draftToInitial(d: BiblioDraft): Partial<BiblioFormInput> {
		const classCode = suggestClassFromDewey(options, d.dewey);
		deweyClass = classCode;
		return {
			title: d.title,
			subtitle: d.subtitle ?? "",
			originalTitle: d.originalTitle ?? "",
			responsibility: d.responsibility ?? "",
			author: d.author,
			publisher: d.publisher,
			publicationPlace: d.publicationPlace ?? "",
			publicationYear: d.publicationYear ? String(d.publicationYear) : "",
			isbn: d.isbn ?? "",
			issn: d.issn ?? "",
			physicalDescription: d.physicalDescription ?? "",
			series: d.series ?? "",
			seriesNumber: d.seriesNumber ?? "",
			dewey: d.dewey ?? "",
			subjects: d.subjects.join("\n"),
			kind: classCode ? "nonfiction" : "fiction",
			classCode: classCode ?? "",
			genreCode: "",
			readingLevel: "",
		};
	}

	function openForm(d: BiblioDraft | null, extra: Partial<BiblioFormInput> = {}): void {
		candidate = d;
		deweyClass = null;
		lastSuggestion = "";
		initial = {
			copies: "1",
			itemType: material,
			itemCallNumber: "",
			itemReadingLevel: "",
			acquisitionDate: isoDateIn(new Date(), data.timezone),
			source: d?.source ?? "manual",
			sourceId: d?.sourceId ?? "",
			...(d ? draftToInitial(d) : { kind: "fiction" }),
			...(lookupQuery?.kind === "isbn" && !d ? { isbn: lookupQuery.isbn } : {}),
			...(lookupQuery?.kind === "search" && !d
				? { title: lookupQuery.title, author: lookupQuery.author }
				: {}),
			...extra,
		};
		// what the wish said fills what the record left empty (9.15)
		const w = untrack(() => fromWish);
		if (w) {
			initial = {
				...initial,
				title: initial.title || (w.title ?? ""),
				author: initial.author || (w.author ?? ""),
				series: initial.series || (w.series ?? ""),
				seriesNumber:
					initial.seriesNumber || (initial.series ? "" : (w.seriesNumber ?? "")),
			};
		}
		formKey += 1;
		stage = "form";
		coverChoice.clear();
		const isbn = d?.isbn ?? (lookupQuery?.kind === "isbn" ? lookupQuery.isbn : null);
		if (data.autoFetchCover && isbn) {
			void coverChoice.lookup(isbn);
		}
	}

	async function addCopiesToExisting(): Promise<void> {
		if (!existing) {
			return;
		}
		dupBusy = true;
		try {
			const r = await addItems({
				biblioId: existing.id,
				copies: dupCopies,
				item: {
					callNumber: "",
					readingLevel: "",
					enumeration: "",
					acquisitionDate: "",
					notes: "",
					notForLoan: false,
				},
			});
			if (!r.ok) {
				dupIssues = r.issues;
				return;
			}
			saved = {
				biblioId: existing.id,
				title: existing.title,
				barcodes: r.barcodes,
				itemIds: r.ids,
				copiesOnly: true,
				cover: null,
			};
			stage = "done";
			void fulfilFromWish(existing.id);
		} finally {
			dupBusy = false;
		}
	}

	// the call number field follows the suggestion until the operator types their own
	let lastSuggestion = "";
	function syncCallNumber(state: BiblioFormState, fields: Record<string, FieldApi>): void {
		const next = suggestion(state, fields);
		const current = fields.itemCallNumber?.value();
		if (!current || current === lastSuggestion) {
			fields.itemCallNumber?.set(next);
		}
		lastSuggestion = next;
	}

	function suggestion(state: BiblioFormState, fields: Record<string, FieldApi>): string {
		const perItem = options.classPerItem && options.fictionByClass;
		const itemClass = fields.itemReadingLevel?.value();
		// the call number waits for the classification (step 9.21)
		if (state.kind === "") {
			return "";
		}
		return suggestCallNumber(options, {
			kind: state.kind,
			genreCode: state.genreCode || null,
			classCode: state.classCode || null,
			readingLevel: perItem
				? typeof itemClass === "string" && itemClass
					? itemClass
					: null
				: state.readingLevel || null,
			author: state.author,
			title: state.title,
		});
	}

	const stepIndex = $derived(
		stage === "done"
			? 3
			: stage === "form"
				? 2
				: stage === "code" || stage === "search"
					? 0
					: 1,
	);
	const steps = ["code", "lookup", "form", "done"] as const;
</script>

<Page>
	<PageHeader
		title={i18n.t("catalog.fastAdd.title")}
		icon="book"
		backHref="/catalog"
		backLabel={i18n.t("common.actions.back")}
	/>

	{#if fromWish && stage !== "done"}
		<Card class="space-y-1" as="section" data-testid="from-wish">
			<p class="font-semibold">
				{i18n.t("circulation.wishlist.fastAdd.banner", {
					what: [
						fromWish.title,
						fromWish.author,
						formatSeries(fromWish.series, fromWish.seriesNumber),
					]
						.filter(Boolean)
						.join(" · "),
				})}
			</p>
			<Hint>{i18n.t("circulation.wishlist.fastAdd.hint")}</Hint>
		</Card>
	{/if}

	<Steps
		steps={steps.map((key) => ({ key, label: i18n.t(`catalog.fastAdd.steps.${key}`) }))}
		current={stepIndex}
		label={i18n.t("catalog.fastAdd.title")}
	/>

	{#if stage === "code"}
		<CodeStage
			itemTypes={options.itemTypes}
			bind:material
			message={codeMessage}
			{onscan}
			onsearch={() => (stage = "search")}
			onmanual={() => openForm(null)}
		/>
	{:else if stage === "search"}
		<SearchStage
			bind:title={searchTitle}
			bind:author={searchAuthor}
			error={searchError}
			onsearch={runSearch}
			onmanual={() => openForm(null)}
			onback={reset}
		/>
	{:else if stage === "duplicate" && existing}
		<DuplicateStage
			{existing}
			bind:copies={dupCopies}
			busy={dupBusy}
			issues={dupIssues}
			onadd={addCopiesToExisting}
			onback={reset}
		/>
	{:else if stage === "lookup" && lookup}
		<LookupStage
			{lookup}
			byIsbn={lookupQuery?.kind === "isbn"}
			{searchingOn}
			{providerName}
			onpick={(c) => openForm(c)}
			onmanual={() => openForm(null)}
			onsearch={() => (stage = "search")}
			onretry={() => {
				lookupAttempt += 1;
				void lookup?.refresh();
			}}
			onback={reset}
		/>
	{:else if stage === "form"}
		<section class="space-y-4" data-testid="stage-form">
			<!-- a wrong code read by the camera is one tap away from a new try (9.13, round 9) -->
			<Row align="center" justify="between">
				<h2 class="h4">{i18n.t("catalog.fastAdd.form.heading")}</h2>
				<Button icon={ScanIcon} onclick={reset} data-testid="form-rescan"
					>{i18n.t("catalog.fastAdd.form.rescan")}</Button
				>
			</Row>
			{#if codeMessage}
				<p class="text-warning-700" role="status" data-testid="form-code-message">
					{codeMessage}
				</p>
			{/if}
			{#if candidate && autoPicked && autoPicked.count > 1}
				<Card
					class="flex flex-wrap items-center justify-between gap-2"
					data-testid="best-of"
				>
					<span>{i18n.t("catalog.fastAdd.form.bestOf", { count: autoPicked.count })}</span
					>
					<Button
						size="sm"
						icon={OthersIcon}
						onclick={() => (stage = "lookup")}
						data-testid="other-records"
						>{i18n.t("catalog.fastAdd.form.otherRecords", {
							count: autoPicked.count - 1,
						})}</Button
					>
				</Card>
			{/if}
			{#if coversOn()}
				<FormCover choice={coverChoice} width={data.coverWidth} />
			{/if}
			{#key formKey}
				<BiblioForm
					form={fastAdd}
					{options}
					{initial}
					submitLabel={i18n.t("catalog.fastAdd.form.save")}
					cancelHref="/catalog"
					autofocus
					onstate={syncCallNumber}
					note={candidate
						? i18n.t("catalog.fastAdd.form.fromSource", {
								provider: providerName(candidate.source),
							}) +
							(deweyClass
								? ` ${i18n.t("catalog.fastAdd.form.deweySuggested", { dewey: candidate.dewey ?? "" })}`
								: "")
						: i18n.t("catalog.fastAdd.form.manualSource")}
				>
					{#snippet extra(state, fields)}
						<input {...fields.source?.as("hidden", candidate?.source ?? "manual")} />
						<input {...fields.sourceId?.as("hidden", candidate?.sourceId ?? "")} />
						<FormSection title={i18n.t("catalog.fastAdd.form.copiesSection")}>
							<Grid cols="3" span>
								<div>
									<Field label={i18n.t("catalog.fastAdd.form.copies")}
										><Input
											{...fields.copies?.as("text")}
											inputmode="numeric"
											maxlength={3}
											data-testid="fast-copies"
										/></Field
									>
									{#each fields.copies?.issues() ?? [] as issue (issue.message)}
										<Hint
											tone="error"
											as="span"
											data-testid="field-error-copies">{issue.message}</Hint
										>
									{/each}
								</div>
								{#if options.classPerItem && options.fictionByClass && state.kind === "fiction"}
									<Field label={i18n.t("catalog.fastAdd.form.readingLevel")}
										><Select {...fields.itemReadingLevel?.as("select")}>
											<option value="">—</option>
											{#each options.readingLevels as l (l.code)}
												<option value={l.code}>{l.label}</option>
											{/each}
										</Select></Field
									>
								{/if}
								<Field label={i18n.t("catalog.fastAdd.form.callNumber")}
									><Input
										mono
										{...fields.itemCallNumber?.as("text")}
										data-testid="fast-call-number"
									/></Field
								>
								<Field label={i18n.t("catalog.fastAdd.form.acquisitionDate")}
									><Input
										{...fields.acquisitionDate?.as("text")}
										type="date"
										data-testid="fast-acquisition-date"
									/></Field
								>
							</Grid>
						</FormSection>
					{/snippet}
				</BiblioForm>
			{/key}
		</section>
	{:else if stage === "done" && saved}
		<DoneStage {saved} onanother={reset} />
	{/if}
</Page>
