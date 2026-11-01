// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { mirrorConfigUsers } from "#lib/server/auth/config-users.js";
import { verifyPassword } from "#lib/server/auth/password.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { setConfigKeys } from "./config-edit.js";
import { revertConfigChange } from "../../../../tests/helpers/config.js";
import {
	helperPasswordHash,
	removeAccount,
	rolesView,
	saveAccount,
	saveRoles,
	StaffConfigError,
	type AccountDraft,
} from "./staff-config.js";

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-staff-config-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
	setConfigKeys(dir, "test", {
		"security.users": [
			{ username: "admin", roles: ["admin"], password: "admin-pw-2026" },
			{ username: "prestiti", roles: ["circulation"], password: "prestiti-pw-2026" },
		],
		// quick hashes for the tests
		"performance.argon2MemoryMb": 8,
	});
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

async function database(): Promise<{ db: Db; actor: { id: number } }> {
	const db = createTestDb();
	await mirrorConfigUsers(db, getConfig());
	const actor = db
		.select({ id: staffUser.id })
		.from(staffUser)
		.where(eq(staffUser.username, "admin"))
		.get();
	if (!actor) {
		throw new Error("no admin");
	}
	return { db, actor };
}

const draft = (over: Partial<AccountDraft> = {}): AccountDraft => ({
	originalUsername: null,
	username: "biblioteca",
	displayName: "Biblioteca",
	roles: ["circulation", "cataloging"],
	active: true,
	password: "una-password-lunga",
	...over,
});
const file = (): { security: { users: Record<string, unknown>[] } } =>
	JSON.parse(readFileSync(join(dir, "config.json"), "utf8")) as {
		security: { users: Record<string, unknown>[] };
	};

describe("staff accounts", () => {
	it("hashes a password for the helper, auditing the use without the hash", async () => {
		const { db, actor } = await database();
		const hash = await helperPasswordHash(db, getConfig(), "una-password-lunga", actor);
		expect(await verifyPassword("una-password-lunga", hash)).toBe(true);
		const rows = db
			.select()
			.from(auditLog)
			.where(eq(auditLog.action, "auth.hash_generated"))
			.all();
		expect(rows).toHaveLength(1);
		expect(JSON.stringify(rows[0])).not.toContain(hash);
	});

	it("creates an account with a hashed password, mirrored at once", async () => {
		const { db, actor } = await database();
		await saveAccount(db, dir, draft(), actor);
		const written = file().security.users.find((u) => u.username === "biblioteca");
		expect(written).toMatchObject({ roles: ["circulation", "cataloging"], active: true });
		expect(written?.password).toBeUndefined();
		expect(await verifyPassword("una-password-lunga", String(written?.passwordHash))).toBe(
			true,
		);
		// the memory of the hash: the explicit key here (8 MB), else the profile's (step 9.28)
		expect(written?.passwordHash).toContain("m=8192,");
		setConfigKeys(dir, "test", {
			"performance.profile": "micro",
			"performance.argon2MemoryMb": undefined,
		});
		await saveAccount(db, dir, { ...draft(), username: "piccolo" }, actor);
		const micro = file().security.users.find((u) => u.username === "piccolo");
		expect(micro?.passwordHash).toContain("m=16384,");
		const row = db.select().from(staffUser).where(eq(staffUser.username, "biblioteca")).get();
		expect(row?.active).toBe(1);
		expect(
			db
				.select()
				.from(auditLog)
				.where(eq(auditLog.action, "config.security.account_created"))
				.get()?.details,
		).toMatchObject({ username: "biblioteca", passwordChanged: true });
		expect(JSON.stringify(db.select().from(auditLog).all())).not.toContain("una-password");
	});

	it("renames an account keeping its row, sets a new password, deactivates and removes it", async () => {
		const { db, actor } = await database();
		const id = db
			.select({ id: staffUser.id })
			.from(staffUser)
			.where(eq(staffUser.username, "prestiti"))
			.get()?.id;
		await saveAccount(
			db,
			dir,
			draft({
				originalUsername: "prestiti",
				username: "banco",
				roles: ["circulation"],
				password: undefined,
			}),
			actor,
		);
		const row = db.select().from(staffUser).where(eq(staffUser.username, "banco")).get();
		expect(row?.id).toBe(id);
		// the clear password is kept until a new one is set
		expect(file().security.users.find((u) => u.username === "banco")?.password).toBe(
			"prestiti-pw-2026",
		);
		await saveAccount(
			db,
			dir,
			draft({
				originalUsername: "banco",
				username: "banco",
				roles: ["circulation"],
				password: "nuova-password",
			}),
			actor,
		);
		const hash = String(
			file().security.users.find((u) => u.username === "banco")?.passwordHash,
		);
		expect(await verifyPassword("nuova-password", hash)).toBe(true);

		await expect(removeAccount(db, dir, "banco", actor)).rejects.toThrow(StaffConfigError);
		await saveAccount(
			db,
			dir,
			draft({
				originalUsername: "banco",
				username: "banco",
				roles: ["circulation"],
				active: false,
				password: undefined,
			}),
			actor,
		);
		expect(
			db.select().from(staffUser).where(eq(staffUser.username, "banco")).get()?.active,
		).toBe(0);
		const removed = await removeAccount(db, dir, "banco", actor);
		expect(getConfig().security.users.map((u) => u.username)).toEqual(["admin"]);
		// back from the history
		revertConfigChange(dir, removed.id);
		expect(getConfig().security.users.map((u) => u.username)).toEqual(["admin", "banco"]);
	});

	it("refuses bad names, taken names, unknown roles, short passwords and losing the last admin", async () => {
		const { db, actor } = await database();
		const refused = async (d: AccountDraft, code: string): Promise<void> => {
			await expect(saveAccount(db, dir, d, actor)).rejects.toMatchObject({ code });
		};
		await refused(draft({ username: "Con Spazi" }), "badUsername");
		await refused(draft({ username: "prestiti" }), "usernameTaken");
		await refused(draft({ roles: [] }), "noRoles");
		await refused(draft({ roles: ["nope"] }), "unknownRole");
		await refused(draft({ password: "corta" }), "passwordTooShort");
		await refused(draft({ password: undefined }), "passwordRequired");
		await refused(
			draft({
				originalUsername: "admin",
				username: "admin",
				roles: ["circulation"],
				password: undefined,
			}),
			"lastAdmin",
		);
		await refused(
			draft({
				originalUsername: "admin",
				username: "admin",
				roles: ["admin"],
				active: false,
				password: undefined,
			}),
			"lastAdmin",
		);
	});
});

