// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createLimiter } from "./limit.js";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 1));

describe("limiter (step 9.28)", () => {
	it("runs at most N jobs at once, in the order they came, and frees a failed one", async () => {
		let limit = 2;
		const limiter = createLimiter(() => limit);
		const order: number[] = [];
		let peak = 0;
		const job = (n: number, fail = false): Promise<number> =>
			limiter.run(async () => {
				peak = Math.max(peak, limiter.active);
				order.push(n);
				await tick();
				if (fail) {
					throw new Error(`job ${n}`);
				}
				return n;
			});
		const results = await Promise.allSettled([job(1), job(2, true), job(3), job(4), job(5)]);
		expect(peak).toBe(2);
		expect(order).toEqual([1, 2, 3, 4, 5]);
		expect(results.map((r) => r.status)).toEqual([
			"fulfilled",
			"rejected",
			"fulfilled",
			"fulfilled",
			"fulfilled",
		]);
		expect(limiter.active).toBe(0);
		// the limit is read again at every start; never below one
		limit = 0;
		peak = 0;
		await Promise.all([job(6), job(7)]);
		expect(peak).toBe(1);
	});
});
