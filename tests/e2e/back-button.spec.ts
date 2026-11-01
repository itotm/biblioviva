// SPDX-License-Identifier: GPL-3.0-or-later
// The back button and the fixed shell (step 9.13, round 1): the back button returns to the page
// the operator came from and names it in its tooltip; a page opened directly goes to its parent
// instead. On a desktop the sidebar and the top bar stay in place while the content scrolls.
import { expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";

test.describe("back button", () => {
	test("returns where the operator came from, else to the parent page", async ({ page }) => {
		// opened directly: the parent
		// (pages with area tabs have no back button: the tabs lead to the other pages, 9.13 round 19)
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		const back = page.getByTestId("page-back");
		await expect(back).toHaveAttribute("data-back", "parent");
		await expect(back).toHaveAccessibleName("Torna a Catalogo");
		// an arrow alone: the name is in its tooltip (9.13, round 24)
		await expect(back).toHaveText("");
		await expect(back).toHaveAttribute("title", "Torna a Catalogo");
		await back.click();
		await expect(page).toHaveURL(/\/catalog$/);
		await page.goto("/inventory");
		await waitForHydration(page);
		await expect(back).toHaveCount(0);

		// from the dashboard's quick actions: back to the dashboard
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("quick-newBook").click();
		await expect(page).toHaveURL(/\/cataloging\/new$/);
		await expect(back).toHaveAttribute("data-back", "history");
		await expect(back).toHaveAccessibleName("Torna a Dashboard");
		await back.click();
		await expect(page).toHaveURL(/\/$/);

		// two steps: record → edit → back to the record → back to the catalogue search
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill("the");
		await page.getByTestId("data-grid").locator(".wx-row").first().click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(back).toHaveAccessibleName("Torna a Catalogo");
		await back.click();
		await expect(page).toHaveURL(/\/catalog/);
	});

	test("the sidebar and the top bar stay in place while the content scrolls", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "phones have the bottom bar and no sidebar");
		await page.goto("/admin/config/classification");
		await waitForHydration(page);
		const bar = page.getByTestId("app-bar");
		const sidebar = page.getByTestId("sidebar");
		const before = { bar: await bar.boundingBox(), side: await sidebar.boundingBox() };
		await page.mouse.wheel(0, 1500);
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
		expect((await bar.boundingBox())?.y).toBe(before.bar?.y);
		expect((await sidebar.boundingBox())?.y).toBe(before.side?.y);
	});
});
