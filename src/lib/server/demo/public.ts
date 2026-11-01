// SPDX-License-Identifier: GPL-3.0-or-later
// The public demo (PLAN.md step 9.17, Q112, Q118, ADR-028): `DEMO_PUBLIC=1` shows every feature
// to anyone on the internet, so one guard refuses what would let a visitor spoil the demo for the
// others or turn the server into a public relay — the configuration written, staff accounts,
// configuration import, backups and their restore, class pictures (except the shipped one of the
// census), SQL written by hand in a report, large import files or other files than the demo's
// examples, too many notes (what a visitor sends is replaced by an example, `content.ts`) — and the
// server ends itself at the daily reset time, so Docker starts it again on a freshly built demo.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { TZDate } from "@date-fns/tz";
import { env } from "#lib/server/env.js";
import { APP_VERSION, BUILT_AT, demoVersion } from "#lib/shared/version.js";

/** What the guard refuses in the public demo (each has its i18n message `demo.blocked.<feature>`). */
export const DEMO_FEATURES = [
	"config",
	"restore",
	"configImport",
	"pictures",
	"sqlReports",
	"importSize",
	"printSize",
	"importExample",
	"notesLimit",
	"demoData",
	"backups",
	"archives",
	"languagePacks",
] as const;
export type DemoFeature = (typeof DEMO_FEATURES)[number];

/** The biggest file a visitor may hand to an import in the public demo. */
export const DEMO_IMPORT_MAX_BYTES = 1_000_000;

export function isDemoPublic(): boolean {
	return env().DEMO_PUBLIC === "1";
}

/** The version shown in the menu and on About: the build's time in the public demo. */
export function shownVersion(timezone: string): string {
	return isDemoPublic() ? demoVersion(BUILT_AT, timezone) : APP_VERSION;
}

export class DemoBlockedError extends Error {
	constructor(readonly feature: DemoFeature) {
		super(`not available in the public demo: ${feature}`);
		this.name = "DemoBlockedError";
	}
}

/**
 * The most sheets of paper a print job of the public demo may fill: a sheet gives the turn to
 * other requests while it is rendered (`breaks`), but thousands of labels or cards would still
 * take seconds of the demo's one CPU and megabytes of its memory from every visitor.
 */
export const DEMO_PRINT_MAX_SHEETS = 3;

/** Refuses, in the public demo, a print job of more than `DEMO_PRINT_MAX_SHEETS` sheets. */
export function assertDemoPrintSheets(sheets: number): void {
	if (sheets > DEMO_PRINT_MAX_SHEETS) {
		assertNotDemo("printSize");
	}
}

/** Refuses `feature` in the public demo; does nothing elsewhere. */
export function assertNotDemo(feature: DemoFeature): void {
	if (isDemoPublic()) {
		throw new DemoBlockedError(feature);
	}
}

/**
 * The next reset after `now`: `HH:MM` on the library's clock, today or tomorrow. The day is
 * counted on the calendar of the time zone, so a change of daylight saving time does not move
 * the reset by an hour.
 */
export function nextResetAt(now: Date, resetAt: string, timezone: string): Date {
	const [hh = 0, mm = 0] = resetAt.split(":").map(Number);
	const local = new TZDate(now, timezone);
	const at = (dayOffset: number): Date =>
		new TZDate(
			local.getFullYear(),
			local.getMonth(),
			local.getDate() + dayOffset,
			hh,
			mm,
			0,
			timezone,
		);
	const today = at(0);
	// a plain Date: a TZDate prints its ISO string with the offset of its zone
	return new Date((today.getTime() > now.getTime() ? today : at(1)).getTime());
}

/**
 * The class pictures shipped with the demo data, one of a scan and one of a photo (the census of
 * Phase 13 can be tried with them, 9.26, Q126); shipped next to `config/` and `drizzle/`
 * (cwd-relative; the container copies `demo/`).
 */
export const DEMO_CLASS_PICTURES = {
	scan: "demo/census/class-cards.jpg",
	photo: "demo/census/class-cards-photo.jpg",
} as const;

let demoPictureHashes: Set<string> | undefined;

/** True for the bytes of a shipped demo picture: the only pictures a visitor may send. */
export function isDemoClassPicture(bytes: Uint8Array): boolean {
	if (demoPictureHashes === undefined) {
		demoPictureHashes = new Set();
		for (const path of Object.values(DEMO_CLASS_PICTURES)) {
			try {
				demoPictureHashes.add(
					createHash("sha256").update(readFileSync(path)).digest("hex"),
				);
			} catch {
				// a picture missing from this build: not accepted
			}
		}
	}
	return demoPictureHashes.has(createHash("sha256").update(bytes).digest("hex"));
}

/**
 * Ends the server at the next reset time of the public demo (`exit`, by default a clean
 * `process.exit(0)`): Docker's `restart: unless-stopped` starts it again and the start builds the
 * demo afresh. Returns the cancel function.
 */
export function scheduleDemoReset(
	timezone: string,
	resetAt: string,
	exit: () => void,
	now: () => Date = () => new Date(),
): { at: Date; cancel: () => void } {
	const at = nextResetAt(now(), resetAt, timezone);
	const timer = setTimeout(exit, Math.max(1000, at.getTime() - now().getTime()));
	return { at, cancel: () => clearTimeout(timer) };
}
