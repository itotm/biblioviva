<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A link to a section, drawn as a card with a large icon, a title and a muted description (the
     Administration and Configurazione home pages); `note` adds a small monospace line (a file
     name) and `badge` a warning pill. -->
<script lang="ts">
	import type { ResolvedPathname } from "$app/types";
	import Badge from "./Badge.svelte";
	import Hint from "./Hint.svelte";
	import IconTile from "./IconTile.svelte";
	import LinkCard from "./LinkCard.svelte";
	import TitleHint from "./TitleHint.svelte";
	import { ICON_SIZE, icons, type IconName } from "./icons.js";

	interface Props {
		href: ResolvedPathname;
		icon: IconName;
		title: string;
		description: string;
		note?: string;
		badge?: string;
		"data-testid"?: string;
	}

	const { href, icon, title, description, note, badge, ...rest }: Props = $props();
	const Icon = $derived(icons[icon]);
</script>

<LinkCard {href} variant="outlined" class="flex items-start gap-3 p-4" {...rest}>
	<IconTile size="size-10" class="bg-primary-100 text-primary-700">
		<Icon size={ICON_SIZE.lg} aria-hidden="true" />
	</IconTile>
	<span class="min-w-0 space-y-1">
		<TitleHint {title}>{description}</TitleHint>
		{#if note}<Hint as="span" mono class="block truncate">{note}</Hint>{/if}
		{#if badge}<Badge tone="warning">{badge}</Badge>{/if}
	</span>
</LinkCard>
