<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Create/edit form of a bibliographic record (step 3.1), driven by a remote `form`
     (createBiblio / updateBiblio). The classification picker edits local state mirrored into
     hidden fields so the remote form carries it. Under it the segnatura the copies get (Q143),
     computed as the server does, and the title's text when the scheme has one. -->
<script module lang="ts">
	/** One field of a remote `form` (the subset this component uses). */
	export interface FieldApi {
		as: (type: string, value?: string) => Record<string, unknown>;
		issues: () => { message: string }[] | undefined;
		value: () => unknown;
		set: (value: unknown) => unknown;
	}

	/** What the `extra` snippet of the fast-add flow needs from the record being edited. */
	export interface BiblioFormState {
		/** `""`: classified later (step 9.21). */
		kind: "fiction" | "nonfiction" | "";
		genreCode: string;
		classCode: string;
		readingLevel: string;
		author: string;
		title: string;
	}
</script>

<script lang="ts">
	import type { ResolvedPathname } from "$app/types";
	import type { Snippet } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import type { BiblioFormInput } from "#lib/shared/catalog-schema.js";
	import {
		callTextProposal,
		computeCallNumber,
		schemeUses,
		type CallNumberScheme,
	} from "#lib/shared/classification.js";
	import FormLayout from "#lib/ui/FormLayout.svelte";
	import FormSection from "#lib/ui/FormSection.svelte";
	import FormErrors from "#lib/components/FormErrors.svelte";
	import ClassificationPicker from "./ClassificationPicker.svelte";
	import CallNumberShown from "./CallNumberShown.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { getSeriesNames } from "#lib/remote/catalog.remote.js";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import { joinFormats, splitFormats } from "#lib/shared/accessible-formats.js";

	interface FormApi {
		fields: Record<keyof BiblioFormInput | "id", FieldApi> &
			Record<string, FieldApi> & {
				set: (values: Record<string, unknown>) => unknown;
				allIssues: () => { path: (string | number)[]; message: string }[] | undefined;
			};
		pending: number;
	}
	interface Options {
		fictionByClass: boolean;
		classPerItem: boolean;
		readingLevels: { code: string; label: string }[];
		genres: { code: string; label: string; image: string | null; color: string | null }[];
		nonfiction: {
			code: string;
			label: string;
			image: string | null;
			color: string | null;
			children: { code: string; label: string; image: string | null; color: string | null }[];
		}[];
		specialAuthors: string[];
		/** Accessible books (9.66): the formats offered; empty hides them. */
		accessibleFormats?: string[];
		unknownPublisher: string;
		unknownPlace: string;
		itemTypes: { code: string; label: string }[];
		callNumber: CallNumberScheme;
	}

	interface Props {
		/** A remote `form` (createBiblio, updateBiblio.for(id) or fastAdd); typed loosely so all fit. */
		form: object;
		options: Options;
		submitLabel: string;
		cancelHref: ResolvedPathname;
		/** Initial values, including those of the extra fields of the fast-add flow. */
		initial?: Partial<BiblioFormInput> & Record<string, unknown>;
		id?: number;
		/** A note shown above the fields (e.g. the metadata source of a prefilled record). */
		note?: string;
		/** Extra sections rendered after the record (the copies block of the fast-add flow). */
		extra?: Snippet<[BiblioFormState, Record<string, FieldApi>]>;
		/** Called whenever the classification, author or title change (live suggestions). */
		onstate?: (state: BiblioFormState, fields: Record<string, FieldApi>) => void;
		autofocus?: boolean;
	}

	const {
		form,
		options,
		submitLabel,
		cancelHref,
		initial,
		id,
		note,
		extra,
		onstate,
		autofocus = false,
	}: Props = $props();
	const i18n = useI18n();
	const uid = $props.id();
	const seriesNames = getSeriesNames();
	const api = $derived(form as unknown as FormApi);
	const fields = $derived(api.fields);

	// svelte-ignore state_referenced_locally
	let kind = $state<"fiction" | "nonfiction" | "">(initial?.kind ?? "fiction");
	// svelte-ignore state_referenced_locally
	let genreCode = $state(initial?.genreCode ?? "");
	// svelte-ignore state_referenced_locally
	let classCode = $state(initial?.classCode ?? "");
	// svelte-ignore state_referenced_locally
	let readingLevel = $state(initial?.readingLevel ?? "");
	// the accessible formats (9.66): the boxes mirrored into one hidden field
	// svelte-ignore state_referenced_locally
	let formats = $state<string[]>(splitFormats(initial?.accessibleFormats ?? ""));
	// a format taken off the list stays offered while the record has it
	const formatChoices = $derived([
		...(options.accessibleFormats ?? []),
		...formats.filter((f) => !(options.accessibleFormats ?? []).includes(f)),
	]);
	function toggleFormat(format: string, on: boolean): void {
		formats = on
			? formatChoices.filter((f) => f === format || formats.includes(f))
			: formats.filter((f) => f !== format);
	}

	$effect(() => {
		if (initial) {
			api.fields.set({ ...initial });
		}
	});

	function issuesOf(field: keyof BiblioFormInput): string[] {
		return fields[field].issues()?.map((i) => i.message) ?? [];
	}

	function setField(field: keyof BiblioFormInput, value: string): void {
		fields[field].set(value);
	}

	const text = (field: keyof BiblioFormInput): string => {
		const v = fields[field].value();
		return typeof v === "string" ? v : "";
	};
	const formState = $derived<BiblioFormState>({
		kind,
		genreCode,
		classCode,
		readingLevel,
		author: text("author"),
		title: text("title"),
	});
	$effect(() => {
		onstate?.(formState, fields);
	});

	// the segnatura (Q143): the title's text where the scheme has one, empty for the proposal;
	// the copy's level and text from the copy fields of the same form (fast add, single copy)
	const scheme = $derived({
		callNumber: options.callNumber,
		specialAuthors: options.specialAuthors,
	});
	const withText = $derived(schemeUses(scheme, "text"));
	const proposal = $derived(callTextProposal(scheme, formState));
	const copyField = (name: string): string => {
		const v = fields[name]?.value();
		return typeof v === "string" ? v : "";
	};
	const callNumber = $derived(
		computeCallNumber(scheme, {
			kind: kind === "" ? null : kind,
			genreCode: kind === "fiction" ? genreCode : null,
			classCode: kind === "nonfiction" ? classCode : null,
			readingLevel:
				kind !== "fiction"
					? null
					: (options.classPerItem ? copyField("itemReadingLevel") : readingLevel) || null,
			author: formState.author,
			title: formState.title,
			text: withText ? text("callText").trim() || null : null,
			copyText: copyField("itemCallText") || null,
		}),
	);
