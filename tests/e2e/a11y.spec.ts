// SPDX-License-Identifier: GPL-3.0-or-later
// Accessibility pass (PLAN.md step 9.3, automated part): axe on every main page at both window
// sizes; the desk used with the keyboard alone, as with a USB scanner (the scan field has the
// focus, Enter confirms); a visible focus indicator; a link that skips the menu; no motion when the system asks for less.
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

/** The pages checked at 320 CSS pixels (WCAG 1.4.10): only grids may scroll on their own. */
const REFLOW = [
	"/",
	"/circulation/checkout",
	"/circulation/checkin",
	"/patrons",
	"/patrons/new",
	"/catalog",
	"/catalog/new",
	"/print",
	"/reports",
	"/admin",
	"/admin/config/library",
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

	test("the first Tab reaches a link that skips to the page", async ({ page }) => {
		await open(page, "/admin");
		await page.keyboard.press("Tab");
		const skip = page.getByTestId("skip-link");
		await expect(skip).toBeFocused();
		await expect(skip).toBeVisible();
		await page.keyboard.press("Enter");
		await expect(page.locator("main#main")).toBeFocused();
	});

	test("the page's title is its first heading, the bar's copy hidden from screen readers", async ({
		page,
	}) => {
		await open(page, "/admin");
		await expect(page.locator("main#main h1").first()).toHaveText("Amministrazione");
		await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
		await expect(
			page.getByTestId("page-title").locator("xpath=ancestor::*[@aria-hidden='true']"),
		).toHaveCount(1);
	});

	test("required fields carry an asterisk explained above the form", async ({ page }) => {
		await open(page, "/patrons/new");
		await expect(page.getByTestId("required-note")).toBeVisible();
		await expect(page.getByTestId("required-note")).toHaveText(
			"I campi con * sono obbligatori.",
		);
		const mark = await page
			.getByLabel("Cognome", { exact: true })
			.evaluate(
				(input) =>
					getComputedStyle(
						input.closest("label")?.querySelector(".label-text") ?? input,
						"::after",
					).content,
			);
		expect(mark).toContain("*");
		// a form with its errors passes axe too
		await page.getByTestId("patron-submit").click();
		await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
		await expectAxeClean(page);
	});

	test("an open dialog passes axe", async ({ page }) => {
		await open(page, "/dev/ui");
		await page.getByRole("button", { name: "Apri dialogo" }).click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await expectAxeClean(page);
	});

	test("the camera is a dialog on a phone and passes axe", async ({ page }) => {
		await open(page, "/cataloging/new");
		await page.getByRole("button", { name: "Fotocamera", exact: true }).click();
		const stage = page.getByTestId("barcode-camera");
		await expect(stage).toBeVisible();
		if (page.viewportSize()?.width === 412) {
			await expect(stage).toHaveAttribute("role", "dialog");
			await expect(stage).toHaveAttribute("aria-modal", "true");
			await expect(page.getByTestId("bottom-nav")).toHaveJSProperty("inert", true);
			await expectAxeClean(page);
			await page.keyboard.press("Escape");
			await expect(stage).toHaveCount(0);
			await expect(page.getByTestId("bottom-nav")).toHaveJSProperty("inert", false);
		} else {
			await expect(stage).not.toHaveAttribute("role", "dialog");
			await expectAxeClean(page);
		}
	});

	test("nothing is cut at 320 CSS pixels, the width of a 400 % zoom", async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width: 320, height: 640 });
		for (const path of REFLOW) {
			await open(page, path);
			const cut = await page.evaluate(() => {
				const scrolls = (el: Element): boolean => {
					for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
						if (
							["auto", "scroll", "hidden", "clip"].includes(
								getComputedStyle(p).overflowX,
							)
						) {
							return true;
						}
					}
					return false;
				};
				return [...document.querySelectorAll("body *")]
					.filter((el) => {
						const r = el.getBoundingClientRect();
						if (r.width === 0 || r.height === 0 || el.closest(".sr-only")) {
							return false;
						}
						return (r.right > window.innerWidth + 1 || r.left < -1) && !scrolls(el);
					})
					.map(
						(el) =>
							`${el.tagName.toLowerCase()}[${el.getAttribute("data-testid") ?? el.className}]`,
					);
			});
			expect(cut, path).toEqual([]);
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
