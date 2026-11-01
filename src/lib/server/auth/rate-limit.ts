// SPDX-License-Identifier: GPL-3.0-or-later
// In-memory login rate limiter: N failed attempts per key (IP, username) within a window (§3.5).
export class RateLimiter {
	private readonly failures = new Map<string, number[]>();

	constructor(
		private readonly maxAttempts: number,
		private readonly windowMs: number,
		private readonly now: () => number = () => Date.now(),
	) {}

	/** True when the key still has attempts left in the current window. */
	allowed(key: string): boolean {
		return this.recent(key).length < this.maxAttempts;
	}

	/** Records a failed attempt. */
	fail(key: string): void {
		const list = this.recent(key);
		list.push(this.now());
		this.failures.set(key, list);
	}

	/** Clears the key after a successful attempt. */
	reset(key: string): void {
		this.failures.delete(key);
	}

	/** Seconds until the key is allowed again (0 when allowed now). */
	retryAfterSeconds(key: string): number {
		const list = this.recent(key);
		const oldest = list[0];
		if (list.length < this.maxAttempts || oldest === undefined) {
			return 0;
		}
		return Math.max(1, Math.ceil((oldest + this.windowMs - this.now()) / 1000));
	}

	private recent(key: string): number[] {
		const cutoff = this.now() - this.windowMs;
		const list = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
		if (list.length === 0) {
			this.failures.delete(key);
		}
		return list;
	}
}
