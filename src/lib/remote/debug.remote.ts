// SPDX-License-Identifier: GPL-3.0-or-later
// Diagnostic reports from the browser (9.13, round 7): with `LOG_LEVEL=debug` the camera scanner
// reports every read (symbology, what it was recognised as, whether the page took it) so the log
// shows what really happened at the phone. A no-op otherwise. Any signed-in account.
import { version } from "$app/env";
import { command } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { debugEnabled, debugLog, maskCode } from "#lib/server/log/debug.js";

/**
 * Any other step the browser takes (9.13, round 12): pages opened, the camera starting or
 * refusing, the cover corners found (and by which pass), the stages of "Nuovo libro", scripts
 * failing. `details` holds codes, sizes and flags; the pages never put names in it.
 */
export const reportEvent = command(
	v.object({
		area: v.pipe(v.string(), v.regex(/^[a-z][\w-]{0,29}$/)),
		message: v.pipe(v.string(), v.maxLength(60)),
		page: v.pipe(v.string(), v.maxLength(200)),
		details: v.pipe(
			v.record(
				v.pipe(v.string(), v.maxLength(40)),
				v.union([v.pipe(v.string(), v.maxLength(300)), v.number(), v.boolean(), v.null()]),
			),
			v.check((d) => Object.keys(d).length <= 20, "too many details"),
		),
	}),
	(event) => {
		requireUser();
		if (debugEnabled()) {
			debugLog(`client:${event.area}`, event.message, { page: event.page, ...event.details });
		}
	},
);

export const reportScan = command(
	v.object({
		page: v.pipe(v.string(), v.maxLength(200)),
		format: v.pipe(v.string(), v.maxLength(40)),
		kind: v.pipe(v.string(), v.maxLength(20)),
		value: v.pipe(v.string(), v.maxLength(80)),
		accepted: v.boolean(),
		/** The client's build: an old one means the phone still runs the code of before an update. */
		build: v.optional(v.pipe(v.string(), v.maxLength(40))),
	}),
	(scan) => {
		requireUser();
		if (debugEnabled()) {
			debugLog("scan", scan.accepted ? "taken" : "skipped", {
				page: scan.page,
				format: scan.format,
				kind: scan.kind,
				value: maskCode(scan.kind, scan.value),
				...(scan.build && scan.build !== version ? { staleBuild: scan.build } : {}),
			});
		}
	},
);
