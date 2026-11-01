// SPDX-License-Identifier: GPL-3.0-or-later
// Circulation history (step 4.7): today's checkouts and returns on the desk, the loan history of
// a record with the class of the day, the anonymized name after the patron's removal.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createBook, createPatron } from "./helpers/data.js";
import { pageAction } from "./helpers/actions.js";
import { waitForHydration } from "./helpers/hydration.js";
import { deskScan } from "./helpers/desk.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

async function scan(page: Page, name: string, code: string): Promise<void> {
	const field = page.getByRole("textbox", { name });
	await field.fill(code);
	await field.press("Enter");
}

test.describe.serial("circulation history", () => {
	test("today's activity and the history of a record", async ({ page }) => {
		const t = tagOf(page);
		const student = await createPatron(page, `Storico${t}`);
		const book = await createBook(page, `Libro con storia ${t}`, 1);
		const [c1] = book.barcodes as [string];

		await page.goto(`/circulation/checkout?patron=${student.id}`);
		await waitForHydration(page);
		await deskScan(page, c1);
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute("data-code", "lent");
		await page.getByTestId("desk-finish").click();
		const today = page.getByTestId("today-activity");
		await expect(today.getByTestId("today-issued")).toContainText(`Libro con storia ${t}`);
		await expect(today.getByTestId("today-issued")).toContainText(`Anna Storico${t}`);
		await expectAxeClean(page);

		await page.getByTestId("desk-tab-checkin").click();
		await waitForHydration(page);
		await scan(page, "Passa il codice del libro restituito", c1);
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute(
			"data-code",
			"returned",
		);
		await page.goto("/circulation/checkout");
		await waitForHydration(page);
		await expect(page.getByTestId("today-returned")).toContainText(`Libro con storia ${t}`);

		// the record's history: who, the class of the day, the outcome
		await page.goto(book.url);
		await waitForHydration(page);
		await page.getByTestId("tab-history").click();
		const history = page.getByTestId("record-history");
		await expect(history.getByText(`Anna Storico${t}`)).toBeVisible();
		await expect(history.getByText("4 B")).toBeVisible();
		await expect(history.getByText("Restituito", { exact: true })).toBeVisible();

		// after the removal the history keeps the loan with the anonymized name
		await page.goto(`/patrons/${student.id}`);
		await waitForHydration(page);
		await (await pageAction(page, "remove-patron")).click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Utente rimosso")).toBeVisible();
		await page.goto(book.url);
		await waitForHydration(page);
		await page.getByTestId("tab-history").click();
		await expect(
			page.getByTestId("record-history").getByText(`Studente Rimosso #${student.id}`),
		).toBeVisible();
		await expect(page.getByTestId("record-history").getByText(`Storico${t}`)).toHaveCount(0);
	});
});
