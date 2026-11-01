// SPDX-License-Identifier: GPL-3.0-or-later
// Batch operations on copies (step 3.10): the copies of the records selected in the catalogue,
// changed in one go; the lists of Stampe only print (owner).
// (Copies on loan are excluded from a withdrawal: covered by the unit tests.)
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");
/** Each project works on its own titles of the seeded catalogue. */
const wordOf = (page: Page): string => (tagOf(page) === "Mob" ? "little" : "king");

test.describe.serial("batch operations on copies", () => {
	test("changes the copies of the records selected in the catalogue", async ({ page }) => {
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(wordOf(page));
		const rows = page.getByTestId("data-grid").locator(".wx-row");
		await rows.nth(2).click({ modifiers: ["Control"] });
		await rows.nth(3).click({ modifiers: ["Control"] });
		await page.getByTestId("batch-selected").click();
		await page.getByTestId("batch-operation").selectOption("status");
		// the reason is required for a withdrawal
		await page.getByTestId("batch-status").selectOption("withdrawn");
		await page.getByTestId("batch-check").click();
		await expect(page.getByTestId("batch-problem")).toContainText("Il motivo è obbligatorio");
		await expectAxeClean(page);
		await page.getByTestId("batch-status").selectOption("in_repair");
		await page.getByTestId("batch-check").click();
		await expect(page.getByTestId("batch-plan")).toContainText(/\d+ copie cambiano/);
		await page.getByTestId("batch-apply").click();
		await expect(page.getByRole("status").getByText(/copie modificate/)).toBeVisible();
	});
});
