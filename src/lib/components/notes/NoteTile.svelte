<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A staff note as a post-it (step 9.18): its colour, "In evidenza" with the pin when pinned, the
     text with its line breaks (a long one clamped, "Mostra tutto" opens it), the account and the
     time it was written, who archived it; the administrator's buttons come from the caller. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import type { NoteRow } from "#lib/server/services/notes.js";
	import { useFormat } from "#lib/ui/format.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";

	interface Props {
		note: NoteRow;
		/** Fewer lines before "Mostra tutto" (the strip at the top of the desk). */
		compact?: boolean;
		/** "In evidenza" on a pinned note; off where every note shown is pinned (the dashboard). */
		showPinned?: boolean;
		/** The administrator's buttons, given the note. */
		actions?: Snippet<[NoteRow]>;
	}

	const { note, compact = false, showPinned = true, actions }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const PinIcon = icons.pin;
	let expanded = $state(false);
	const lines = $derived(note.body.split("\n").length);
	const long = $derived(
		compact ? note.body.length > 140 || lines > 3 : note.body.length > 320 || lines > 8,
	);
</script>

<article
	class="bv-note flex h-full flex-col gap-2 p-4 pr-6"
	data-note-color={note.color}
	data-testid="note"
	data-note-id={note.id}
>
	{#if note.pinned && showPinned}
		<p class="flex items-center gap-1.5 text-sm font-bold" data-testid="note-pinned">
			<PinIcon size={ICON_SIZE.sm} aria-hidden="true" />{i18n.t("notes.pinned")}
		</p>
	{/if}
	<p
		class="break-words whitespace-pre-line {long && !expanded
			? compact
				? 'line-clamp-3'
				: 'line-clamp-8'
			: ''}"
		data-testid="note-body"
	>
		{note.body}
	</p>
	{#if long}
		<button
			type="button"
			class="self-start text-sm font-semibold underline underline-offset-2 hover:no-underline"
			aria-expanded={expanded}
			onclick={() => (expanded = !expanded)}
			>{expanded ? i18n.t("notes.actions.showLess") : i18n.t("notes.actions.showAll")}</button
		>
	{/if}
	<footer class="mt-auto space-y-0.5 pt-1 text-sm text-surface-800">
		<p data-testid="note-author">
			{i18n.t("notes.wrote", {
				author: note.author ?? "—",
				when: fmt.dateTime(note.createdAt),
			})}
		</p>
		{#if note.archivedAt}
			<p data-testid="note-archived">
				{i18n.t("notes.archivedBy", {
					author: note.archivedBy ?? "—",
					when: fmt.dateTime(note.archivedAt),
				})}
			</p>
		{/if}
	</footer>
	{#if actions}
		<div
			class="flex flex-wrap gap-2 border-t border-surface-950/10 pt-2"
			role="group"
			aria-label={i18n.t("notes.actions.label")}
		>
			{@render actions(note)}
		</div>
	{/if}
</article>
