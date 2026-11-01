// SPDX-License-Identifier: GPL-3.0-or-later
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../../tests/helpers/db.js";
import { staffUser } from "#lib/server/db/schema.js";
import { audit } from "#lib/server/services/audit.js";
import { toCsv } from "../csv.js";
import { getExport } from "../registry.js";
import { auditExportSchema, registerAuditExport } from "./audit.js";

describe("audit export", () => {
	it("re-runs the audit query with the grid filters and localized headers", async () => {
		const db = createTestDb();
		const user = db
			.insert(staffUser)
			.values({ username: "admin", passwordHash: "x", roles: ["admin"] })
			.returning({ id: staffUser.id })
			.get();
		audit(
			db,
			user,
			"auth.login",
			"staff_user",
			user.id,
			undefined,
			new Date("2026-09-19T08:00:00Z"),
		);
		audit(
			db,
			user,
			"patron.create",
			"patron",
			7,
			{ changed: ["a"] },
			new Date("2026-09-20T08:00:00Z"),
		);

		registerAuditExport(() => ({ when: "Quando", user: "Account", action: "Operazione" }));
		const definition = getExport("audit")!;
		expect(definition.permission).toBe("admin");
		const params = v.parse(auditExportSchema, {
			from: "2026-09-20",
			to: "",
			userId: String(user.id),
			action: "",
		});
		const table = await definition.build(db, params, { id: user.id } as never, "Europe/Rome");
		const csv = toCsv(table);
		expect(csv).toContain("Quando;Account;Operazione;entity;id;details");
		expect(csv).toContain(
			'2026-09-20 10:00;admin;patron.create;patron;7;"{""changed"":[""a""]}"',
		);
		expect(csv).not.toContain("auth.login");

		expect(v.safeParse(auditExportSchema, { from: "20-09-2026" }).success).toBe(false);
		expect(v.safeParse(auditExportSchema, { userId: "abc" }).success).toBe(false);
	});
});
