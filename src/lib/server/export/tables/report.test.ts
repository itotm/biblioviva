// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openExportDb, type ExportDb } from "../../../../../tests/helpers/export-db.js";
import type { AuthUser } from "#lib/server/auth/types.js";
import { item } from "#lib/server/db/schema.js";
import { toCsv } from "../csv.js";
import { getExport } from "../registry.js";
import type { TableExport } from "../types.js";
import { registerReportExport, reportExportSchema } from "./report.js";

const user = (permissions: AuthUser["permissions"]): AuthUser => ({
	id: 1,
	username: "u",
	displayName: "U",
	roles: [],
	permissions,
});

let fx: ExportDb;
beforeAll(() => {
	fx = openExportDb();
	registerReportExport();
});
afterAll(() => fx.close());

const build = async (
	params: Record<string, string>,
	who = user(["reports"]),
): Promise<TableExport> =>
	getExport("report")!.build(fx.db, v.parse(reportExportSchema, params), who, "Europe/Rome");

describe("report export", () => {
	it("re-runs a report with localized headers and decorated values", async () => {
		expect(getExport("report")!.permission).toBe("reports");
		const table = await build({ id: "acquisitions-by-year" });
		expect(table.name).toBe("acquisitions-by-year");
		expect(table.columns).toEqual([
			{ id: "year", label: "Anno", type: "string" },
			{ id: "copies", label: "Copie", type: "number" },
		]);
		const total = fx.db.select({ id: item.id }).from(item).all().length;
		expect([...table.rows].reduce((n, r) => n + Number(r.copies), 0)).toBe(total);
		expect(toCsv(table)).toContain("Anno;Copie");
		// the item status code is shown with its Italian name
		const [first] = fx.db.select({ id: item.id }).from(item).limit(1).all();
		fx.db
			.update(item)
			.set({ status: "lost" })
			.where(eq(item.id, first?.id ?? 0))
			.run();
		const lost = await build({ id: "lost-damaged-items" });
		expect([...lost.rows].map((r) => r.status)).toEqual(["Smarrito"]);
	});

	it("passes the parameters and rejects invalid ones", async () => {
		const table = await build({ id: "loans-by-month", from: "2026-01-01", to: "2026-12-31" });
		expect(table.columns.length).toBeGreaterThan(0);
		await expect(build({ id: "loans-by-month", from: "ieri" })).rejects.toMatchObject({
			status: 400,
		});
	});

	it("hides unknown and restricted reports", async () => {
		await expect(build({ id: "no-such-report" })).rejects.toMatchObject({ status: 404 });
		await expect(build({ id: "imports-history" })).rejects.toMatchObject({ status: 404 });
		const restricted = await build({ id: "imports-history" }, user(["reports", "admin"]));
		expect(restricted.name).toBe("imports-history");
	});

	it("accepts only a report id with plain characters", () => {
		expect(() => v.parse(reportExportSchema, {})).toThrow();
		expect(() => v.parse(reportExportSchema, { id: "../config" })).toThrow();
		expect(() => v.parse(reportExportSchema, { id: "x".repeat(65) })).toThrow();
		expect(v.parse(reportExportSchema, { id: "top-titles", limit: "10" })).toEqual({
			id: "top-titles",
			limit: "10",
		});
	});
});
