// SPDX-License-Identifier: GPL-3.0-or-later
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { heldWaits, holdWait } from "./waits.svelte.js";

describe("waits", () => {
	it("counts the waits held and releases each one once", () => {
		const first = holdWait();
		const second = holdWait();
		expect(heldWaits()).toBe(2);
		first();
		first();
		expect(heldWaits()).toBe(1);
		second();
		expect(heldWaits()).toBe(0);
	});

	it("is held by an effect without making the effect run again", () => {
		const form = $state({ pending: 0 });
		let runs = 0;
		const stop = $effect.root(() => {
			$effect(() => {
				runs++;
				if (form.pending > 0) {
					return holdWait();
				}
			});
		});
		try {
			flushSync();
			form.pending = 1;
			flushSync();
			expect(heldWaits()).toBe(1);
			form.pending = 0;
			flushSync();
			expect(heldWaits()).toBe(0);
			expect(runs).toBe(3);
		} finally {
			stop();
		}
	});
});
