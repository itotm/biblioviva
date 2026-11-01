// SPDX-License-Identifier: GPL-3.0-or-later
// Stocktaking (step 9.8), run once after the other specs (project `final`) because closing a
// campaign marks every copy never seen as lost: a campaign started, copies scanned at the desk
// with a shelf being worked on (seen, already seen, out of place, unknown), the missing list
// filtered by shelf and exported; on a phone the camera stays open and reads the legacy Code 39 of
// the fake video (a code the seed does not have, 9.12); the campaign closed with its summary and reopened, which gives the copies back.
import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

async function open(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await waitForHydration(page);
}

async function scan(page: Page, code: string): Promise<void> {
	const field = page.getByRole("textbox", { name: "Codice della copia" });
	await field.fill(code);
	await field.press("Enter");
	// the field keeps the focus, ready for the next code
	await expect(field).toBeFocused();
}

const results = (page: Page): Locator => page.getByTestId("inventory-result");

test.describe.serial("stocktaking", () => {
	test("a campaign started and scanned at the desk", async ({ page }) => {
		await open(page, "/catalog");
		await page.getByTestId("area-catalog-tab-inventory").click();
		await expect(page).toHaveURL(/\/inventory$/);
		await waitForHydration(page);
		await expect(page.getByText("Nessun inventario in corso")).toBeVisible();
		await page.getByTestId("inventory-name").fill("Inventario di prova");
		await page.getByTestId("inventory-start").click();
		await expect(page.getByTestId("inventory-current")).toContainText("Inventario di prova");
		await expect(page.getByTestId("inventory-overall")).toContainText(/0 su \d+ \(0%\)/);

		await page.getByTestId("inventory-shelf").fill("D");
		await scan(page, "2026-T0003"); // D 1 RAY: on its shelf
		await expect(results(page).first()).toHaveAttribute("data-kind", "seen");
		await scan(page, "2026'T0003"); // the scanner on an Italian layout
		await expect(results(page).first()).toHaveAttribute("data-kind", "again");
		await expect(results(page).first()).toContainText("già letta");
		await scan(page, "2024-T0016"); // A 2 RAL, found on the D shelf
		await expect(results(page).first()).toHaveAttribute("data-kind", "misplaced");
		await expect(results(page).first()).toContainText("fuori posto");
		await scan(page, "9999-99999");
		await expect(results(page).first()).toHaveAttribute("data-kind", "unknown");
		await expect(results(page)).toHaveCount(4);
		await expect(page.getByTestId("inventory-current")).toContainText(
			"2 copie lette · 1 fuori posto",
		);
		await expectAxeClean(page);

		// the missing copies of one shelf, and their export
		await page.getByTestId("missing-shelf").selectOption("D 1");
		const missing = page.getByTestId("missing-list");
		await expect(missing).not.toContainText("2026-T0003");
		await expect(missing.locator("li").first()).toContainText(/D 1 /);
		const downloading = page.waitForEvent("download");
		await page.getByTestId("missing-export").click();
		const csv = readFileSync(await (await downloading).path(), "utf8");
		expect(csv).not.toContain("2026-T0003");
		expect(csv.split("\n").slice(1).filter(Boolean).length).toBeGreaterThan(0);

		// the dashboard invites to go on
		await open(page, "/");
		await expect(page.getByTestId("inventory-tile")).toContainText("Inventario di prova");
		await page.getByTestId("inventory-continue").click();
		await expect(page).toHaveURL(/\/inventory$/);
	});

	test.describe("on a phone", () => {
		test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

		test("the camera stays open scan after scan", async ({ page }) => {
			await open(page, "/inventory");
			await page.getByTestId("inventory-camera").click();
			// the fake video shows an ISBN, a card and the legacy copy label 2026-0042: the ISBN and
			// the card are ignored, the label is read (no copy of the seed has that code)
			await expect(results(page).first()).toHaveAttribute("data-kind", "unknown", {
				timeout: 20_000,
			});
			await expect(results(page).first()).toContainText("2026-0042");
			await expect(results(page).filter({ hasText: "0000001240" })).toHaveCount(0);
			// full screen on the phone, until "Fine"
			await expect(page.getByTestId("inventory-camera-stage")).toHaveCSS("position", "fixed");
			await page.getByTestId("inventory-camera-done").click();
			await expect(page.getByTestId("scanner-overlay")).toHaveCount(0);
			await expect(page.getByRole("textbox", { name: "Codice della copia" })).toBeVisible();
		});
	});

	test("closed with its summary, then reopened", async ({ page }) => {
		await open(page, "/inventory");
		const overall = page.getByTestId("inventory-overall");
		const expected = /su (\d+)/.exec(await overall.innerText())?.[1] ?? "";
		await page.getByTestId("inventory-close").click();
		await expect(page.getByTestId("confirm-dialog")).toContainText("segnate come smarrite");
		await page.getByTestId("confirm-button").click();
		const summary = page.getByTestId("inventory-summary");
		await expect(summary).toContainText("Inventario chiuso");
		await expect(summary).toContainText(
			new RegExp(
				`2 copie viste su ${expected}, ${Number(expected) - 2} segnate come smarrite`,
			),
		);
		await expect(page.getByText("Nessun inventario in corso")).toBeVisible();
		await open(page, "/");
		await expect(page.getByTestId("inventory-tile")).toHaveCount(0);

		// a copy never scanned is lost in the catalogue, one scanned is not; the audit has the close
		await open(page, "/catalog");
		await page.getByLabel("Cerca").fill("2020-Y0001");
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(page.getByTestId("item-row-2020-Y0001")).toContainText("Smarrito");
		await open(page, "/catalog");
		await page.getByLabel("Cerca").fill("2026-T0003");
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(page.getByTestId("item-row-2026-T0003")).not.toContainText("Smarrito");
		await open(page, "/admin/audit");
		await page.getByTestId("audit-action").selectOption("inventory.close");
		await expect(page.getByTestId("audit-count")).toContainText("1 di 1");

		// reopened within the week: the copies marked lost by the close are back on the shelves
		await open(page, "/inventory");
		const history = page.getByTestId("inventory-history");
		await expect(history).toContainText("Inventario di prova");
		await history.getByTestId("inventory-reopen").click();
		await expect(page.getByTestId("inventory-current")).toContainText("2 copie lette");
		await expect(overall).toContainText(`su ${expected}`);
	});
});
