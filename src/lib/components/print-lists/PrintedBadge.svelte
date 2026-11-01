<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- How far something of a print list has been printed, as colour + icon + text (§3.18): both
     labels of a copy, one of the two, none; a patron's card printed or not. The text is the
     caller's, the tone and the icon follow the state. -->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { icons } from "#lib/ui/icons.js";
	import { PRINT_LOOK } from "#lib/ui/status.js";
	import Badge from "#lib/ui/Badge.svelte";

	interface Props {
		status: keyof typeof PRINT_LOOK;
		"data-testid"?: string;
		children: Snippet;
	}

	const { status, children, ...rest }: Props = $props();
	const look = $derived(PRINT_LOOK[status]);
</script>

<Badge tone={look.tone} icon={icons[look.icon]} {...rest}>{@render children()}</Badge>
