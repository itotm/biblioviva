// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { auditLog, staffUser } from "#lib/server/db/schema.js";
import {
	audit,
	auditFilterOptions,
	installAuditRetention,
	listAudit,
	purgeAudit,
	sanitizeDetails,
} from "./audit.js";

function dbWithUser(): { db: Db; user: { id: number } } {
	const db = createTestDb();
	const user = db
		.insert(staffUser)
		.values({ username: "admin", displayName: "Admin", passwordHash: "x", roles: ["admin"] })
		.returning({ id: staffUser.id })
		.get();
	return { db, user };
}

describe("audit service", () => {
	it("writes a row with the account, action, entity and sanitised details", () => {
		const { db, user } = dbWithUser();
		const id = audit(db, user, "patron.update", "patron", 42, {
			changed: ["classYear"],
			firstName: "Anna",
			lastName: "Rossi",
			photo: "/uploads/p/42.jpg",
			nested: { cardNumber: "0000001240", ok: true },
		});
		const row = db.select().from(auditLog).where(eq(auditLog.id, id)).get()!;
		expect(row.userId).toBe(user.id);
		expect(row.action).toBe("patron.update");
		expect(row.entityId).toBe("42");
		const json = JSON.stringify(row.details);
		expect(row.details).toEqual({ changed: ["classYear"], nested: { ok: true } });
		for (const pii of ["Anna", "Rossi", "0000001240", "42.jpg"]) {
			expect(json).not.toContain(pii);
		}
	});

	it("accepts system actions without an actor and truncates long strings", () => {
		const { db } = dbWithUser();
		const id = audit(db, null, "config.reload", "config", null, { path: "x".repeat(500) });
		const row = db.select().from(auditLog).where(eq(auditLog.id, id)).get()!;
		expect(row.userId).toBeNull();
		expect((row.details as { path: string }).path).toHaveLength(201);
		expect(sanitizeDetails(undefined)).toBeNull();
		expect(sanitizeDetails({ list: ["a", { name: "x", keep: 1 }], n: 3 })).toEqual({
			list: ["a", { keep: 1 }],
			n: 3,
		});
	});

	it("lists with filters, newest first, and exposes filter options", () => {
		const { db, user } = dbWithUser();
		const t = (d: string): Date => new Date(d);
		audit(db, user, "auth.login", "staff_user", user.id, undefined, t("2026-09-01T08:00:00Z"));
		audit(db, user, "patron.create", "patron", 1, undefined, t("2026-09-02T08:00:00Z"));
		audit(db, null, "config.reload", "config", null, undefined, t("2026-09-03T08:00:00Z"));

		const all = listAudit(db);
		expect(all.total).toBe(3);
		expect(all.rows.map((r) => r.action)).toEqual([
			"config.reload",
			"patron.create",
			"auth.login",
		]);
		expect(all.rows[2]?.username).toBe("admin");
		expect(all.rows[0]?.username).toBeNull();

		expect(listAudit(db, { action: "patron.create" }).rows).toHaveLength(1);
		expect(listAudit(db, { userId: user.id }).total).toBe(2);
		expect(listAudit(db, { entity: "config" }).total).toBe(1);
		expect(
			listAudit(db, {
				fromIso: "2026-09-02T00:00:00Z",
				toIso: "2026-09-02T23:59:59Z",
			}).rows.map((r) => r.action),
		).toEqual(["patron.create"]);
		expect(listAudit(db, { limit: 1, offset: 1 }).rows[0]?.action).toBe("patron.create");

		const options = auditFilterOptions(db);
		expect(options.actions).toEqual(["auth.login", "config.reload", "patron.create"]);
		expect(options.users).toEqual([{ id: user.id, username: "admin" }]);
	});

	it("purges rows older than the retention and runs daily", () => {
		const { db, user } = dbWithUser();
		const now = new Date("2026-09-19T10:00:00Z");
		audit(db, user, "a", "x", null, undefined, new Date("2024-01-01T00:00:00Z"));
		audit(db, user, "b", "x", null, undefined, new Date("2026-09-01T00:00:00Z"));
		expect(purgeAudit(db, 24, now)).toBe(1);
		expect(listAudit(db).rows.map((r) => r.action)).toEqual(["b"]);

		vi.useFakeTimers();
		try {
			const log = vi.fn();
			audit(db, user, "c", "x", null, undefined, new Date("2020-01-01T00:00:00Z"));
			const stop = installAuditRetention(
				() => db,
				() => 24,
				log,
			);
			expect(log).toHaveBeenCalledWith(expect.stringContaining("1 rows"));
			audit(db, user, "d", "x", null, undefined, new Date("2020-01-01T00:00:00Z"));
			vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
			expect(log).toHaveBeenCalledTimes(2);
			stop();
			// failures are logged, not thrown
			installAuditRetention(
				() => {
					throw new Error("boom");
				},
				() => 24,
				log,
			)();
			expect(log).toHaveBeenCalledWith(expect.stringContaining("boom"));
		} finally {
			vi.useRealTimers();
		}
	});
});

import { eq } from "drizzle-orm";
import type { Db } from "#lib/server/db/client.js";
