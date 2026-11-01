<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Annulla modifiche" and "Salva" of a block of a settings page (Phase 11), following its draft
     (`DraftEditor`): both wait while nothing changed or a save runs; Save waits too while the
     draft is invalid.
     Without `onundo` only Save is shown. The caller places them (usually in a `Row`). -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import Button from "#lib/ui/Button.svelte";
	import { icons } from "#lib/ui/icons.js";

	interface Props {
		/** Something changed since the last load or save. */
		dirty: boolean;
		saving: boolean;
		onsave: () => unknown;
		/** Loads the saved values again; no Undo button without it. */
		onundo?: () => void;
		/** The draft has problems: it cannot be saved. */
		invalid?: boolean;
		/** `data-testid` of the Save button. */
		testid: string;
	}

	const { dirty, saving, onsave, onundo, invalid = false, testid }: Props = $props();
	const i18n = useI18n();
	const SaveIcon = icons.save;
	const UndoIcon = icons.undo;
</script>

{#if onundo}
	<Button icon={UndoIcon} onclick={onundo} disabled={!dirty || saving}
		>{i18n.t("config.section.discard")}</Button
	>
{/if}
<Button
	variant="primary"
	icon={SaveIcon}
	onclick={onsave}
	disabled={!dirty || invalid || saving}
	data-testid={testid}>{i18n.t("config.section.save")}</Button
>
