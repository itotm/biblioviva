// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import { staffUser } from "#lib/server/db/schema.js";
import {
	findUserByUsername,
	hasActiveAccounts,
	mirrorConfigUsers,
	touchLastLogin,
} from "./config-users.js";
import { hashPassword, looksLikeHash, verifyPassword } from "./password.js";
import { RateLimiter } from "./rate-limit.js";
import type { AuthUser } from "./types.js";
import {
	activeAdmins,
	AuthError,
	authorize,
	authorizeAny,
	can,
	canAny,
	canSeePatrons,
	permissionsOf,
} from "./rbac.js";
import {
	createSession,
	deleteSession,
	deleteUserSessions,
	hashToken,
	purgeExpiredSessions,
	resolveSession,
	sessionCookieOptions,
} from "./session.js";

const ROLES = {
	admin: ["*"],
	circulation: ["loans"],
	cataloging: ["catalog", "catalog.import"],
} as const;

function exampleConfig(): AppConfig {
	return parseConfig(exampleRaw()).config;
}

describe("passwords", () => {
	it("hashes with argon2id and verifies; malformed hashes never verify", async () => {
		const hash = await hashPassword("cambiami", 16);
		expect(looksLikeHash(hash)).toBe(true);
		expect(await verifyPassword("cambiami", hash)).toBe(true);
		expect(await verifyPassword("wrong", hash)).toBe(false);
		expect(await verifyPassword("cambiami", "$argon2id$v=19$m=65536,t=2,p=1$REPLACE_ME")).toBe(
			false,
		);
		expect(looksLikeHash("cambiami")).toBe(false);
	});
});

describe("permissions", () => {
	it("expands roles, ignores unknown roles and treats * as everything", () => {
		expect(permissionsOf(["circulation"], ROLES)).toEqual(["loans"]);
		expect(permissionsOf(["circulation", "cataloging", "ghost"], ROLES)).toEqual([
			"loans",
			"catalog",
			"catalog.import",
		]);
		expect(permissionsOf(["admin"], ROLES)).toHaveLength(8);
	});

	it("authorize throws 401 without a user and 403 without the permission", () => {
		const user = {
			id: 1,
			username: "p",
			displayName: "p",
			roles: ["circulation"],
			permissions: permissionsOf(["circulation"], ROLES),
		};
		expect(can(user, "loans")).toBe(true);
		expect(can(user, "admin")).toBe(false);
		expect(can(null, "loans")).toBe(false);
		expect(authorize(user, "loans")).toBe(user);
		expect(authorize(user)).toBe(user);
		expect(() => authorize(null)).toThrow(AuthError);
		try {
			authorize(user, "admin");
		} catch (e) {
			expect((e as AuthError).status).toBe(403);
		}
		try {
			authorize(null, "admin");
		} catch (e) {
			expect((e as AuthError).status).toBe(401);
		}
	});
});

describe("rules over several permissions", () => {
	const user = (roles: string[]): AuthUser => ({
		id: 1,
		username: "u",
		displayName: "u",
		roles,
		permissions: permissionsOf(roles, ROLES),
	});

	it("any of several permissions: canAny and authorizeAny (403 naming them)", () => {
		const desk = user(["circulation"]);
		expect(canAny(desk, ["loans", "catalog"])).toBe(true);
		expect(canAny(desk, ["catalog", "reports"])).toBe(false);
		expect(canAny(null, ["loans"])).toBe(false);
		expect(authorizeAny(desk, ["catalog", "loans"])).toBe(desk);
		expect(() => authorizeAny(null, ["loans"])).toThrow(AuthError);
		try {
			authorizeAny(desk, ["catalog", "reports"]);
		} catch (e) {
			expect(e).toMatchObject({ status: 403, message: "forbidden: catalog or reports" });
		}
	});

	it("only the desk and the patron accounts see who has a copy or asked for a book", () => {
		expect(canSeePatrons(user(["circulation"]))).toBe(true);
		expect(canSeePatrons(user(["admin"]))).toBe(true);
		expect(canSeePatrons(user(["cataloging"]))).toBe(false);
		expect(canSeePatrons(null)).toBe(false);
	});

	it("names the active accounts that hold admin", () => {
		expect(
			activeAdmins(
				[
					{ username: "a", roles: ["admin"], active: true },
					{ username: "b", roles: ["admin"], active: false },
					{ username: "c", roles: ["circulation"], active: true },
				],
				ROLES,
			),
		).toEqual(["a"]);
	});
});

describe("rate limiter", () => {
	it("blocks after N failures within the window and recovers", () => {
		let now = 1_000_000;
		const limiter = new RateLimiter(3, 60_000, () => now);
		expect(limiter.allowed("ip:1")).toBe(true);
		limiter.fail("ip:1");
		limiter.fail("ip:1");
		expect(limiter.allowed("ip:1")).toBe(true);
		limiter.fail("ip:1");
		expect(limiter.allowed("ip:1")).toBe(false);
		expect(limiter.retryAfterSeconds("ip:1")).toBe(60);
		now += 30_000;
		expect(limiter.retryAfterSeconds("ip:1")).toBe(30);
		now += 31_000;
		expect(limiter.allowed("ip:1")).toBe(true);
		expect(limiter.retryAfterSeconds("ip:1")).toBe(0);
		limiter.fail("ip:1");
		limiter.reset("ip:1");
		expect(limiter.allowed("ip:1")).toBe(true);
	});
});

