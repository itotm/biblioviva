// SPDX-License-Identifier: GPL-3.0-or-later
// Waits that are not a page change (the login's check of the password, for example): while one is
// held, the wait overlay (`WaitOverlay.svelte`) shows as it does while the next page loads. Inside
// the app shell it covers only the page's part of the window (`setWaitArea`).
import { untrack } from "svelte";

const held = $state({ count: 0 });

/** How many waits are held now. */
export function heldWaits(): number {
	return held.count;
}

/** Holds a wait until the returned function is called (calling it again does nothing). */
export function holdWait(): () => void {
	// untracked: an effect that holds a wait must not depend on the count it changes (it would
	// run again at once, release, hold, and so on without end)
	untrack(() => (held.count += 1));
	let released = false;
	return () => {
		if (!released) {
			released = true;
			untrack(() => (held.count -= 1));
		}
	};
}

/** A part of the window, in CSS pixels from its top-left corner. */
export interface WaitBox {
	top: number;
	left: number;
	width: number;
	height: number;
}

// the part of the window the app shell gives to the page (its menu and bars stay usable): set
// while the shell is on screen, measured afresh each time the overlay shows or the window scrolls
let area = $state<{ measure: () => WaitBox } | null>(null);

/** The part of the window the wait overlay covers (`null`: the whole window). */
export function waitArea(): WaitBox | null {
	return area?.measure() ?? null;
}

/** Whether a page area is set (the overlay follows the scroll only then). */
export function hasWaitArea(): boolean {
	return area !== null;
}

/** Sets the part of the window a wait covers until the returned function is called. */
export function setWaitArea(measure: () => WaitBox): () => void {
	const own = { measure };
	untrack(() => (area = own));
	return () => {
		untrack(() => {
			if (area === own) {
				area = null;
			}
		});
	};
}
