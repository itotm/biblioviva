<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The patron page's notes (step 2.1): the circulation note shown at the desk and the free notes,
     edited in place, and when the patron was created. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { updatePatronNotes } from "#lib/remote/patrons.remote.js";
	import type { getPatronDetail } from "#lib/remote/patrons.remote.js";
	import { useFormat } from "#lib/ui/format.js";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Button from "#lib/ui/Button.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";

	type Patron = Awaited<ReturnType<typeof getPatronDetail>>;

	interface Props {
		patron: Patron;
	}

	const { patron: p }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const EditIcon = icons.edit;
	let busy = $state(false);
	let notesMode = $state(false);
	let circulationNoteDraft = $state("");
	let notesDraft = $state("");

	function openNotes(): void {
		circulationNoteDraft = p.circulationNote ?? "";
		notesDraft = p.notes ?? "";
		notesMode = true;
	}

	async function saveNotes(): Promise<void> {
		busy = true;
		try {
			const r = await updatePatronNotes({
				id: p.id,
				circulationNote: circulationNoteDraft,
				notes: notesDraft,
			});
			notesMode = false;
			toaster.success({
				title: i18n.t(
					r.changed.length
						? "patrons.detail.notesSaved"
						: "patrons.detail.notesUnchanged",
				),
			});
		} finally {
			busy = false;
		}
	}
</script>

{#if notesMode}
	<form
		class="space-y-3"
		onsubmit={(e) => {
			e.preventDefault();
			void saveNotes();
		}}
		data-testid="notes-form"
	>
		<Hint>{i18n.t("patrons.detail.notesHint")}</Hint>
		<Field label={i18n.t("patrons.fields.circulationNote")}
			><Input
				maxlength={500}
				bind:value={circulationNoteDraft}
				data-testid="circulation-note-input"
			/></Field
		>
		<Field label={i18n.t("patrons.fields.notes")}
			><textarea
				class="textarea"
				rows="4"
				maxlength="2000"
				bind:value={notesDraft}
				data-testid="notes-input"></textarea></Field
		>
		<Row>
			<Button variant="primary" type="submit" disabled={busy} data-testid="save-notes"
				>{i18n.t("common.actions.save")}</Button
			>
			<Button onclick={() => (notesMode = false)} disabled={busy}
				>{i18n.t("common.actions.cancel")}</Button
			>
		</Row>
	</form>
{:else}
	{#if p.notes || p.circulationNote}
		{#if p.circulationNote}<p data-testid="notes-circulation">
				<strong>{i18n.t("patrons.fields.circulationNote")}:</strong>
				{p.circulationNote}
			</p>{/if}
		{#if p.notes}<p class="whitespace-pre-line" data-testid="notes-text">
				{p.notes}
			</p>{/if}
	{:else}
		<p class="opacity-70">{i18n.t("patrons.detail.noNotes")}</p>
	{/if}
	{#if p.status !== "anonymized"}
		<Button icon={EditIcon} onclick={openNotes} data-testid="edit-notes"
			>{i18n.t("patrons.detail.notesEdit")}</Button
		>
	{/if}
{/if}
<p class="mt-4 text-xs opacity-60">
	{i18n.t("patrons.detail.created", {
		when: fmt.dateTime(p.createdAt),
	})}
</p>
