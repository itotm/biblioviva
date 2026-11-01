<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The wait of the whole app (owner request): while SvelteKit loads the next page, or while a wait
     is held (`holdWait`: the login's check of the password), a light veil covers the page with the
     same wait as `Loading` in its centre. Inside the app shell it covers only the page's part of
     the window (`setWaitArea`): the menu, the top bar and the bottom bar stay in sight; outside it
     (the login) the whole window. It appears only when the wait lasts longer than DELAY_MS, so fast
     pages never flash it, and fades in and out (no fade under reduced motion). It takes the clicks
     (nothing is pressed twice while the app is busy) but never the focus, and the live region
     around it lets screen readers announce it politely. -->
<script lang="ts">
	import { navigating } from "$app/state";
	import { fade } from "svelte/transition";
	import Loading from "./Loading.svelte";
	import { hasWaitArea, heldWaits, waitArea, type WaitBox } from "./waits.svelte.js";

	/** A wait shorter than this shows nothing. */
	const DELAY_MS = 200;
	const FADE_MS = 180;

	const busy = $derived(navigating.to !== null || heldWaits() > 0);
	let visible = $state(false);
	let box = $state<WaitBox | null>(null);
	const duration = (): number =>
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
			? 0
			: FADE_MS;

	// one timer per wait: started when a wait begins, cleared when it ends (a redirect or a
	// navigation that replaces the one in flight keeps `busy` true and the same timer)
	$effect(() => {
		if (!busy) {
			visible = false;
			return;
		}
		const timer = setTimeout(() => {
			box = waitArea();
			visible = true;
		}, DELAY_MS);
		return () => {
			clearTimeout(timer);
		};
	});

	// the page's part of the window changes when it scrolls (the top bar of a phone goes away)
	$effect(() => {
		if (!visible || !hasWaitArea()) {
			return;
		}
		const measure = (): void => {
			box = waitArea();
		};
		window.addEventListener("scroll", measure, { passive: true });
		window.addEventListener("resize", measure);
		return () => {
			window.removeEventListener("scroll", measure);
			window.removeEventListener("resize", measure);
		};
	});
</script>

<div aria-live="polite" aria-atomic="true" data-testid="wait-overlay">
	{#if visible}
		<div
			class="fixed z-[70] flex items-center justify-center bg-surface-100/90 p-4 {box
				? ''
				: 'inset-0'}"
			style:top={box ? `${box.top}px` : undefined}
			style:left={box ? `${box.left}px` : undefined}
			style:width={box ? `${box.width}px` : undefined}
			style:height={box ? `${box.height}px` : undefined}
			transition:fade={{ duration: duration() }}
			data-testid="wait-veil"
		>
			<div data-testid="wait-card">
				<Loading size="md" announce={false} />
			</div>
		</div>
	{/if}
</div>
