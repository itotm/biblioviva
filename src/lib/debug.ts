// SPDX-License-Identifier: GPL-3.0-or-later
// The browser's side of the diagnostic log (9.13, round 12): with `LOG_LEVEL=debug` on the server
// (`page.data.debug`), the pages report what happens only in the browser — navigation, camera,
// cover detection, the stages of a flow, script errors — through `reportEvent`, so the log can be
// followed step by step. Never names, photos or card numbers: codes, sizes, flags and ids only.
import { page } from "$app/state";
import { reportEvent } from "#lib/remote/debug.remote.js";

export type DebugDetails = Record<string, string | number | boolean | null | undefined>;

export function debugOn(): boolean {
	try {
		return page.data.debug === true;
	} catch {
		return false;
	}
}

export function debugReport(area: string, message: string, details: DebugDetails = {}): void {
	if (!debugOn()) {
		return;
	}
	const clean: Record<string, string | number | boolean | null> = {};
	for (const [key, value] of Object.entries(details)) {
		if (value !== undefined) {
			clean[key] = typeof value === "string" ? value.slice(0, 300) : value;
		}
	}
	void reportEvent({ area, message, page: page.url.pathname, details: clean }).catch(
		() => undefined, // a lost diagnostic report is harmless
	);
}

/** A card number is personal: only its length goes in the log. */
export function maskCard(kind: string, value: string): string {
	return kind === "card" ? `<card ${String(value.length)} digits>` : value;
}
