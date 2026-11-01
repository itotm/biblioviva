// SPDX-License-Identifier: GPL-3.0-or-later
// Patron quick search (step 5.2): a surname with a particle is found with or without the space,
// at the checkout desk and in the census (which jumps to the person inside their class); a typing
// mistake is forgiven, and the grid finds a card number (9.24).
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createPatron } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";
import { deskField } from "./helpers/desk.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

test.describe.serial("patron quick search", () => {
	test("desk and census find De Luca as deluca", async ({ page }) => {
		const t = tagOf(page);
		const surname = `De Ricerca${t}`;
		await createPatron(page, surname);

		// the checkout desk, typing the name without the space
		await page.goto("/circulation/checkout");
		await waitForHydration(page);
		const desk = deskField(page);
		await desk.fill(`dericerca${t}`.toLowerCase());
		await expect(page.getByTestId("desk-scan-results")).toContainText(`${surname} Anna`);
		await desk.press("Enter");
		await expect(page.getByTestId("desk-patron-name")).toHaveText(surname);

		// the census: the person is opened inside their class, ready for the photo
		await page.goto("/census");
		await waitForHydration(page);
		const census = page.getByTestId("census-patron-search");
		await census.fill(`de ricerca${t}`.toLowerCase());
		await expect(page.getByTestId("census-patron-results")).toContainText(`${surname} Anna`);
		await expectAxeClean(page);
		await census.press("Enter");
		await expect(page.getByTestId("census-current")).toContainText(surname);
		await expect(page.getByTestId("census-progress")).toBeVisible();
	});

	test("forgives a typing mistake at the desk; the grid finds a card number (9.24)", async ({
		page,
	}) => {
		const t = tagOf(page);
		const surname = `Zanzibarri${t}`;
		const created = await createPatron(page, surname);

		// two letters swapped: the patron is offered as similar
		await page.goto("/circulation/checkout");
		await waitForHydration(page);
		const desk = deskField(page);
		await desk.fill(`zanzbiarri${t}`.toLowerCase());
		const results = page.getByTestId("desk-scan-results");
		await expect(results).toContainText(`${surname} Anna`);
		await expect(results.getByTestId("similar-badge").first()).toHaveText("Simile");
		await expectAxeClean(page);

		// the patrons grid: the digits of the card find the patron
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(created.card.replace(/\D/g, ""));
		await expect(page.getByTestId("data-grid").getByText(`${surname} Anna`)).toBeVisible();
	});
});
