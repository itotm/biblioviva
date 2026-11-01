// SPDX-License-Identifier: GPL-3.0-or-later
// Catalogue search (step 5.1): words in any order with prefixes and without accents, a copy's
// barcode or an ISBN opens the record, availability filter
// with its badge, the classification pictogram in the grid; the original title of a translation.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createBook } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

test.describe.serial("catalogue search", () => {
	test("finds by words, opens by barcode, filters by availability", async ({ page }) => {
		const t = tagOf(page);
		const title = `Città invisibili ricerca ${t}`;
		const book = await createBook(page, title, 1);
		const [c1] = book.barcodes as [string];

		await page.goto("/catalog");
		await waitForHydration(page);
		const search = page.getByLabel("Cerca");
		// accents, order and prefixes do not matter
		await search.fill(`ricer citta invis ${t.toLowerCase()}`);
		const grid = page.getByTestId("data-grid");
		await expect(grid.getByText(title)).toBeVisible();
		// one exact result; fewer than three, so the closest titles follow, counted apart (9.24)
		await expect(page.getByTestId("biblio-count")).toContainText(
			"1 titolo corrisponde ai filtri",
		);
		await expect(page.getByTestId("biblio-count")).toContainText("simili");
		const row = grid.getByRole("row", { name: new RegExp(title) });
		await expect(row.getByTestId("availability")).toHaveText("1 di 1 disponibili");
		await expect(row.getByTestId("similar-badge")).toHaveCount(0);
		await expect(grid.locator('img[src^="/media/classification/"]').first()).toBeVisible();
		await expectAxeClean(page);

		// "only available" keeps a book that is on the shelf
		await page.getByTestId("only-available").check();
		await expect(grid.getByText(title)).toBeVisible();

		// a row that opens the record says so with the pointer; Back finds the search as it was
		await expect(row).toHaveCSS("cursor", "pointer");
		await grid.getByText(title).click();
		await expect(page).toHaveURL(new RegExp(`/catalog/${book.id}$`));
		await waitForHydration(page);
		await page.goBack();
		await expect(page).toHaveURL(/\/catalog$/);
		await expect(search).toHaveValue(`ricer citta invis ${t.toLowerCase()}`);
		await expect(page.getByTestId("only-available")).toBeChecked();
		await expect(grid.getByText(title)).toBeVisible();
		await page.getByTestId("only-available").uncheck();

		// a scanned copy barcode opens the record
		await search.fill(c1);
		await expect(page).toHaveURL(new RegExp(`/catalog/${book.id}$`));
		await page.goBack();
		await expect(page).toHaveURL(/\/catalog$/);
		// the URL changes as soon as the browser goes back; SvelteKit applies the page only once
		// its data has arrived, and then blurs whatever has the focus
		await expect(page.getByRole("searchbox", { name: "Cerca", exact: true })).toBeVisible();
	});

	test("finds a translation by its original title, typed by hand (9.23)", async ({ page }) => {
		const t = tagOf(page);
		const title = `Il ritorno del drago ${t}`;
		const original = `The dragon returns ${t} ${Date.now().toString(36)}`;
		const book = await createBook(page, title, 1);
		await page.getByTestId("edit-biblio").click();
		await waitForHydration(page);
		await page.getByRole("textbox", { name: /^Titolo originale/ }).fill(original);
		await page.getByTestId("biblio-submit").click();
		await expect(page).toHaveURL(new RegExp(`/catalog/${book.id}$`));
		await waitForHydration(page);
		await page.getByRole("tab", { name: "Dettagli" }).click();
		await expect(page.getByTestId("biblio-details")).toContainText(original);

		// the grid finds it by the words of the original title and shows it beside the title
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(original.split(" ").slice(1).join(" "));
		const grid = page.getByTestId("data-grid");
		// the book of the other viewport's run may follow as similar: look at this one's row
		const row = grid.getByRole("row", { name: new RegExp(title) });
		await expect(row.getByTestId("title-original")).toHaveText(original);
		await expectAxeClean(page);
	});

	test("shows the closest titles, marked, for a title typed with mistakes (9.24)", async ({
		page,
	}) => {
		const t = tagOf(page);
		const title = `Il volo del calabrone ${t}`;
		await createBook(page, title, 1);
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill("calabrnoe volo");
		const row = page.getByTestId("data-grid").getByRole("row", { name: new RegExp(title) });
		await expect(row).toBeVisible();
		await expect(row.getByTestId("similar-badge")).toHaveText("Simile");
		await expectAxeClean(page);
	});
});
