// SPDX-License-Identifier: GPL-3.0-or-later
// New patron with the photo taken before the save (9.13, round 11): the photo is shown next to
// the form, can be removed and taken again, and is stored with the patron.
import { expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";

test("the photo is taken with the form and saved with the patron", async ({ page }) => {
	const tag = page.viewportSize()?.width === 412 ? "Mob" : "Desk";
	await page.goto("/patrons/new");
	await waitForHydration(page);
	await expect(page.getByTestId("new-photo-status")).toContainText("La foto è richiesta");
	await expect(page.getByTestId("new-photo-take")).toHaveText("Scatta foto");

	await page.getByTestId("new-photo-take").click();
	await expect(page.getByTestId("photo-panel")).toBeVisible();
	await page.getByTestId("photo-file").setInputFiles("tests/fixtures/images/portrait-exif.jpg");
	await page.getByTestId("photo-use").click();
	await expect(page.getByTestId("photo-panel")).toHaveCount(0);
	await expect(page.getByTestId("new-photo-image")).toBeVisible();
	await expect(page.getByTestId("new-photo-status")).toContainText("insieme all'utente");
	// removed and taken again
	await page.getByTestId("new-photo-remove").click();
	await expect(page.getByTestId("new-photo-image")).toHaveCount(0);
	await page.getByTestId("new-photo-take").click();
	await page.getByTestId("photo-file").setInputFiles("tests/fixtures/images/portrait-exif.jpg");
	await page.getByTestId("photo-use").click();
	await expect(page.getByTestId("new-photo-image")).toBeVisible();

	await page.getByLabel("Cognome", { exact: true }).fill(`ConFoto${tag}`);
	await page.getByLabel("Nome", { exact: true }).fill("Bianca");
	await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption("2");
	await page.getByRole("combobox", { name: "Sezione", exact: true }).selectOption("B");
	await page.getByTestId("patron-submit").click();
	await expect(page).toHaveURL(/\/patrons\/\d+$/);
	await waitForHydration(page);
	await expect(page.getByTestId("patron-photo")).toBeVisible();
	const src = await page.getByTestId("patron-photo").getAttribute("src");
	const res = await page.request.get(src!);
	expect(res.headers()["content-type"]).toBe("image/webp");
});
