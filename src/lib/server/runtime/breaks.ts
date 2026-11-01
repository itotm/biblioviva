// SPDX-License-Identifier: GPL-3.0-or-later
// Runtime facade (PLAN.md §3.21): breaks in a long job. The server runs every request on one
// JavaScript thread, so a sheet of thousands of labels rendered in one go keeps every other
// request waiting; a job that awaits `pause()` in its loop gives the turn to them now and then.
import { setImmediate } from "node:timers/promises";

/** How long a job works before it gives the turn: a waiting page is answered within this. */
export const BREAK_AFTER_MS = 20;

/**
 * The breaks of one job: `await pause()` in its loop resolves on the next turn of the event loop
 * once `afterMs` have passed since the last break (the requests waiting are served first), at
 * once otherwise. Time rather than a count, so the breaks fit any host, a Raspberry Pi or a PC.
 */
export function breaks(afterMs = BREAK_AFTER_MS): () => Promise<void> {
	let since = performance.now();
	return async () => {
		if (performance.now() - since >= afterMs) {
			await setImmediate();
			since = performance.now();
		}
	};
}
