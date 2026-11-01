// SPDX-License-Identifier: GPL-3.0-or-later
// Media routes need a session (staff-only product): anonymous requests are redirected to the login.
import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/login.page.js";

test.describe("media routes require a session", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("barcode preview, patron photos, class pictures and covers answer 401 without a session", async ({
		request,
	}) => {
		expect((await request.get("/media/barcode/0000001240.svg")).status()).toBe(401);
		expect((await request.get("/media/patrons/1/main")).status()).toBe(401);
		expect((await request.get("/media/covers/1/main")).status()).toBe(401);
		expect((await request.get("/media/branding/logo")).status()).toBe(401);
		// the class pictures of the census and their frames (Phase 13)
		expect((await request.get("/media/class-sheets/1")).status()).toBe(401);
		expect((await request.get("/media/class-sheets/frames/1")).status()).toBe(401);
	});
});

test.describe("patron photos need the desk or the patrons", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("the cataloguing and report accounts get no photo of a pupil", async ({ page }) => {
		const login = new LoginPage(page);
		for (const [user, status] of [
			["catalogo", 403],
			["report", 403],
			["prestiti", 200],
			["tessere", 200],
		] as const) {
			await page.context().clearCookies();
			await login.goto();
			await login.loginAs(user, `${user}-test-pw`);
			await expect(page).not.toHaveURL(/\/login/);
			expect((await page.request.get("/media/patrons/1/main")).status(), user).toBe(status);
		}
	});
});
