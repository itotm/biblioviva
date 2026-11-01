// SPDX-License-Identifier: GPL-3.0-or-later
// The basic local-network mode (step 8.8): plain http on LAN_PORT, without the Tailscale sidecar.
// The browser sends no forwarded headers of its own — here it even claims https, which the front
// replaces — and the login still works, with a session cookie that is not `Secure`.
import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/login.page.js";

test.use({
	baseURL: "http://127.0.0.1:3001",
	extraHTTPHeaders: { "x-forwarded-proto": "https", "x-forwarded-for": "6.6.6.6" },
	storageState: { cookies: [], origins: [] },
});

test("logs in over plain http on the local network", async ({ page, context }) => {
	const response = await page.goto("/login");
	expect(response?.headers()["strict-transport-security"]).toBeUndefined();
	const login = new LoginPage(page);
	// the login is a posted form: it passes the CSRF check only if the app sees the http origin
	await login.loginAs("prestiti", "prestiti-test-pw");
	// the desk account starts at the loans desk
	await expect(page).toHaveURL(/127\.0\.0\.1:3001\/circulation\/checkout$/);
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	const cookie = (await context.cookies()).find((c) => c.name === "bv_session");
	expect(cookie?.secure).toBe(false);
	expect(cookie?.httpOnly).toBe(true);
});
