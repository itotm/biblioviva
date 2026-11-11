// SPDX-License-Identifier: GPL-3.0-or-later
// Accessible books (step 9.66, Q157): a record is marked with two formats of the configured list
// in its form, shows them as badges and is found by the catalogue's filter, for one format and
// for any; unmarked, it leaves the filter.
import { expect, test } from "@playwright/test";
import { createBook } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";

test("a book marked accessible is found by the catalogue's filter", async ({ page }) => {
	const title = `Libro accessibile ${String(Date.now()).slice(-6)}`;
	const book = await createBook(page, title, 1);
	await expect(page.getByTestId("accessible-badge")).toHaveCount(0);

	await page.goto(`${book.url}/edit`);
	await waitForHydration(page);
	const formats = page.getByTestId("biblio-accessible-formats");
	await formats.getByTestId("accessible-format-Audiolibro").check();
	await formats.getByTestId("accessible-format-Alta leggibilità").check();
	await page.getByTestId("biblio-submit").click();
	await expect(page).toHaveURL(/\/catalog\/\d+$/);
	// the list's order, not the order of the clicks
	await expect(page.getByTestId("accessible-badge")).toHaveText([
		"Alta leggibilità",
		"Audiolibro",
	]);

	const find = async (format: string): Promise<void> => {
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByTestId("filter-accessible").selectOption(format);
		await page.getByLabel("Cerca").fill(title);
	};
	await find("Audiolibro");
	await expect(page.getByTestId("data-grid").getByText(title)).toBeVisible();
	await find("*");
	await expect(page.getByTestId("data-grid").getByText(title)).toBeVisible();
	await find("Tattile");
	await expect(page.getByTestId("data-grid").getByText(title)).toHaveCount(0);

	// unmarked, it leaves the filter
	await page.goto(`${book.url}/edit`);
	await waitForHydration(page);
	await page.getByTestId("accessible-format-Audiolibro").uncheck();
	await page.getByTestId("accessible-format-Alta leggibilità").uncheck();
	await page.getByTestId("biblio-submit").click();
	await expect(page).toHaveURL(/\/catalog\/\d+$/);
	await expect(page.getByTestId("accessible-badge")).toHaveCount(0);
	await find("*");
	await expect(page.getByTestId("data-grid").getByText(title)).toHaveCount(0);
	await page.getByTestId("clear-filters").click();
});
