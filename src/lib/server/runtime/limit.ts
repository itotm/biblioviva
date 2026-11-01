// SPDX-License-Identifier: GPL-3.0-or-later
// At most N jobs of a kind at once (steps 9.28, 9.32): the image work, the yaz-client processes and
// the heavy jobs (print sheets, exports) follow the hardware profile (`imageConcurrency`,
// `yazConcurrency`, `heavyConcurrency`), the jobs beyond it wait their turn in the order they
// came. The limit is read at every start, so a configuration reload applies to the next job.
import { getConfig } from "#lib/server/config/index.js";
import { resolvePerformance } from "#lib/shared/performance.js";

export interface Limiter {
	run<T>(job: () => Promise<T>): Promise<T>;
	/**
	 * Waits for a slot and returns the function that gives it back (once; later calls do nothing),
	 * for a job that ends after the call that started it (a streamed answer).
	 */
	acquire(): Promise<() => void>;
	/** Jobs running now. */
	readonly active: number;
	/** Jobs waiting for their turn. */
	readonly waiting: number;
}

export function createLimiter(limit: () => number): Limiter {
	let active = 0;
	const waiting: (() => void)[] = [];
	const next = (): void => {
		while (waiting.length > 0 && active < Math.max(1, limit())) {
			active++;
			waiting.shift()?.();
		}
	};
	const acquire = async (): Promise<() => void> => {
		await new Promise<void>((start) => {
			waiting.push(start);
			next();
		});
		let held = true;
		return () => {
			if (held) {
				held = false;
				active--;
				next();
			}
		};
	};
	return {
		get active() {
			return active;
		},
		get waiting() {
			return waiting.length;
		},
		acquire,
		async run<T>(job: () => Promise<T>): Promise<T> {
			const release = await acquire();
			try {
				return await job();
			} finally {
				release();
			}
		},
	};
}

const performance = (): ReturnType<typeof resolvePerformance> =>
	resolvePerformance(getConfig().performance);

/** Photos, covers, class pictures, the logo: `Bun.Image` work, `imageConcurrency` at once. */
export const imageWork = createLimiter(() => performance().imageConcurrency);
/** `yaz-client` processes, `yazConcurrency` at once. */
export const yazWork = createLimiter(() => performance().yazConcurrency);
/**
 * Print sheets and exports (step 9.32), `heavyConcurrency` at once: taken once, at the outside
 * (the request in `#lib/server/runtime/heavy.ts`, the backup services), never by what such a job
 * calls, so a job never waits for a second slot of its own kind. It may take an image slot.
 */
export const heavyWork = createLimiter(() => performance().heavyConcurrency);
