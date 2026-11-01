// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { mirrorConfigUsers } from "#lib/server/auth/config-users.js";
import { hashPassword } from "#lib/server/auth/password.js";
import { parseConfig } from "#lib/server/config/load.js";
import { exampleRaw } from "#lib/server/config/load.js";
import { activeAdmins } from "#lib/server/auth/rbac.js";
import { listAccounts } from "./accounts.js";

describe("accounts service", () => {
	it("lists mirrored accounts with permissions and the plain-password warning", async () => {
		const db = createTestDb();
		const raw = exampleRaw() as Record<string, any>;
		raw.security.users = [
			{
				username: "admin",
				roles: ["admin"],
				passwordHash: await hashPassword("admin-pw-123"),
			},
			{
				username: "prestiti",
				displayName: "Gestione prestiti",
				roles: ["circulation"],
				password: "plain-pw-123",
			},
			{ username: "old", roles: ["cataloging"], password: "x", active: false },
		];
		const config = parseConfig(raw, "test").config;
		await mirrorConfigUsers(db, config);

		const accounts = listAccounts(db, config);
		expect(accounts.map((a) => a.username)).toEqual(["admin", "old", "prestiti"]);
		const admin = accounts[0]!;
		expect(admin.permissions).toContain("admin");
		expect(admin.plainPassword).toBe(false);
		expect(admin.active).toBe(true);
		const prestiti = accounts[2]!;
		expect(prestiti.displayName).toBe("Gestione prestiti");
		expect(prestiti.permissions).toEqual(["loans"]);
		expect(prestiti.plainPassword).toBe(true);
		expect(prestiti.inConfig).toBe(true);
		expect(accounts[1]!.active).toBe(false);
		expect(activeAdmins(config.security.users, config.security.roles)).toEqual(["admin"]);

		// an account removed from the file stays listed as inactive and "not in config"
		raw.security.users = raw.security.users.slice(0, 1);
		const next = parseConfig(raw, "test").config;
		await mirrorConfigUsers(db, next);
		const after = listAccounts(db, next);
		expect(after.find((a) => a.username === "prestiti")).toMatchObject({
			active: false,
			inConfig: false,
		});
	});
});
