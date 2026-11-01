// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { loan, patron, staffUser } from "#lib/server/db/schema.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { isNull } from "drizzle-orm";
import { ALL_SECTIONS, DASHBOARD_SECTIONS } from "#lib/shared/dashboard-sections.js";
import { dashboardStats } from "./dashboard.js";
import { endOfWeek } from "#lib/shared/calendar-core.js";

const config = parseConfig(exampleRaw()).config;
const all = { loans: true, patrons: true, catalog: true };

describe("dashboard", () => {
	it("ends the week on the day before the configured first day", () => {
		expect(endOfWeek("2026-09-21", "monday")).toBe("2026-09-27");
		expect(endOfWeek("2026-09-25", "monday")).toBe("2026-09-27");
		expect(endOfWeek("2026-09-27", "monday")).toBe("2026-09-27");
		expect(endOfWeek("2026-09-25", "sunday")).toBe("2026-09-26");
	});

	it("counts only the areas of the account, fast on the seed data", () => {
		const db = createTestDb();
		seedDatabase(db);
		db.insert(staffUser).values({ username: "u", passwordHash: "x", roles: [] }).run();
		const today = new Date().toISOString().slice(0, 10);
		const started = performance.now();
		const stats = dashboardStats(db, all, today, config.library.timezone);
		expect(performance.now() - started).toBeLessThan(100);
		const open = db.select().from(loan).where(isNull(loan.returnedAt)).all();
		expect(stats.loans?.open).toBe(open.length);
		expect(stats.loans?.overdue).toBe(open.filter((l) => l.dueDate < today).length);
		const due = open.filter(
			(l) => l.dueDate >= today && l.dueDate <= endOfWeek(today, "monday"),
		);
		expect(stats.dueThisWeek?.total).toBe(due.length);
		expect(stats.dueThisWeek?.loans.length).toBe(Math.min(8, due.length));
		const dates = stats.dueThisWeek?.loans.map((l) => l.dueDate) ?? [];
		expect([...dates].sort()).toEqual(dates);
		const active = db
			.select()
			.from(patron)
			.all()
			.filter((p) => p.status === "active");
		expect(stats.patrons).toEqual({
			withoutCard: active.filter((p) => p.cardPrintedAt === null).length,
			withoutPhoto: active.filter((p) => p.photoPath === null).length,
		});
		expect(stats.catalog?.pendingPair).toBeGreaterThanOrEqual(0);
		expect(
			dashboardStats(
				db,
				{ loans: false, patrons: true, catalog: false },
				today,
				"Europe/Rome",
			),
		).toEqual({
			patrons: stats.patrons,
		});
	});

	it("computes nothing for the sections switched off", () => {
		const db = createTestDb();
		seedDatabase(db);
		const today = new Date().toISOString().slice(0, 10);
		const off = { ...ALL_SECTIONS, tiles: false, dueThisWeek: false, inventory: false };
		expect(dashboardStats(db, all, today, "Europe/Rome", off)).toEqual({});
	});

	it("shows every section by default and reads the switches from the configuration", () => {
		expect(config.ui.dashboard).toEqual(ALL_SECTIONS);
		// missing photos are pointed out unless the library says photos are optional (9.13)
		expect(config.photos.required).toBe(true);
		const partial = parseConfig({
			...exampleRaw(),
			ui: { ...(exampleRaw().ui as object), dashboard: { tiles: false } },
		}).config;
		expect(partial.ui.dashboard).toEqual({ ...ALL_SECTIONS, tiles: false });
		expect(DASHBOARD_SECTIONS[0]).toBe("quickActions");
	});
});
