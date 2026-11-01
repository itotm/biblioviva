// SPDX-License-Identifier: GPL-3.0-or-later
// The calendar editor (PLAN.md step 11.5): weekly closing days, holidays and closed ranges edited
// as one draft. The holidays and ranges may come from several files — the `calendar` section
// (config.json or `calendar.json`) and the `calendar.<name>.json` fragments of the folder (§3.6) —
// so the save keeps each date and range in the file that holds it, removes from every file what the
// draft dropped, and writes what is new into the calendar section. One configuration change.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readJsonFile } from "#lib/server/config/load.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import type { AuditActor } from "./audit.js";
import { sectionFile, type ConfigChange, type FileWrite } from "./config-edit.js";
import { saveConfigWrites } from "./config-sections.js";

type Json = Record<string, unknown>;

export interface ClosedRange {
	from: string;
	to: string;
	reason: string;
}

export interface CalendarDraft {
	/** 0 = Sunday … 6 = Saturday. */
	weeklyClosedDays: number[];
	holidays: string[];
	closedRanges: ClosedRange[];
}

const FRAGMENT = /^calendar\.[\w-]+\.json$/;
const rangeKey = (r: { from: string; to: string; reason?: string }): string =>
	`${r.from}|${r.to}|${r.reason ?? ""}`;

function fragments(configDir: string): string[] {
	return existsSync(configDir)
		? readdirSync(configDir)
				.filter((f) => FRAGMENT.test(f))
				.sort()
		: [];
}

/** The calendar object of the section file (config.json's `calendar`, or `calendar.json`). */
function mainCalendar(configDir: string): { file: string; doc: Json; calendar: Json } {
	const file = sectionFile(configDir, "calendar");
	const doc = readJsonFile(join(configDir, file));
	const calendar = file === "config.json" ? ((doc.calendar ??= {}) as Json) : doc;
	return { file, doc, calendar };
}

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Where each holiday and range of the folder is written (for the page: "da calendar.2026.json"). */
export function calendarSources(configDir: string): {
	holidays: Record<string, string>;
	ranges: Record<string, string>;
} {
	const holidays: Record<string, string> = {};
	const ranges: Record<string, string> = {};
	const main = mainCalendar(configDir);
	const note = (file: string, calendar: Json): void => {
		for (const d of list<string>(calendar.holidays)) {
			holidays[d] ??= file;
		}
		for (const r of list<ClosedRange>(calendar.closedRanges)) {
			ranges[rangeKey(r)] ??= file;
		}
	};
	note(main.file, main.calendar);
	for (const f of fragments(configDir)) {
		note(f, readJsonFile(join(configDir, f)));
	}
	return { holidays, ranges };
}

/** The writes that store the draft, each date and range staying in the file that holds it. */
export function calendarWrites(configDir: string, draft: CalendarDraft): FileWrite[] {
	const holidays = [...new Set(draft.holidays)].sort();
	const ranges = draft.closedRanges.map((r) => ({
		from: r.from,
		to: r.to,
		reason: r.reason.trim(),
	}));
	const wanted = new Set(ranges.map(rangeKey));
	const kept = { holidays: new Set<string>(), ranges: new Set<string>() };
	const writes: FileWrite[] = [];
	const json = (value: unknown): string => `${JSON.stringify(value, null, "\t")}\n`;
	for (const f of fragments(configDir)) {
		const doc = readJsonFile(join(configDir, f));
		const before = JSON.stringify(doc);
		const hs = list<string>(doc.holidays).filter((d) => holidays.includes(d));
		const rs = list<ClosedRange>(doc.closedRanges).filter((r) => wanted.has(rangeKey(r)));
		hs.forEach((d) => kept.holidays.add(d));
		rs.forEach((r) => kept.ranges.add(rangeKey(r)));
		if ("holidays" in doc || hs.length > 0) {
			doc.holidays = hs;
		}
		if ("closedRanges" in doc || rs.length > 0) {
			doc.closedRanges = rs;
		}
		if (JSON.stringify(doc) !== before) {
			writes.push({ path: f, content: json(doc) });
		}
	}
	const main = mainCalendar(configDir);
	main.calendar.weeklyClosedDays = [...new Set(draft.weeklyClosedDays)].sort((a, b) => a - b);
	main.calendar.holidays = holidays.filter((d) => !kept.holidays.has(d));
	main.calendar.closedRanges = ranges.filter((r) => !kept.ranges.has(rangeKey(r)));
	writes.unshift({ path: main.file, content: json(main.doc) });
	return writes;
}

export function saveCalendar(
	db: DbOrTx,
	configDir: string,
	draft: CalendarDraft,
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	return saveConfigWrites(
		db,
		configDir,
		"calendar",
		calendarWrites(configDir, draft),
		actor,
		{
			weeklyClosedDays: draft.weeklyClosedDays,
			holidays: draft.holidays.length,
			closedRanges: draft.closedRanges.length,
		},
		now,
	);
}
