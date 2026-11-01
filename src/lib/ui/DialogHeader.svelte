<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The header of every dialog (step 1.15): the title, an optional muted note after it, and the
     close button. Use inside a Skeleton `Dialog` (with `DialogFrame`). -->
<script lang="ts">
	import { Dialog } from "@skeletonlabs/skeleton-svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import Hint from "./Hint.svelte";
	import { ICON_SIZE, icons } from "./icons.js";
	import Row from "./Row.svelte";

	interface Props {
		title: string;
		/** Shown after the title, muted (e.g. "· 32 copie"). */
		note?: string;
	}

	const { title, note }: Props = $props();
	const i18n = useI18n();
	const CloseIcon = icons.close;
</script>

<Row wrap={false} align="center" justify="between" as="header">
	<Dialog.Title class="title-lg">
		{title}
		{#if note}<Hint as="span">· {note}</Hint>{/if}
	</Dialog.Title>
	<Dialog.CloseTrigger
		class="btn-icon hover:preset-tonal"
		aria-label={i18n.t("common.actions.close")}
	>
		<CloseIcon size={ICON_SIZE.sm} aria-hidden="true" />
	</Dialog.CloseTrigger>
</Row>
