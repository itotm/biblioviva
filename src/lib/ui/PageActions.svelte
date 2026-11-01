<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The actions of a page header (9.13, rounds 21–22): the main action first and in colour, a
     destructive one last. When they all fit on one row with room to spare they are all buttons;
     otherwise the first ones stay buttons — `keep` at most, as many as fit beside the menu, one at
     least — and the rest go under "Altre azioni" (`MoreMenu`). The row is measured on a hidden
     copy of the buttons and of the menu's button, again whenever the header changes width;
     until the first measure it stays invisible, so a phone never shows the full row for a moment. -->
<script lang="ts">
	import Button from "./Button.svelte";
	import MenuItem from "./MenuItem.svelte";
	import MoreMenu from "./MoreMenu.svelte";
	import { ICON_SIZE, icons } from "./icons.js";
	import { MORE_TRIGGER_CLASS, type PageAction } from "./page-actions.js";

	interface Props {
		actions: readonly PageAction[];
		/** Buttons kept beside the menu when the row does not fit (fewer if they do not fit). */
		keep?: number;
	}

	const { actions, keep = 2 }: Props = $props();
	/** Free room the full row must leave, so the buttons are never pressed against the edge. */
	const MARGIN_PX = 48;
	const MoreIcon = icons.moreActions;
	let root = $state<HTMLElement | null>(null);
	let ghost = $state<HTMLElement | null>(null);
	/** Buttons shown before the menu (null: not measured yet; every action: no menu). */
	let kept = $state<number | null>(null);
	const mode = $derived(kept === null ? null : kept >= actions.length ? "full" : "compact");
	const shown = $derived(actions.slice(0, kept ?? actions.length));
	const rest = $derived(actions.slice(kept ?? actions.length));

	$effect(() => {
		const box = root;
		const row = ghost;
		if (!box || !row) {
			return;
		}
		const measure = (): void => {
			const room = box.clientWidth;
			// the widths of the copied buttons, the menu's button last
			const widths = [...row.children].map((c) => c.getBoundingClientRect().width);
			const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
			const menu = widths.pop() ?? 0;
			const width = (n: number): number =>
				widths.slice(0, n).reduce((a, w) => a + w, 0) + gap * Math.max(0, n - 1);
			if (actions.length <= keep || width(actions.length) + MARGIN_PX <= room) {
				kept = actions.length;
				return;
			}
			let k = keep;
			while (k > 1 && width(k) + gap + menu > room) {
				k--;
			}
			kept = k;
		};
		const observer = new ResizeObserver(measure);
		observer.observe(box);
		measure();
		return () => observer.disconnect();
	});

	const variant = (a: PageAction): "primary" | "error-outlined" | "tonal" =>
		a.primary ? "primary" : a.danger ? "error-outlined" : "tonal";
</script>

{#snippet button(a: PageAction, testid: string | undefined)}
	<Button
		variant={variant(a)}
		icon={a.icon}
		href={a.href}
		download={a.download}
		onclick={a.onclick}
		disabled={a.disabled}
		data-testid={testid}>{a.label}</Button
	>
{/snippet}

<div
	bind:this={root}
	class="relative flex w-full min-w-0 flex-wrap items-center justify-end gap-2 {mode === null
		? 'invisible'
		: ''}"
	data-mode={mode}
	data-testid="page-actions-row"
>
	{#each shown as a (a.key)}
		{@render button(a, a.testid)}
	{/each}
	{#if rest.length > 0}
		<MoreMenu>
			{#each rest as a (a.key)}
				<MenuItem
					value={a.key}
					icon={a.icon}
					iconSize="md"
					href={a.href}
					download={a.download}
					tone={a.danger ? "error" : undefined}
					disabled={a.disabled}
					onclick={a.onclick}
					data-testid={a.testid}>{a.label}</MenuItem
				>
			{/each}
		</MoreMenu>
	{/if}
	<!-- the full row, out of sight and out of reach, measured for its width (in a box of no size,
	     so it never widens the page) -->
	<div class="absolute top-0 left-0 size-0 overflow-hidden" aria-hidden="true" inert>
		<div bind:this={ghost} class="invisible flex w-max gap-2">
			{#each actions as a (a.key)}
				{@render button(a, undefined)}
			{/each}
			<span class={MORE_TRIGGER_CLASS}><MoreIcon size={ICON_SIZE.md} /></span>
		</div>
	</div>
</div>
