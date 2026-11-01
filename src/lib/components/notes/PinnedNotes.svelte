<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The pinned staff notes at the top of the account's first page (step 9.18): the dashboard, or
     the checkout desk for the accounts that open there. Nothing when none is pinned. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import type { NoteRow } from "#lib/server/services/notes.js";
	import Button from "#lib/ui/Button.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import NoteGrid from "./NoteGrid.svelte";
	import NoteTile from "./NoteTile.svelte";

	interface Props {
		notes: readonly NoteRow[];
		/** Shorter tiles (the desk). */
		compact?: boolean;
	}

	const { notes, compact = false }: Props = $props();
	const i18n = useI18n();
	const PinIcon = icons.pin;
</script>

{#if notes.length > 0}
	<section class="space-y-3" data-testid="pinned-notes">
		<Row align="center" justify="between" gap="2">
			<Row as="h2" align="center" gap="2" class="font-semibold">
				<PinIcon size={ICON_SIZE.md} aria-hidden="true" />
				{i18n.t("notes.home.title")}
			</Row>
			<Button size="sm" icon={icons.notes} href="/notes" data-testid="pinned-notes-open"
				>{i18n.t("notes.home.open")}</Button
			>
		</Row>
		<NoteGrid narrow>
			{#each notes as note (note.id)}
				<li><NoteTile {note} {compact} showPinned={false} /></li>
			{/each}
		</NoteGrid>
	</section>
{/if}
