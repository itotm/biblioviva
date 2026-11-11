<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A notable date of the calendar (step 9.25): the title, the day and, for a period, the last day,
     an optional note; "Elimina" when an existing date is edited. Every account reads the dates,
     so the dialog says not to write pupils' personal data. -->
<script lang="ts">
	import { untrack } from "svelte";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { removeCalendarEvent, saveCalendarEvent } from "#lib/remote/calendar.remote.js";
	import type { CalendarEventRow } from "#lib/server/services/calendar-events.js";
	import { EVENT_NOTES_MAX, EVENT_TITLE_MAX } from "#lib/shared/calendar-events.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";

	interface Props {
		open?: boolean;
		/** The date being edited; null for a new one (starting on `day`). */
		edited: CalendarEventRow | null;
		/** The day a new date starts on. */
		day: string;
		onsaved?: () => void;
	}

	let { open = $bindable(false), edited, day, onsaved }: Props = $props();
	const i18n = useI18n();
	const SaveIcon = icons.save;
	const DeleteIcon = icons.delete;
	const t = (key: string, params?: Record<string, unknown>): string =>
		i18n.t(`circulation.calendar.${key}`, params);

	let title = $state("");
	let notes = $state("");
	let startsOn = $state("");
	let endsOn = $state("");
	let problem = $state<string | null>(null);
	let saving = $state(false);
	let confirmDelete = $state(false);

	// every opening starts from the date edited, or from an empty one on the chosen day; only the
	// opening does: the page's dates reloaded after a save must not wipe what is being typed
	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) {
			untrack(() => {
				title = edited?.title ?? "";
				notes = edited?.notes ?? "";
				startsOn = edited?.startsOn ?? day;
				endsOn = edited?.endsOn ?? "";
				problem = null;
			});
		}
		wasOpen = open;
	});

	async function save(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		saving = true;
		try {
			const r = await saveCalendarEvent({
				...(edited ? { id: edited.id } : {}),
				title,
				notes,
				startsOn,
				endsOn,
			});
			if (!r.ok) {
				problem = t(`errors.${r.error}`, {
					max: r.error === "notesTooLong" ? EVENT_NOTES_MAX : EVENT_TITLE_MAX,
				});
				return;
			}
			toaster.success({ title: t(edited ? "done.saved" : "done.added") });
			open = false;
			onsaved?.();
		} finally {
			saving = false;
		}
	}

	async function remove(): Promise<void> {
		if (!edited) {
			return;
		}
		saving = true;
		try {
			await removeCalendarEvent({ id: edited.id });
			toaster.success({ title: t("done.deleted") });
			confirmDelete = false;
			open = false;
			onsaved?.();
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	bind:open
	title={t(edited ? "form.editTitle" : "form.newTitle")}
	width="lg"
	animated
	scroll
	data-testid="calendar-dialog"
>
	<form class="space-y-4" onsubmit={save}>
		<Field label={t("form.title")}>
			<Input
				bind:value={title}
				maxlength={EVENT_TITLE_MAX}
				placeholder={t("form.titlePlaceholder")}
				autocomplete="off"
				required
				autofocus
				data-testid="calendar-title-input"
			/>
		</Field>
		<Grid>
			<Field label={t("form.startsOn")}>
				<Input
					type="date"
					bind:value={startsOn}
					required
					data-testid="calendar-starts-input"
				/>
			</Field>
			<Field label={t("form.endsOn")} hint={t("form.endsOnHint")}>
				<Input
					type="date"
					bind:value={endsOn}
					min={startsOn}
					data-testid="calendar-ends-input"
				/>
			</Field>
		</Grid>
		<Field label={t("form.notes")}>
			<textarea
				class="textarea"
				rows="3"
				bind:value={notes}
				maxlength={EVENT_NOTES_MAX}
				data-testid="calendar-notes-input"></textarea>
		</Field>
		<Hint>{t("form.privacy")}</Hint>
		{#if problem}
			<Alert data-testid="calendar-problem">{problem}</Alert>
		{/if}
		<Row justify="between" as="footer">
			{#if edited}
				<Button
					variant="error-outlined"
					icon={DeleteIcon}
					onclick={() => (confirmDelete = true)}
					disabled={saving}
					data-testid="calendar-delete">{t("form.delete")}</Button
				>
			{:else}
				<span></span>
			{/if}
			<Row wrap={false} justify="end">
				<Button onclick={() => (open = false)} disabled={saving}
					>{i18n.t("common.actions.cancel")}</Button
				>
				<Button
					type="submit"
					variant="primary"
					icon={SaveIcon}
					disabled={saving}
					data-testid="calendar-save">{t("form.save")}</Button
				>
			</Row>
		</Row>
	</form>
</Modal>

<ConfirmDialog
	bind:open={confirmDelete}
	title={t("form.deleteConfirm", { title: edited?.title ?? "" })}
	confirmLabel={t("form.delete")}
	tone="error"
	pending={saving}
	onconfirm={remove}
/>
