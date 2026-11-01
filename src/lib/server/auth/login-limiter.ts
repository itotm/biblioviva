// SPDX-License-Identifier: GPL-3.0-or-later
// Process-wide limiter instances built from the configuration (per IP and per username).
import { getConfig, onConfigReload } from "#lib/server/config/index.js";
import { RateLimiter } from "./rate-limit.js";

let limiter: RateLimiter | undefined;

export function loginLimiter(): RateLimiter {
	if (!limiter) {
		const s = getConfig().security;
		limiter = new RateLimiter(s.loginMaxAttempts, s.loginWindowMinutes * 60_000);
		onConfigReload(() => {
			limiter = undefined;
		});
	}
	return limiter;
}
