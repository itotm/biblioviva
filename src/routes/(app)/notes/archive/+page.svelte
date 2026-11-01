<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The archived staff notes (step 9.18): readable by every account, the most recently archived
     first, a page at a time; the administrator restores a note or deletes it for good. -->
<script lang="ts">
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import NoteGrid from "#lib/components/notes/NoteGrid.svelte";
	import NoteTile from "#lib/components/notes/NoteTile.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { getArchivedNotes, removeNote, unarchiveNote } from "#lib/remote/notes.remote.js";
	import type { NoteRow } from "#lib/server/services/notes.js";
	import Button from "#lib/ui/Button.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import QueryState from "#lib/ui/QueryState.svelte";

	const PAGE = 48;
	const { data } = $props();
	const i18n = useI18n();
	const t = (key: string, params?: Record<string, unknown>): string =>
		i18n.t(`notes.${key}`, params);
	const RestoreIcon = icons.restore;
	const DeleteIcon = icons.delete;

	let limit = $state(PAGE);
	let busy = $state<number | null>(null);
	let deleting = $state<NoteRow | null>(null);
	const list = $derived(getArchivedNotes({ limit }));
	const archived = $derived(list.current);
	const notes = $derived(archived?.rows ?? []);

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
	<PageHeader
		title={t("title")}
		docTitle="{i18n.t('nav.areas.notes.archived')} · {t('title')}"
		icon="notes"
	>
		{#snippet views()}
			<AreaTabs area="notes" current="archived" />
		{/snippet}
	</PageHeader>

	<QueryState query={list} isEmpty={(a) => a.rows.length === 0}>
		{#snippet empty()}
			<EmptyState title={t("empty.archived")} icon="archive" />
		{/snippet}
		{#snippet children(archived)}
			<Hint tone="count" data-testid="notes-count"
				>{t("archiveCount", { shown: notes.length, total: archived.total })}</Hint
			>
			<NoteGrid data-testid="notes-grid">
				{#each notes as note (note.id)}
					<li>
						<NoteTile {note} actions={data.isAdmin ? adminActions : undefined} />
					</li>
				{/each}
			</NoteGrid>
			{#if notes.length < archived.total}
				<div class="text-center">
					<Button onclick={() => (limit += PAGE)} data-testid="notes-more"
						>{t("actions.more")}</Button
					>
				</div>
			{/if}
		{/snippet}
	</QueryState>

	<ConfirmDialog
		open={deleting !== null}
		title={t("confirmDelete.title")}
		description={t("confirmDelete.text")}
		tone="error"
		confirmLabel={t("actions.delete")}
		onconfirm={async () => {
			const note = deleting;
			deleting = null;
			if (note) {
				await run(note, () => removeNote({ id: note.id }), "deleted");
			}
		}}
		oncancel={() => (deleting = null)}
	/>
</Page>

{#snippet adminActions(note: NoteRow)}
	<Button
		size="sm"
		icon={RestoreIcon}
		disabled={busy === note.id}
		onclick={() => run(note, () => unarchiveNote({ id: note.id }), "restored")}
		data-testid="note-restore">{t("actions.restore")}</Button
	>
	<Button
		size="sm"
		variant="error-tonal"
		icon={DeleteIcon}
		disabled={busy === note.id}
		onclick={() => (deleting = note)}
		data-testid="note-delete">{t("actions.delete")}</Button
	>
{/snippet}
