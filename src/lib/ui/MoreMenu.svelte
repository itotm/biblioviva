<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The other actions of a page header (9.13, round 21): the main action first and in colour, at
     most one more button beside it, the rest here as `MenuItem` entries (a destructive one in red,
     last). The trigger is a ⋮ button of the buttons' height, named "Altre azioni". -->
<script lang="ts">
	import { Menu } from "@skeletonlabs/skeleton-svelte";
	import type { Snippet } from "svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { ICON_SIZE, icons } from "./icons.js";
	import MenuPanel from "./MenuPanel.svelte";
	import { MORE_TRIGGER_CLASS } from "./page-actions.js";

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();
	const i18n = useI18n();
	const MoreIcon = icons.moreActions;
</script>

<Menu>
	<Menu.Trigger
		class={MORE_TRIGGER_CLASS}
		aria-label={i18n.t("common.actions.more")}
		title={i18n.t("common.actions.more")}
		data-testid="more-actions"
	>
		<MoreIcon size={ICON_SIZE.md} aria-hidden="true" />
	</Menu.Trigger>
	<MenuPanel minWidth="56">{@render children()}</MenuPanel>
</Menu>
