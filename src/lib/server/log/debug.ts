// SPDX-License-Identifier: GPL-3.0-or-later
// Diagnostic log (9.13, round 7): with `LOG_LEVEL=debug` the app writes what it does step by step
// on standard output (`[debug] <area> …`), readable with `docker compose logs app`: the codes the
// camera reads and what they are taken for, every metadata lookup with its query, provider, hits,
// time and error. Personal data never goes in: no names, no photos, card numbers masked.
import { env } from "#lib/server/env.js";

export function debugEnabled(): boolean {
	return env().LOG_LEVEL === "debug";
}

/** A card number is personal data: only its length is logged. */
export function maskCode(kind: string, value: string): string {
	return kind === "card" ? `<card ${String(value.length)} digits>` : value;
}

export function debugLog(area: string, message: string, details?: Record<string, unknown>): void {
	if (!debugEnabled()) {
		return;
	}
	const extra = details ? ` ${JSON.stringify(details)}` : "";
	console.warn(`[debug] ${area} ${message}${extra}`);
}

/**
 * What a result says, without what it carries: numbers, flags, short codes (`reason`, `error`,
 * `kind`) and the length of each list; texts and nested objects (names, titles) stay out.
 */
export function summarize(value: unknown): Record<string, unknown> | string {
	if (value === null || value === undefined || typeof value !== "object") {
		return typeof value === "string" && /^[\w.-]{1,40}$/.test(value) ? value : typeof value;
	}
	if (Array.isArray(value)) {
		return { length: value.length };
	}
	const out: Record<string, unknown> = {};
	for (const [key, v] of Object.entries(value)) {
		if (typeof v === "number" || typeof v === "boolean") {
			out[key] = v;
		} else if (typeof v === "string" && /^[\w.-]{1,40}$/.test(v)) {
			out[key] = v;
		} else if (Array.isArray(v)) {
			out[key] = `[${String(v.length)}]`;
		}
	}
	return out;
}

/** Runs a remote function body and logs the summary of its result (or its failure). */
export function traced<T>(area: string, name: string, run: () => T): T {
	if (!debugEnabled()) {
		return run();
	}
	const started = performance.now();
	const done = (result: unknown): void =>
		debugLog(area, name, {
			ms: Math.round(performance.now() - started),
			result: summarize(result),
		});
	const failed = (e: unknown): never => {
		debugLog(area, name, {
			ms: Math.round(performance.now() - started),
			failed: e instanceof Error ? e.message : String(e),
		});
		throw e;
	};
	try {
		const result = run();
		if (result instanceof Promise) {
			return result.then((r: unknown) => {
				done(r);
				return r;
			}, failed) as T;
		}
		done(result);
		return result;
	} catch (e) {
		return failed(e);
	}
}
