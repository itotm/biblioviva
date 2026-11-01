// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import { staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { calendarSources, calendarWrites, saveCalendar } from "./calendar-edit.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-calendar-edit-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
	setUiTheme(dir, "ocean");
	writeFileSync(
		join(dir, "calendar.2026.json"),
		JSON.stringify({
			_comment: "year 2026/27",
			holidays: ["2026-11-03", "2026-12-24"],
			closedRanges: [{ from: "2026-12-23", to: "2027-01-06", reason: "Natale" }],
		}),
	);
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

const read = (f: string): Record<string, unknown> =>
	JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, unknown>;

describe("calendar editor", () => {
	it("knows where each date and range is written", () => {
		const sources = calendarSources(dir);
		expect(sources.holidays["2026-11-03"]).toBe("calendar.2026.json");
		expect(sources.ranges["2026-12-23|2027-01-06|Natale"]).toBe("calendar.2026.json");
	});

	it("keeps dates in their file, drops what the draft removed, adds new ones to the section", () => {
		const db = createTestDb();
		const actor = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const writes = calendarWrites(dir, {
			weeklyClosedDays: [6, 0],
			holidays: ["2026-11-03", "2027-03-01"],
			closedRanges: [
				{ from: "2026-12-23", to: "2027-01-06", reason: "Natale" },
				{ from: "2027-04-01", to: "2027-04-07", reason: " Pasqua " },
			],
		});
		expect(writes.map((w) => w.path)).toEqual(["config.json", "calendar.2026.json"]);
		saveCalendar(
			db,
			dir,
			{
				weeklyClosedDays: [6, 0],
				holidays: ["2026-11-03", "2027-03-01"],
				closedRanges: [
					{ from: "2026-12-23", to: "2027-01-06", reason: "Natale" },
					{ from: "2027-04-01", to: "2027-04-07", reason: " Pasqua " },
				],
			},
			actor,
		);
		expect(read("calendar.2026.json")).toEqual({
			_comment: "year 2026/27",
			holidays: ["2026-11-03"],
			closedRanges: [{ from: "2026-12-23", to: "2027-01-06", reason: "Natale" }],
		});
		expect(read("config.json").calendar).toMatchObject({
			weeklyClosedDays: [0, 6],
			holidays: ["2027-03-01"],
			closedRanges: [{ from: "2027-04-01", to: "2027-04-07", reason: "Pasqua" }],
		});
		const calendar = getConfig().calendar;
		expect(calendar.holidays).toEqual(["2026-11-03", "2027-03-01"]);
		// the example's 2026-11-02 in config.json was dropped by the draft
		expect(calendar.closedRanges).toHaveLength(2);
		// nothing changed: only the section file is written again
		expect(
			calendarWrites(dir, {
				weeklyClosedDays: [0, 6],
				holidays: calendar.holidays,
				closedRanges: calendar.closedRanges.map((r) => ({ ...r, reason: r.reason })),
			}).map((w) => w.path),
		).toEqual(["config.json"]);
	});
});
