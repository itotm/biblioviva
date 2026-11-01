<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A switch between views (9.13, rounds 24–25): pills with the buttons' corners in one grey track,
     a little apart, the current one tinted with a blue border and a tick, so a view never looks like an action (actions are buttons, the
     main one filled). Links (`href`: the pages of an area, as the desk) mark the current page;
     buttons (a filter) are pressed toggles. On a phone the pills stay on one line that scrolls
     sideways, the current one brought into sight. `framed`: in a card of its own, for a switch
     that is not in a page header's toolbar. -->
<script lang="ts" generics="K extends string">
	import type { ResolvedPathname } from "$app/types";
	import { ICON_SIZE, icons, type IconComponent } from "./icons.js";
	import Card from "./Card.svelte";

	interface Choice {
		key: K;
		label: string;
		icon?: IconComponent;
		href?: ResolvedPathname;
	}

	interface Props {
		choices: readonly Choice[];
		current: K;
		onselect?: (key: K) => void;
		label: string;
		testid?: string;
		/** Prefix of each choice's test id (`<prefix><key>`). */
		itemTestid?: string;
		framed?: boolean;
	}

	const {
		choices,
		current,
		onselect,
		label,
		testid,
		itemTestid = "choice-",
		framed = true,
	}: Props = $props();
	const CurrentIcon = icons.confirm;
	let track = $state<HTMLElement | null>(null);

	// a track wider than the window scrolls: the current pill is shown, not left behind the edge
	$effect(() => {
		const row = track;
		const pill = row?.querySelector<HTMLElement>("[data-current]");
		if (row && pill && row.scrollWidth > row.clientWidth) {
			row.scrollLeft = pill.offsetLeft - row.offsetLeft - 24;
		}
	});

	const PILL =
		"inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-base border px-3.5 text-sm font-semibold whitespace-nowrap md:min-h-9";
	const pillClass = (key: K): string =>
		key === current
			? `${PILL} border-primary-500 bg-primary-100 text-primary-800`
			: `${PILL} border-surface-200 bg-white text-surface-700 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800`;
</script>

{#snippet pills()}
	<nav
		bind:this={track}
		aria-label={label}
		class="flex max-w-full gap-2 overflow-x-auto rounded-container border border-surface-200 bg-surface-100 p-2 md:w-fit md:flex-wrap"
		data-testid={testid}
	>
		{#each choices as c (c.key)}
			{@const Icon = c.key === current ? CurrentIcon : c.icon}
			{#if c.href}
				<a
					href={c.href}
					class={pillClass(c.key)}
					aria-current={c.key === current ? "page" : undefined}
					data-current={c.key === current ? "" : undefined}
					data-testid="{itemTestid}{c.key}"
				>
					{#if Icon}<Icon size={ICON_SIZE.sm} aria-hidden="true" />{/if}{c.label}
				</a>
			{:else}
				<button
					type="button"
					class={pillClass(c.key)}
					aria-pressed={c.key === current}
					data-current={c.key === current ? "" : undefined}
					onclick={() => onselect?.(c.key)}
					data-testid="{itemTestid}{c.key}"
				>
					{#if Icon}<Icon size={ICON_SIZE.sm} aria-hidden="true" />{/if}{c.label}
				</button>
			{/if}
		{/each}
	</nav>
{/snippet}

{#if framed}
	<Card>{@render pills()}</Card>
{:else}
	{@render pills()}
{/if}
