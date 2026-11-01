// SPDX-License-Identifier: GPL-3.0-or-later
// Behind the Tailscale sidecar (step 8.4): the scheme and the client address come from the
// proxy's X-Forwarded-* headers (the test server is configured like the container), HTTPS
// responses carry HSTS, cross-site form posts are refused, and a login records the device's
// address in the audit log.
import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/login.page.js";

test.describe("behind the proxy", () => {
	test("HTTPS answers carry HSTS, plain HTTP does not", async ({ request }) => {
		const https = await request.get("/login", { headers: { "x-forwarded-proto": "https" } });
		expect(https.headers()["strict-transport-security"]).toBe("max-age=31536000");
		const http = await request.get("/login");
		expect(http.headers()["strict-transport-security"]).toBeUndefined();
		expect(http.headers()["x-content-type-options"]).toBe("nosniff");
	});

	test("a cross-site form post is refused (CSRF)", async ({ request }) => {
		const forged = await request.post("/login", {
			headers: { origin: "https://evil.example" },
			form: { username: "admin", password: "x" },
		});
		expect(forged.status()).toBe(403);
	});

	test("the login records the address the proxy reports", async ({ page, isMobile }) => {
		test.skip(isMobile, "one login is enough");
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("admin", "admin-test-pw");
		await expect(page).toHaveURL(/\/$/);
		const csv = await page.request.get("/export/audit?format=csv&action=auth.login");
		expect(csv.status()).toBe(200);
		expect(await csv.text()).toContain("100.101.102.103");
	});
});
