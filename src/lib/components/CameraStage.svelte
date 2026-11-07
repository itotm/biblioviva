<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The stage of a camera flow (census, stocktaking): full screen on a phone, so the camera and
     what it read fill the screen and the work goes on one-handed; an ordinary card from md up.
     Full screen it is a modal dialog (WCAG 2.4.3, 4.1.2): named by its first heading, the focus
     moved into it, the page behind inert, Escape closes it (`onclose`), the focus given back. -->
<script lang="ts">
	import { onMount, type Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLElement> {
		children: Snippet;
		/** Closes the flow (Escape on a phone); the same as the flow's own close button. */
		onclose?: () => void;
	}

	const { children, onclose, ...rest }: Props = $props();
	const uid = $props.id();
	let stage = $state<HTMLElement>();
	/** Full screen: the phone's layout (below `md`, as the classes below). */
	let modal = $state(false);

	onMount(() => {
		const node = stage;
		if (!node || !window.matchMedia("(max-width: 767px)").matches) {
			return;
		}
		modal = true;
		const before =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		// the page behind: every sibling of the stage and of its ancestors, up to the body; the
		// notifications stay alive, so what the flow says is still announced
		const made: HTMLElement[] = [];
		const keep = '[data-scope="toast"], [aria-live], script, style';
		for (let el: HTMLElement | null = node; el && el !== document.body; el = el.parentElement) {
			for (const sibling of el.parentElement?.children ?? []) {
				if (
					sibling !== el &&
					sibling instanceof HTMLElement &&
					!sibling.inert &&
					!sibling.matches(keep)
				) {
					sibling.inert = true;
					made.push(sibling);
				}
			}
		}
		const heading = node.querySelector<HTMLElement>("h1, h2, h3");
		if (heading) {
			heading.id ||= `${uid}-title`;
			node.setAttribute("aria-labelledby", heading.id);
		}
		node.focus();
		return () => {
			for (const el of made) {
				el.inert = false;
			}
			if (before?.isConnected) {
				before.focus();
			}
		};
	});

	function onkeydown(e: KeyboardEvent): void {
		if (modal && e.key === "Escape" && onclose) {
			e.preventDefault();
			onclose();
		}
	}
</script>

<section
	{...rest}
	bind:this={stage}
	role={modal ? "dialog" : undefined}
	aria-modal={modal ? "true" : undefined}
	tabindex="-1"
	{onkeydown}
	class="fixed inset-0 z-50 flex flex-col gap-3 overflow-y-auto bg-surface-50 p-4 outline-none md:static md:z-auto md:rounded-container md:border md:border-surface-200 md:shadow-[var(--bv-shadow-card)]"
>
	{@render children()}
</section>
