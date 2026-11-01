// SPDX-License-Identifier: GPL-3.0-or-later
// "Nuovo libro" opened again starts from the code (9.13, round 9): neither the book saved on the
// previous visit nor a record left half way comes back; a wrong code is one tap from a new try.
import { expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";

test("opening fast add again starts over", async ({ page, isMobile }) => {
	test.skip(isMobile, "the navigation is the same on a phone");
	const home = page.getByRole("link", { name: "Biblioteca dell'Istituto" }).first();
	const fastAdd = page.getByRole("link", { name: "Nuovo libro" }).first();
	const code = page.getByLabel("ISBN o EAN");
	await page.goto("/");
	await waitForHydration(page);

	// a DVD saved, then back to the dashboard and "Nuovo libro" again
	await fastAdd.click();
	await code.fill("4006381333931");
	await code.press("Enter");
	await expect(page.getByTestId("stage-form")).toBeVisible();
	await page.getByLabel("Titolo", { exact: true }).fill("Film della ripartenza");
	await page.getByLabel("Autore", { exact: true }).fill("Rossi, Mario");
	await page.getByLabel("Editore", { exact: true }).fill("Prova");
	await page.getByTestId("genre-A").click();
	await page.getByTestId("reading-level-3").click();
	await page.getByTestId("biblio-submit").click();
	await expect(page.getByTestId("stage-done")).toBeVisible();
	await home.click();
	await expect(page).toHaveURL(/\/$/);
	await fastAdd.click();
	await expect(page.getByTestId("stage-code")).toBeVisible();
	await expect(page.getByTestId("stage-done")).toHaveCount(0);

	// a code that is not the book's: the form says what was read and goes back to the code
	await code.fill("4006381333931");
	await code.press("Enter");
	await expect(page.getByTestId("form-code-message")).toContainText("4006381333931");
	await page.getByTestId("form-rescan").click();
	await expect(page.getByTestId("stage-code")).toBeVisible();

	// a record left half way
	await code.fill("4006381333931");
	await code.press("Enter");
	await expect(page.getByTestId("stage-form")).toBeVisible();
	await home.click();
	await expect(page).toHaveURL(/\/$/);
	await fastAdd.click();
	await expect(page.getByTestId("stage-code")).toBeVisible();
	await expect(page.getByTestId("stage-form")).toHaveCount(0);
});
