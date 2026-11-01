// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { HomePage } from "./pages/home.page.js";

test("home page renders and is axe clean", async ({ page }) => {
	const home = new HomePage(page);
	await home.goto();
	await expect(home.heading).toBeVisible();
	await expectAxeClean(page);
});
