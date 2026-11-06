// SPDX-License-Identifier: GPL-3.0-or-later
// A loan right after a return (step 9.52, Q145): a pupil brings a book back with the next one
// already chosen. At the Prestito desk the book read without a card is returned and its borrower is
// chosen, so the next book is lent to them; at the Restituzione desk each return offers "Presta a".
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createBook, createPatron } from "./helpers/data.js";
import { deskScan } from "./helpers/desk.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

test("returns at the checkout and lends to the same pupil; Presta a from the returns", async ({
	page,
}) => {
	const t = tagOf(page);
	const pupil = await createPatron(page, `Scambio${t}`);
	const book = await createBook(page, `Libro dello scambio ${t}`, 3);
	const [c1, c2, c3] = book.barcodes as [string, string, string];
	const message = page.getByTestId("desk-message").first();

	// the first loan, with the card
	await page.goto("/circulation/checkout");
	await waitForHydration(page);
	await deskScan(page, pupil.card);
	await deskScan(page, c1);
	await expect(message).toHaveAttribute("data-code", "lent");

	// later: the book comes back with the next one, no card read
	await page.goto("/circulation/checkout");
	await waitForHydration(page);
	await expect(page.getByTestId("desk-patron")).toHaveCount(0);
	await deskScan(page, c1);
	await expect(message).toHaveAttribute("data-code", "returned_now_lending");
	await expect(page.getByTestId("desk-message-text").first()).toContainText(
		`Restituito: «Libro dello scambio ${t}». Ora i libri letti si prestano a `,
	);
	await expect(page.getByTestId("desk-message-text").first()).toContainText(`Scambio${t}`);
	await expect(page.getByTestId("desk-patron-name")).toHaveText(`Scambio${t}`);
	await expectAxeClean(page);
	// the limit of one book is free again: the next book is lent to the same pupil
	await deskScan(page, c2);
	await expect(message).toHaveAttribute("data-code", "lent");

	// at the returns: each return offers the loan to its borrower
	await page.goto("/circulation/checkin");
	await waitForHydration(page);
	const returns = page.getByRole("textbox", { name: "Passa il codice del libro restituito" });
	await returns.fill(c2);
	await returns.press("Enter");
	await expect(message).toHaveAttribute("data-code", "returned");
	await page.getByTestId("action-lend-to").click();
	await expect(page).toHaveURL(new RegExp(`/circulation/checkout\\?patron=${pupil.id}$`));
	await waitForHydration(page);
	await expect(page.getByTestId("desk-patron-name")).toHaveText(`Scambio${t}`);
	await deskScan(page, c3);
	await expect(message).toHaveAttribute("data-code", "lent");
});