describe("sessions", () => {
	it("creates, resolves with sliding expiry, and deletes sessions", () => {
		const db = createTestDb();
		const [u] = db
			.insert(staffUser)
			.values({ username: "prestiti", passwordHash: "x", roles: ["circulation"] })
			.returning({ id: staffUser.id })
			.all();
		const t0 = new Date("2026-09-19T08:00:00Z");
		const token = createSession(db, u!.id, {
			days: 14,
			ip: "100.64.0.1",
			userAgent: "test",
			now: t0,
		});
		expect(token).not.toBe(hashToken(token));
		const resolved = resolveSession(db, token, ROLES, 14, t0);
		expect(resolved?.user).toMatchObject({ username: "prestiti", permissions: ["loans"] });
		expect(resolveSession(db, "nope", ROLES, 14, t0)).toBeNull();
		expect(resolveSession(db, undefined, ROLES, 14, t0)).toBeNull();

		// two days later the expiry slides forward; 15 days after the last use it is gone
		const t2 = new Date("2026-09-21T08:00:00Z");
		expect(resolveSession(db, token, ROLES, 14, t2)).not.toBeNull();
		const t16 = new Date("2026-10-04T09:00:00Z"); // 13 days after t2: still valid thanks to the slide
		expect(resolveSession(db, token, ROLES, 14, t16)).not.toBeNull();
		const t40 = new Date("2026-11-01T00:00:00Z");
		expect(resolveSession(db, token, ROLES, 14, t40)).toBeNull();
		expect(purgeExpiredSessions(db, t40)).toBe(1);

		const again = createSession(db, u!.id, { days: 14, now: t0 });
		deleteSession(db, again);
		expect(resolveSession(db, again, ROLES, 14, t0)).toBeNull();
		const third = createSession(db, u!.id, { days: 14, now: t0 });
		deleteUserSessions(db, u!.id);
		expect(resolveSession(db, third, ROLES, 14, t0)).toBeNull();
	});

	it("ignores sessions of deactivated accounts", () => {
		const db = createTestDb();
		const [u] = db
			.insert(staffUser)
			.values({ username: "x", passwordHash: "x", roles: ["admin"], active: 0 })
			.returning({ id: staffUser.id })
			.all();
		const token = createSession(db, u!.id, { days: 1 });
		expect(resolveSession(db, token, ROLES, 1)).toBeNull();
	});
});

describe("session cookie", () => {
	it("is Secure over https only (plain http in the basic local-network mode)", () => {
		expect(
			sessionCookieOptions(new URL("https://biblioviva.example.ts.net/login"), 14),
		).toEqual({
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			secure: true,
			maxAge: 14 * 86_400,
		});
		const lan = sessionCookieOptions(new URL("http://192.168.1.20:8080/login"), 1);
		expect(lan.secure).toBe(false);
		expect(lan.maxAge).toBe(86_400);
	});
});

describe("config accounts mirroring", () => {
	it("creates, updates, deactivates and reports plain passwords", async () => {
		const db = createTestDb();
		const config = exampleConfig();
		expect(hasActiveAccounts(db)).toBe(false);
		const first = await mirrorConfigUsers(db, config);
		expect(first.created).toEqual(["admin", "prestiti", "catalogo", "tessere", "report"]);
		expect(first.plainPasswords).toEqual(["prestiti", "catalogo", "tessere", "report"]);
		expect(hasActiveAccounts(db)).toBe(true);
		const prestiti = findUserByUsername(db, "prestiti");
		expect(prestiti?.source).toBe("config");
		expect(await verifyPassword("cambiami", prestiti!.passwordHash)).toBe(true);

		// unchanged file → nothing to do, hashes are reused (no rehash)
		const second = await mirrorConfigUsers(db, config);
		expect(second.updated).toEqual([]);
		expect(findUserByUsername(db, "prestiti")?.passwordHash).toBe(prestiti!.passwordHash);

		// change a password and a role, remove an account
		const changed = structuredClone(config);
		changed.security.users[1]!.password = "nuova-password";
		changed.security.users[2]!.roles = ["admin"];
		changed.security.users = changed.security.users.filter((u) => u.username !== "tessere");
		const third = await mirrorConfigUsers(db, changed);
		expect(third.updated).toEqual(["prestiti", "catalogo"]);
		expect(third.deactivated).toEqual(["tessere"]);
		expect(
			await verifyPassword(
				"nuova-password",
				findUserByUsername(db, "prestiti")!.passwordHash,
			),
		).toBe(true);
		expect(findUserByUsername(db, "tessere")?.active).toBe(0);
		touchLastLogin(db, prestiti!.id, new Date("2026-09-19T10:00:00Z"));
		expect(findUserByUsername(db, "prestiti")?.lastLoginAt).toBe("2026-09-19T10:00:00.000Z");
	});
});
