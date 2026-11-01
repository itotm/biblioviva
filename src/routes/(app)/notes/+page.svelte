<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Segnalazioni (step 9.18, Q113): the open staff notes as post-its, the pinned ones first;
     "Nuova segnalazione" for every account; the administrator pins, unpins and archives. -->
<script lang="ts">
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import NoteDialog from "#lib/components/notes/NoteDialog.svelte";
	import NoteGrid from "#lib/components/notes/NoteGrid.svelte";
	import NoteTile from "#lib/components/notes/NoteTile.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { archiveNote, getOpenNotes, pinNote } from "#lib/remote/notes.remote.js";
	import type { NoteRow } from "#lib/server/services/notes.js";
	import Button from "#lib/ui/Button.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import QueryState from "#lib/ui/QueryState.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const t = (key: string, params?: Record<string, unknown>): string =>
		i18n.t(`notes.${key}`, params);
	const AddIcon = icons.add;
	const PinIcon = icons.pin;
	const UnpinIcon = icons.unpin;
	const ArchiveIcon = icons.archive;

	let adding = $state(false);
	let busy = $state<number | null>(null);
	const list = getOpenNotes();
	const notes = $derived(list.current ?? []);

	async function run(note: NoteRow, action: () => Promise<unknown>, done: string): Promise<void> {
		busy = note.id;
		try {
			await action();
			toaster.success({ title: t(`done.${done}`) });
		} catch {
			toaster.error({ title: i18n.t("common.status.error") });
		} finally {
			busy = null;
			void list.refresh();
		}
	}
</script>

<Page width="2xl">
	<PageHeader title={t("title")} icon="notes">
		{#snippet actions()}
			<Button
				variant="primary"
				icon={AddIcon}
				onclick={() => (adding = true)}
				data-testid="note-new">{t("new")}</Button
			>
		{/snippet}
		{#snippet views()}
			<AreaTabs area="notes" current="open" />
		{/snippet}
	</PageHeader>

	{#if !data.isAdmin}
		<Hint data-testid="notes-admin-only">{t("adminOnly")}</Hint>
	{/if}

	<QueryState query={list} isEmpty={(open) => open.length === 0}>
		{#snippet empty()}
			<EmptyState title={t("empty.open")} description={t("empty.openHint")} icon="notes">
				{#snippet action()}
					<Button variant="primary" icon={AddIcon} onclick={() => (adding = true)}
						>{t("new")}</Button
					>
				{/snippet}
			</EmptyState>
		{/snippet}
		<Hint tone="count" data-testid="notes-count">{t("count", { count: notes.length })}</Hint>
		<NoteGrid data-testid="notes-grid">
			{#each notes as note (note.id)}
				<li>
					<NoteTile {note} actions={data.isAdmin ? adminActions : undefined} />
				</li>
			{/each}
		</NoteGrid>
	</QueryState>
</Page>

{#snippet adminActions(note: NoteRow)}
	<Button
		size="sm"
		icon={note.pinned ? UnpinIcon : PinIcon}
		disabled={busy === note.id}
		onclick={() =>
			run(
				note,
				() => pinNote({ id: note.id, pinned: !note.pinned }),
				note.pinned ? "unpinned" : "pinned",
			)}
		data-testid="note-pin">{note.pinned ? t("actions.unpin") : t("actions.pin")}</Button
	>
	<Button
		size="sm"
		icon={ArchiveIcon}
		disabled={busy === note.id}
		onclick={() => run(note, () => archiveNote({ id: note.id }), "archived")}
		data-testid="note-archive">{t("actions.archive")}</Button
	>
{/snippet}

<NoteDialog bind:open={adding} canPin={data.isAdmin} onadded={() => void list.refresh()} />
