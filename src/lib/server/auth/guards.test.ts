// SPDX-License-Identifier: GPL-3.0-or-later
// The request-scoped guards: remote functions (`requireUser`), loads (`requirePermission`) and
// the first-run wizard (`requireSetupMode`).
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "./types.js";

const locals: { user: AuthUser | null; setupMode: boolean } = { user: null, setupMode: false };
vi.mock("$app/server", () => ({ getRequestEvent: () => ({ locals }) }));

const { requireAnyUser, requireUser } = await import("./guard.js");
const { requireAnyPermission, requirePermission } = await import("./load-guard.js");
const { requireSetupMode } = await import("./setup-guard.js");
const { loginLimiter } = await import("./login-limiter.js");

const admin: AuthUser = {
	id: 1,
	username: "admin",
	displayName: "A",
	roles: ["admin"],
	permissions: ["admin", "loans"],
};

function status(fn: () => unknown): number | undefined {
	try {
		fn();
		return undefined;
	} catch (e) {
		return (e as { status?: number }).status;
	}
}

describe("request guards", () => {
	it("requireUser: 401 without a session, 403 without the permission, the user otherwise", () => {
		locals.user = null;
		expect(status(() => requireUser())).toBe(401);
		locals.user = admin;
		expect(requireUser("loans")).toBe(admin);
		expect(status(() => requireUser("catalog"))).toBe(403);
	});

	it("requireAnyUser: one of several permissions is enough", () => {
		locals.user = null;
		expect(status(() => requireAnyUser(["loans", "catalog"]))).toBe(401);
		locals.user = admin;
		expect(requireAnyUser(["catalog", "loans"])).toBe(admin);
		expect(status(() => requireAnyUser(["catalog", "reports"]))).toBe(403);
	});

	it("requirePermission: same rules for loads and endpoints", () => {
		expect(status(() => requirePermission({ user: null } as App.Locals, "admin"))).toBe(401);
		expect(status(() => requirePermission({ user: admin } as App.Locals, "reports"))).toBe(403);
		expect(requirePermission({ user: admin } as App.Locals, "admin")).toBe(admin);
		expect(
			status(() =>
				requireAnyPermission({ user: admin } as App.Locals, ["catalog", "reports"]),
			),
		).toBe(403);
		expect(requireAnyPermission({ user: admin } as App.Locals, ["catalog", "loans"])).toBe(
			admin,
		);
	});

	it("a password to change opens nothing but the change itself (9.51)", () => {
		locals.user = { ...admin, mustChangePassword: true };
		expect(requireUser()).toMatchObject({ username: "admin" });
		expect(status(() => requireUser("admin"))).toBe(403);
		expect(status(() => requireAnyUser(["loans", "admin"]))).toBe(403);
		locals.user = admin;
	});

	it("requireSetupMode: 404 once the setup is completed", () => {
		locals.setupMode = true;
		expect(status(() => requireSetupMode())).toBeUndefined();
		locals.setupMode = false;
		expect(status(() => requireSetupMode())).toBe(404);
	});

	it("loginLimiter: one shared limiter built from the configuration", () => {
		const a = loginLimiter();
		expect(loginLimiter()).toBe(a);
		expect(a.allowed("ip:test")).toBe(true);
	});
});
