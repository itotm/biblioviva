// SPDX-License-Identifier: GPL-3.0-or-later
// The per-address limits of the public demo (step 9.17, Q118): a visitor may write only a few
// staff notes a day, and every address has a ceiling on the requests that write and on the heavy
// ones (exports, print sheets), on top of the login limiter and Cloudflare's own protection.
import { RateLimiter } from "#lib/server/auth/rate-limit.js";
import { env } from "#lib/server/env.js";
import { isHeavyRequest } from "#lib/server/runtime/heavy.js";
import { DemoBlockedError } from "./public.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
/** Requests that change something (remote commands and forms), per address and minute. */
export const DEMO_WRITES_PER_MINUTE = 60;
/** Exports, archives and print sheets, per address and minute. */
export const DEMO_HEAVY_PER_MINUTE = 20;

let notes: RateLimiter | undefined;
let writes = new RateLimiter(DEMO_WRITES_PER_MINUTE, MINUTE_MS);
let heavy = new RateLimiter(DEMO_HEAVY_PER_MINUTE, MINUTE_MS);

/** Counts a new note of `address`; refuses it past `DEMO_NOTES_PER_DAY`. */
export function takeDemoNote(address: string): void {
	notes ??= new RateLimiter(env().DEMO_NOTES_PER_DAY, DAY_MS);
	if (!notes.allowed(address)) {
		throw new DemoBlockedError("notesLimit");
	}
	notes.fail(address);
}

/** A request of the public demo: false when its address is over the limit of its kind. */
export function demoRequestAllowed(
	address: string,
	request: { method: string; pathname: string },
): boolean {
	const limiter =
		request.method !== "GET" && request.method !== "HEAD"
			? writes
			: isHeavyRequest(request.pathname)
				? heavy
				: null;
	if (!limiter) {
		return true;
	}
	if (!limiter.allowed(address)) {
		return false;
	}
	limiter.fail(address);
	return true;
}

/** Test helper: start the limits afresh. */
export function resetDemoLimits(): void {
	notes = undefined;
	writes = new RateLimiter(DEMO_WRITES_PER_MINUTE, MINUTE_MS);
	heavy = new RateLimiter(DEMO_HEAVY_PER_MINUTE, MINUTE_MS);
}
