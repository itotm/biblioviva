<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Nuova segnalazione" (step 9.18): the text with a character counter, the post-it colour as
     named swatches, "In evidenza sulla dashboard" for administrators; a note cannot be edited
     later, and every account reads it, so the dialog says both. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { addNote } from "#lib/remote/notes.remote.js";
	import { NOTE_COLORS, NOTE_MAX_LENGTH, type NoteColor } from "#lib/shared/notes.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";

	interface Props {
		open?: boolean;
		/** The account may pin the note to the dashboard (`admin`). */
		canPin: boolean;
		onadded?: () => void;
	}

	let { open = $bindable(false), canPin, onadded }: Props = $props();
	const i18n = useI18n();
	const AddIcon = icons.add;
	const t = (key: string, params?: Record<string, unknown>): string =>
		i18n.t(`notes.${key}`, params);

	let body = $state("");
	let color = $state<NoteColor>("yellow");
	let pinned = $state(false);
	let problem = $state<string | null>(null);
	let saving = $state(false);
	const length = $derived(body.trim().length);

	function reset(): void {
		body = "";
		color = "yellow";
		pinned = false;
		problem = null;
	}

	async function save(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (length === 0) {
			problem = t("errors.empty");
			return;
		}
		if (length > NOTE_MAX_LENGTH) {
			problem = t("errors.tooLong", { max: NOTE_MAX_LENGTH });
			return;
		}
		saving = true;
		try {
			const r = await addNote({ body, color, pinned: canPin && pinned });
			if (!r.ok) {
				problem = t(`errors.${r.error}`, { max: NOTE_MAX_LENGTH });
				return;
			}
			toaster.success({ title: t("done.added") });
			open = false;
			reset();
			onadded?.();
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	bind:open
	title={t("new")}
	onclose={() => (problem = null)}
	width="lg"
	animated
	scroll
	data-testid="note-dialog"
>
	<form class="space-y-4" onsubmit={save}>
		<div>
			<label class="label">
				<span class="label-text">{t("form.body")}</span>
				<!-- svelte-ignore a11y_autofocus -->
				<textarea
					class="textarea"
					rows="5"
					bind:value={body}
					maxlength={NOTE_MAX_LENGTH + 50}
					placeholder={t("form.placeholder")}
					aria-describedby="note-privacy note-counter"
					autofocus
					data-testid="note-body-input"></textarea>
			</label>
			<Row justify="between" wrap={false} gap="3" class="mt-1">
				<Hint as="span" id="note-privacy">{t("form.privacy")}</Hint>
				<Hint
					as="span"
					tone={length > NOTE_MAX_LENGTH ? "error" : "muted"}
					id="note-counter"
					class="shrink-0 tabular-nums"
					data-testid="note-counter"
					>{t("form.counter", { count: length, max: NOTE_MAX_LENGTH })}</Hint
				>
			</Row>
		</div>

		<fieldset>
			<legend class="mb-1 label-text">{t("form.color")}</legend>
			<div class="flex flex-wrap gap-2" data-testid="note-colors">
				{#each NOTE_COLORS as c (c)}
					<label
						class="flex min-h-11 cursor-pointer items-center gap-2 rounded-base border border-surface-300 px-3 py-1.5 hover:bg-surface-100 has-checked:border-primary-500 has-checked:font-semibold has-checked:ring-2 has-checked:ring-primary-500/40 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-500"
					>
						<input
							type="radio"
							name="note-color"
							value={c}
							bind:group={color}
							class="sr-only"
							data-testid="note-color-{c}"
						/>
						<span
							class="bv-note-swatch size-6 rounded-sm"
							data-note-color={c}
							aria-hidden="true"
						></span>
						<span class="text-sm">{t(`colors.${c}`)}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		{#if canPin}
			<div>
				<Checkbox bind:checked={pinned} data-testid="note-pinned-input"
					>{t("form.pinned")}</Checkbox
				>
				<Hint class="ml-7">{t("form.pinnedHint")}</Hint>
			</div>
		{/if}

		<Hint>{t("form.written")}</Hint>
		{#if problem}
			<Alert data-testid="note-problem">{problem}</Alert>
		{/if}
		<Row justify="end" as="footer">
			<Button onclick={() => (open = false)} disabled={saving}
				>{i18n.t("common.actions.cancel")}</Button
			>
			<Button
				type="submit"
				variant="primary"
				icon={AddIcon}
				disabled={saving}
				data-testid="note-save">{t("form.save")}</Button
			>
		</Row>
	</form>
</Modal>