</script>

{#snippet fieldError(field: keyof BiblioFormInput)}
	{#each issuesOf(field) as message (message)}
		<Hint tone="error" as="span" data-testid="field-error-{field}">{message}</Hint>
	{/each}
{/snippet}

<div class="space-y-6" data-testid="biblio-form">
	{#if id !== undefined}<input {...fields.id.as("hidden", String(id))} />{/if}
	<FormErrors issues={api.fields.allIssues()?.filter((i) => i.path.length === 0)} />
	{#if note}
		<p class="card preset-tonal-primary px-4 py-2 text-sm" data-testid="biblio-form-note">
			{note}
		</p>
	{/if}
	<FormLayout {...form as Record<string, unknown>}>
		<FormSection title={i18n.t("catalog.form.identity")}>
			<div>
				<Field label={i18n.t("catalog.fields.title")}
					><Input
						{...fields.title.as("text")}
						required
						autocomplete="off"
						{autofocus}
					/></Field
				>
				{@render fieldError("title")}
			</div>
			<div>
				<Field label={i18n.t("catalog.fields.subtitle")}
					><Input {...fields.subtitle.as("text")} autocomplete="off" /></Field
				>
			</div>
			<!-- the original title of a translation (step 9.23) -->
			<div>
				<Field
					label={i18n.t("catalog.fields.originalTitle")}
					hint={i18n.t("catalog.fields.originalTitleHint")}
					><Input {...fields.originalTitle.as("text")} autocomplete="off" /></Field
				>
			</div>
			<Grid span>
				<div>
					<Field label={i18n.t("catalog.fields.author")}
						><Input {...fields.author.as("text")} required autocomplete="off" /></Field
					>
					<Hint as="span">{i18n.t("catalog.fields.authorHint")}</Hint>
					<Row gap="1" class="mt-1">
						{#each options.specialAuthors as a (a)}
							<Button
								size="sm"
								onclick={() => setField("author", a)}
								data-testid="quick-author-{a}">{a}</Button
							>
						{/each}
					</Row>
					{@render fieldError("author")}
				</div>
				<div>
					<Field label={i18n.t("catalog.fields.responsibility")}
						><Input {...fields.responsibility.as("text")} autocomplete="off" /></Field
					>
				</div>
			</Grid>
			<!-- series and number in the series (step 9.14): typed once, then suggested -->
			<Grid cols="3" span>
				<div class="md:col-span-2">
					<Field label={i18n.t("catalog.fields.series")}
						><Input
							{...fields.series.as("text")}
							list="{uid}-series"
							autocomplete="off"
							data-testid="biblio-series"
						/></Field
					>
					<datalist id="{uid}-series">
						{#each seriesNames.current ?? [] as name (name)}
							<option value={name}></option>
						{/each}
					</datalist>
					<Hint as="span">{i18n.t("catalog.fields.seriesHint")}</Hint>
				</div>
				<div>
					<Field label={i18n.t("catalog.fields.seriesNumber")}
						><Input
							{...fields.seriesNumber.as("text")}
							maxlength={20}
							autocomplete="off"
							data-testid="biblio-series-number"
						/></Field
					>
				</div>
			</Grid>
		</FormSection>

		<FormSection title={i18n.t("catalog.form.publication")}>
			<Grid cols="3" span>
				<div>
					<Field label={i18n.t("catalog.fields.publisher")}
						><Input
							{...fields.publisher.as("text")}
							required
							autocomplete="off"
						/></Field
					>
					<Button
						size="sm"
						class="mt-1"
						onclick={() => setField("publisher", options.unknownPublisher)}
						title={i18n.t("catalog.form.unknownPublisher")}
						data-testid="quick-publisher">{options.unknownPublisher}</Button
					>
					{@render fieldError("publisher")}
				</div>
				<div>
					<Field label={i18n.t("catalog.fields.publicationPlace")}
						><Input {...fields.publicationPlace.as("text")} autocomplete="off" /></Field
					>
					<Button
						size="sm"
						class="mt-1"
						onclick={() => setField("publicationPlace", options.unknownPlace)}
						title={i18n.t("catalog.form.unknownPlace")}
						data-testid="quick-place">{options.unknownPlace}</Button
					>
				</div>
				<div>
					<Field label={i18n.t("catalog.fields.publicationYear")}
						><Input
							{...fields.publicationYear.as("text")}
							inputmode="numeric"
							maxlength={4}
							autocomplete="off"
						/></Field
					>
					{@render fieldError("publicationYear")}
				</div>
			</Grid>
			<Grid cols="3" span>
				<div>
					<Field label={i18n.t("catalog.fields.isbn")}
						><Input mono {...fields.isbn.as("text")} autocomplete="off" /></Field
					>
					{@render fieldError("isbn")}
				</div>
				<div>
					<Field label={i18n.t("catalog.fields.ean")}
						><Input mono {...fields.ean.as("text")} autocomplete="off" /></Field
					>
					{@render fieldError("ean")}
				</div>
				<div>
					<Field label={i18n.t("catalog.fields.physicalDescription")}
						><Input
							{...fields.physicalDescription.as("text")}
							autocomplete="off"
						/></Field
					>
				</div>
				<!-- the material of every copy of the title (9.45, Q139) -->
				<div>
					<Field label={i18n.t("catalog.item.itemType")}
						><Select {...fields.itemType.as("select")} data-testid="biblio-item-type">
							{#each options.itemTypes as t (t.code)}
								<option value={t.code}>{t.label}</option>
							{/each}
						</Select></Field
					>
					{@render fieldError("itemType")}
				</div>
			</Grid>
		</FormSection>

		<FormSection title={i18n.t("catalog.form.classification")}>
			<div class="md:col-span-2">
				<input {...fields.kind.as("hidden", kind)} />
				<input {...fields.genreCode.as("hidden", genreCode)} />
				<input {...fields.classCode.as("hidden", classCode)} />
				<input {...fields.readingLevel.as("hidden", readingLevel)} />
				<ClassificationPicker
					{options}
					allowLater
					bind:kind
					bind:genreCode
					bind:classCode
					bind:readingLevel
				/>
				{@render fieldError("genreCode")}
				{@render fieldError("classCode")}
				{@render fieldError("readingLevel")}
			</div>
			{#if withText}
				<Field
					label={i18n.t("catalog.fields.callText")}
					hint={i18n.t("catalog.fields.callTextHint", { proposal: proposal || "—" })}
					><Input
						mono
						{...fields.callText?.as("text")}
						placeholder={proposal}
						maxlength={40}
						autocomplete="off"
						data-testid="biblio-call-text"
					/></Field
				>
			{/if}
			<CallNumberShown
				label={i18n.t("catalog.fields.callNumber")}
				value={callNumber?.full ?? i18n.t("catalog.fields.callNumberLater")}
				hint={i18n.t("catalog.fields.callNumberHint")}
				testid="biblio-call-number"
			/>
			{#if formatChoices.length > 0}
				<fieldset class="md:col-span-2" data-testid="biblio-accessible-formats">
					<legend class="label-text">{i18n.t("catalog.fields.accessibleFormats")}</legend>
					<input {...fields.accessibleFormats.as("hidden", joinFormats(formats))} />
					<Row gap="3" class="mt-1">
						{#each formatChoices as f (f)}
							<Checkbox
								checked={formats.includes(f)}
								onchange={(e) => toggleFormat(f, e.currentTarget.checked)}
								data-testid="accessible-format-{f}">{f}</Checkbox
							>
						{/each}
					</Row>
					<Hint as="span">{i18n.t("catalog.fields.accessibleFormatsHint")}</Hint>
					{@render fieldError("accessibleFormats")}
				</fieldset>
			{/if}
		</FormSection>

		<FormSection
			title={i18n.t("catalog.form.more")}
			collapsible
			open={Boolean(initial?.subjects || initial?.notes || initial?.dewey || initial?.issn)}
		>
			<Grid span>
				<div>
					<Field label={i18n.t("catalog.fields.dewey")}
						><Input mono {...fields.dewey.as("text")} autocomplete="off" /></Field
					>
				</div>
				<div>
					<Field label={i18n.t("catalog.fields.issn")}
						><Input mono {...fields.issn.as("text")} autocomplete="off" /></Field
					>
					{@render fieldError("issn")}
				</div>
			</Grid>
			<div class="md:col-span-2">
				<label class="label">
					<span class="label-text">{i18n.t("catalog.fields.subjects")}</span>
					<textarea {...fields.subjects.as("text")} class="textarea" rows="2"></textarea>
					<Hint as="span">{i18n.t("catalog.fields.subjectsHint")}</Hint>
				</label>
			</div>
			<div class="md:col-span-2">
				<Field label={i18n.t("catalog.fields.notes")}
					><textarea {...fields.notes.as("text")} class="textarea" rows="3"
					></textarea></Field
				>
			</div>
		</FormSection>

		{#if extra}
			{@render extra(formState, fields)}
		{/if}

		{#snippet actions()}
			<Button href={cancelHref}>{i18n.t("common.actions.cancel")}</Button>
			<Button
				variant="primary"
				type="submit"
				disabled={api.pending > 0}
				data-testid="biblio-submit"
				>{api.pending > 0 ? i18n.t("common.status.loading") : submitLabel}</Button
			>
		{/snippet}
	</FormLayout>
</div>
