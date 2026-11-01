// SPDX-License-Identifier: GPL-3.0-or-later
// Appearance page (step 2.3b): pick a colour set, save it, see it applied on the next full load.
// The colour set is shared configuration: only the desktop project changes it (the specs of the
// two projects run at the same time).
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

test.describe.serial("admin appearance", () => {
	test("changes the colour set for the whole installation", async ({ page, isMobile }) => {
		test.skip(isMobile, "the colour set is shared configuration: one project changes it");
		await page.goto("/admin/appearance");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aspetto e lingua");
		await expect(page.getByTestId("theme-ocean")).toHaveAttribute("aria-checked", "true");
		await expectAxeClean(page);

		await page.getByTestId("theme-sunset").click();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "sunset");
		await page.getByTestId("save-theme").click();
		await expect(page.getByRole("status").getByText("Colori salvati")).toBeVisible();
		await expect(page.getByTestId("current-theme")).toContainText("Tramonto");

		await page.goto("/patrons");
		await expect(page.locator("html")).toHaveAttribute("data-theme", "sunset");
		await page.goto("/admin/audit");
		await waitForHydration(page);
		await page.getByTestId("audit-action").selectOption("config.theme");
		await expect(page.getByTestId("data-grid").getByText("config.theme").first()).toBeVisible();

		// back to the default so the other specs see the fixture value
		await page.goto("/admin/appearance");
		await waitForHydration(page);
		await page.getByTestId("theme-ocean").click();
		await page.getByTestId("save-theme").click();
		await expect(page.getByRole("status").getByText("Colori salvati")).toBeVisible();
	});

	test("is not reachable without the admin permission", async ({ page }) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("prestiti", "prestiti-test-pw");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		await page.goto("/admin/appearance");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			/non è disponibile per l'account in uso/,
		);
	});
});
