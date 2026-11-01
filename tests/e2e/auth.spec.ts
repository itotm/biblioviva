// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

test.describe("authentication", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("protected pages redirect to the login page and back after logging in", async ({
		page,
	}) => {
		await page.goto("/circulation/checkout?lang=en");
		await expect(page).toHaveURL(/\/login\?redirectTo=/);
		await waitForHydration(page);
		const login = new LoginPage(page);
		// one language for every device of a school: the switch is the public demo's only (Q120)
		await expect(page.getByTestId("language-switch")).toHaveCount(0);
		await expectAxeClean(page);
		await login.loginAs("prestiti", "prestiti-test-pw");
		await expect(page).toHaveURL(/\/circulation\/checkout\?lang=en$/);
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	});

	test("wrong credentials show a clear message and the session cookie is hardened", async ({
		page,
		context,
	}) => {
		const login = new LoginPage(page);
		await login.goto();
		// the eye shows the typed password and hides it again (9.13, round 15)
		await login.password.fill("visibile");
		await expect(login.password).toHaveAttribute("type", "password");
		await page.getByTestId("password-toggle").click();
		await expect(login.password).toHaveAttribute("type", "text");
		await page.getByTestId("password-toggle").click();
		await expect(login.password).toHaveAttribute("type", "password");
		await login.loginAs("admin", "not-the-password");
		await expect(login.error).toContainText(/non corretti|Wrong/);
		await login.loginAs("admin", "admin-test-pw");
		await expect(page).toHaveURL(/\/$/);
		const cookie = (await context.cookies()).find((c) => c.name === "bv_session");
		expect(cookie).toBeDefined();
		expect(cookie?.httpOnly).toBe(true);
		// plain http here, as in the basic local-network mode (step 8.8): a `Secure` cookie would be
		// dropped by the browser; behind Tailscale the scheme is https and the cookie is `Secure`
		expect(cookie?.secure).toBe(false);
		expect(cookie?.sameSite).toBe("Lax");
	});

	test("a page beyond the account permissions renders the 403 page", async ({ page }) => {
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("prestiti", "prestiti-test-pw");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		await page.goto("/admin");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			/non è disponibile per l'account in uso/,
		);
		await expectAxeClean(page);
	});

	test("the health endpoint is public and reports the database", async ({ request }) => {
		const res = await request.get("/healthz");
		expect(res.status()).toBe(200);
		expect(await res.json()).toMatchObject({ status: "ok", db: "ok" });
	});
});