describe("roles", () => {
	it("adds, renames (accounts following) and removes roles; refuses one in use or the last admin", async () => {
		const { db, actor } = await database();
		const drafts = rolesView(getConfig()).map((r) => ({
			originalName: r.name,
			name: r.name,
			grants: r.grants,
		}));
		expect(rolesView(getConfig()).find((r) => r.name === "circulation")?.usedBy).toEqual([
			"prestiti",
		]);
		await saveRoles(
			db,
			dir,
			[
				...drafts
					.map((d) =>
						d.name === "circulation"
							? { ...d, name: "banco", grants: ["loans", "reports"] as const }
							: d,
					)
					.map((d) => ({ ...d, grants: [...d.grants] })),
				{ originalName: null, name: "lettura", grants: ["reports"] },
			],
			actor,
		);
		const config = getConfig();
		expect(config.security.roles.banco).toEqual(["loans", "reports"]);
		expect(config.security.users.find((u) => u.username === "prestiti")?.roles).toEqual([
			"banco",
		]);
		expect(
			db.select().from(staffUser).where(eq(staffUser.username, "prestiti")).get()?.roles,
		).toEqual(["banco"]);

		const now = rolesView(getConfig()).map((r) => ({
			originalName: r.name,
			name: r.name,
			grants: [...r.grants],
		}));
		await expect(
			saveRoles(
				db,
				dir,
				now.filter((r) => r.name !== "banco"),
				actor,
			),
		).rejects.toMatchObject({ code: "roleInUse" });
		await expect(
			saveRoles(
				db,
				dir,
				now.map((r) => (r.name === "admin" ? { ...r, grants: ["reports" as const] } : r)),
				actor,
			),
		).rejects.toMatchObject({ code: "lastAdmin" });
		await expect(
			saveRoles(db, dir, [...now, { originalName: null, name: "banco", grants: [] }], actor),
		).rejects.toMatchObject({ code: "roleTaken" });
		await saveRoles(
			db,
			dir,
			now.filter((r) => r.name !== "lettura"),
			actor,
		);
		expect(Object.keys(getConfig().security.roles)).not.toContain("lettura");
	});
});
