<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { updateBiblio } from "#lib/remote/catalog.remote.js";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import FormSection from "#lib/ui/FormSection.svelte";
	import BiblioForm from "#lib/components/catalog/BiblioForm.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Field from "#lib/ui/Field.svelte";
	import { isFreeScheme, schemeUses } from "#lib/shared/classification.js";

	const { data } = $props();
	const i18n = useI18n();
	const form = $derived(updateBiblio.for(String(data.id)));
	const options = $derived(data.options);
	// the copy's own text of the segnatura, only where the scheme has it (Q143)
	const copyText = $derived(schemeUses({ callNumber: options.callNumber }, "copytext"));
	/** The record's fields plus, with a single copy, the copy's own (`item*` fields of the edit schema). */
	const initial = $derived(
		data.item
			? {
					...data.initial,
					itemId: String(data.item.id),
					itemCallText: data.item.callText,
					itemReadingLevel: data.item.readingLevel,
					itemEnumeration: data.item.enumeration,
					itemAcquisitionDate: data.item.acquisitionDate,
					itemNotes: data.item.notes,
					itemNotForLoan: data.item.notForLoan,
				}
			: data.initial,
	);
</script>

<Page width="md">
	<PageHeader
		title={i18n.t("catalog.form.editTitle")}
		subtitle={data.title}
		icon="book"
		backHref="/catalog/{data.id}"
		backLabel={data.title}
	/>
	<BiblioForm
		{form}
		{options}
		submitLabel={i18n.t("catalog.form.save")}
		cancelHref="/catalog/{data.id}"
		{initial}
		id={data.id}
	>
		{#snippet extra(state, fields)}
			{#if data.item}
				<input {...fields.itemId?.as("hidden", String(data.item.id))} />
				<FormSection
					title={i18n.t("catalog.form.singleCopy", { barcode: data.item.barcode })}
					description={i18n.t("catalog.form.singleCopyHint")}
				>
					<Grid span>
						{#if copyText}
							<Field
								label={i18n.t(
									isFreeScheme(options.callNumber)
										? "catalog.item.callNumber"
										: "catalog.item.callText",
								)}
								><Input
									mono
									{...fields.itemCallText?.as("text")}
									maxlength={40}
									data-testid="edit-item-call-text"
								/></Field
							>
						{/if}
						{#if options.classPerItem && options.fictionByClass && state.kind === "fiction"}
							<Field label={i18n.t("catalog.item.readingLevel")}
								><Select {...fields.itemReadingLevel?.as("select")}>
									<option value="">{i18n.t("catalog.picker.anyClass")}</option>
									{#each options.readingLevels as l (l.code)}
										<option value={l.code}>{l.label}</option>
									{/each}
								</Select></Field
							>
						{/if}
						<Field label={i18n.t("catalog.item.enumeration")}
							><Input {...fields.itemEnumeration?.as("text")} /></Field
						>
						<div>
							<Field label={i18n.t("catalog.item.acquisitionDate")}
								><Input
									{...fields.itemAcquisitionDate?.as("text")}
									type="date"
									data-testid="edit-item-acquisition-date"
								/></Field
							>
							{#each fields.itemAcquisitionDate?.issues() ?? [] as issue (issue.message)}
								<Hint
									tone="error"
									as="span"
									data-testid="field-error-itemAcquisitionDate"
									>{issue.message}</Hint
								>
							{/each}
						</div>
						<Field label={i18n.t("catalog.item.notes")} span
							><Input {...fields.itemNotes?.as("text")} /></Field
						>
						<Row wrap={false} align="center" as="label" class="md:col-span-2">
							<input {...fields.itemNotForLoan?.as("checkbox")} class="checkbox" />
							<span>{i18n.t("catalog.item.notForLoan")}</span>
						</Row>
					</Grid>
				</FormSection>
			{/if}
		{/snippet}
	</BiblioForm>
</Page>
