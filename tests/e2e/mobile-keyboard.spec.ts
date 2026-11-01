// SPDX-License-Identifier: GPL-3.0-or-later
// The phone keyboard never hides the field being filled (9.13 round 33): the page asks the
// browser to shrink the window above the keyboard (`interactive-widget=resizes-content`), the
// bottom bar steps aside while the keyboard is open, and a dialog taller than what is left of
// the window scrolls, so its fields and buttons can always be brought into view. A window of
// 412 × 380 stands for a phone with its keyboard open.
import { expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";

test.describe("phone keyboard", () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(!isMobile, "a phone's keyboard");
	});

	test("asks the browser to resize the page above the keyboard", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
			"content",
			/interactive-widget=resizes-content/,
		);
	});

	test("hides the bottom bar while the keyboard is open", async ({ page }) => {
		await page.goto("/patrons");
		await waitForHydration(page);
		const bar = page.getByTestId("bottom-nav");
		const search = page.getByRole("searchbox").first();
		// a field with the focus and no keyboard on screen (the desk's code field) keeps the bar
		await search.focus();
		await expect(bar).toBeVisible();
		await page.setViewportSize({ width: 412, height: 500 });
		await expect(bar).toBeHidden();
		await search.blur();
		await expect(bar).toBeVisible();
		await page.setViewportSize({ width: 412, height: 915 });
		await expect(bar).toBeVisible();
	});

	test("a dialog taller than the window above the keyboard scrolls to every field", async ({
		page,
	}) => {
		await page.goto("/admin/users");
		await waitForHydration(page);
		await page.setViewportSize({ width: 412, height: 380 });
		await page.getByTestId("account-new").click();
		const dialog = page.getByTestId("account-dialog");
		await expect(dialog).toBeVisible();
		await dialog.getByTestId("account-password-repeat").focus();
		const save = dialog.getByTestId("account-save");
		await save.evaluate((el) => el.scrollIntoView({ block: "nearest" }));
		await expect(save).toBeInViewport({ ratio: 1 });
		const close = dialog.getByRole("button", { name: "Chiudi" });
		await close.evaluate((el) => el.scrollIntoView({ block: "nearest" }));
		await expect(close).toBeInViewport({ ratio: 1 });
	});
});
