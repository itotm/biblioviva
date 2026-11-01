// SPDX-License-Identifier: GPL-3.0-or-later
// Accessibility pass (PLAN.md step 9.3, automated part): axe on every main page at both window
// sizes; the desk used with the keyboard alone, as with a USB scanner (the scan field has the
// focus, Enter confirms); a visible focus indicator; no motion when the system asks for less.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createBook, createPatron } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";
import { deskField } from "./helpers/desk.js";

const PAGES = [
	"/",
	"/circulation/checkout",
	"/circulation/checkin",
	"/circulation/loans",
	"/patrons",
	"/patrons/new",
	"/patrons/1",
	"/catalog",
	"/catalog/new",
	"/catalog/1",
	"/print",
	"/reports",
	"/reports/acquisitions-by-year",
	"/admin",
	"/admin/users",
	"/admin/backups",
	"/admin/audit",
	"/calendar",
	"/admin/appearance",
	"/admin/config",
	"/admin/config/library",
	"/admin/config/circulation",
	"/admin/config/labels",
	"/admin/config/classification",
	"/admin/config/templates",
	"/admin/config/templates/labels/pair-default",
	"/admin/config/reports",
	"/admin/config/history",
	"/about",
];

async function open(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await waitForHydration(page);
}

test.describe("accessibility", () => {
	test("every main page passes axe", async ({ page }) => {
		test.setTimeout(180_000);
		for (const path of PAGES) {
			await open(page, path);
			await expectAxeClean(page);
		}
	});

	test("the desk works with the keyboard alone", async ({ page }) => {
		const t = page.viewportSize()?.width === 412 ? "Mob" : "Desk";
		const patron = await createPatron(page, `Tastiera${t}`);
		const book = await createBook(page, `Libro da tastiera ${t}`, 1);
		const [barcode] = book.barcodes as [string];

		await open(page, "/circulation/checkout");
		await expect(deskField(page)).toBeFocused();
		await page.keyboard.type(patron.card);
		await page.keyboard.press("Enter");
		await expect(page.getByTestId("desk-patron-name")).toHaveText(`Tastiera${t}`);
		// the field of the books has taken the place of the patron's, with the focus
		await expect(deskField(page)).toBeFocused();
		await page.keyboard.type(barcode);
		await page.keyboard.press("Enter");
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute("data-code", "lent");

		await open(page, "/circulation/checkin");
		await expect(page.getByRole("textbox").first()).toBeFocused();
		await page.keyboard.type(barcode);
		await page.keyboard.press("Enter");
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute(
			"data-code",
			"returned",
		);
	});

	test("the focus is always visible", async ({ page }) => {
		await open(page, "/admin");
		for (let i = 0; i < 6; i++) {
			await page.keyboard.press("Tab");
			const visible = await page.evaluate(() => {
				const el = document.activeElement;
				if (!el || el === document.body) {
					return true;
				}
				const s = getComputedStyle(el);
				return (
					(s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
					s.boxShadow !== "none"
				);
			});
			expect(visible, `focus ${i + 1}`).toBe(true);
		}
	});

	test("no motion when the system asks for less", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await open(page, "/admin");
		const duration = await page
			.getByTestId("admin-section-config")
			.evaluate((el) => getComputedStyle(el).transitionDuration);
		expect(duration.split(",").every((d) => parseFloat(d) < 0.001)).toBe(true);
	});
});
