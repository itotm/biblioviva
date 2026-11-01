<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A dashboard tile (step 4.9): a coloured icon, a large number and its label; with `href` the
     whole tile is a link, with `onclick` a button (9.13: the labels tile opens the printing dialog),
     both with hover feedback. Colour is never the only cue: the label says it. -->
<script lang="ts">
	import type { ResolvedPathname } from "$app/types";
	import IconTile from "./IconTile.svelte";
	import { ICON_SIZE, icons, type IconName } from "./icons.js";
	import LinkCard from "./LinkCard.svelte";

	interface Props {
		icon: IconName;
		value: number;
		label: string;
		href?: ResolvedPathname;
		onclick?: () => void;
		tone?: "primary" | "error" | "warning" | "success" | "tertiary";
		testid?: string;
	}

	const { icon, value, label, href, onclick, tone = "primary", testid }: Props = $props();
	const Icon = $derived(icons[icon]);
	const TONE = {
		primary: "preset-tonal-primary",
		error: "preset-tonal-error",
		warning: "preset-tonal-warning",
		success: "preset-tonal-success",
		tertiary: "preset-tonal-tertiary",
	} as const;
</script>

<LinkCard
	{href}
	{onclick}
	class="flex flex-col items-start gap-2 p-3 text-left sm:flex-row sm:items-center sm:gap-4 sm:p-4"
	data-testid={testid}
>
	<IconTile size="size-10 sm:size-12" class={TONE[tone]}>
		<Icon size={ICON_SIZE.lg} aria-hidden="true" />
	</IconTile>
	<span class="min-w-0">
		<span class="block text-3xl leading-none font-bold" data-testid="tile-value">{value}</span>
		<span class="block text-sm opacity-80">{label}</span>
	</span>
</LinkCard>
