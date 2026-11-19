<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The header of every dialog (step 1.15): the title, an optional muted note after it, an optional
     help icon (9.5b), and the close button. Use inside a Skeleton `Dialog` (with `DialogFrame`). -->
<script lang="ts">
	import { Dialog } from "@skeletonlabs/skeleton-svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import type { HelpSpot } from "./help-spots.js";
	import HelpLink from "./HelpLink.svelte";
	import Hint from "./Hint.svelte";
	import { ICON_SIZE, icons } from "./icons.js";
	import Row from "./Row.svelte";

	interface Props {
		title: string;
		/** Shown after the title, muted (e.g. "· 32 copie"). */
		note?: string;
		/** The part of the documentation that explains the dialog (a key of `HELP_SPOTS`). */
		help?: HelpSpot;
	}

	const { title, note, help }: Props = $props();
	const i18n = useI18n();
	const CloseIcon = icons.close;
</script>

<Row wrap={false} align="center" justify="between" as="header">
	<Row wrap={false} align="center" gap="1">
		<Dialog.Title class="title-lg">
			{title}
			{#if note}<Hint as="span">· {note}</Hint>{/if}
		</Dialog.Title>
		{#if help}<HelpLink spot={help} topic={title} />{/if}
	</Row>
	<Dialog.CloseTrigger
		class="btn-icon hover:preset-tonal"
		aria-label={i18n.t("common.actions.close")}
	>
		<CloseIcon size={ICON_SIZE.sm} aria-hidden="true" />
	</Dialog.CloseTrigger>
</Row>
