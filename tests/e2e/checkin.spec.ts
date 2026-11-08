// SPDX-License-Identifier: GPL-3.0-or-later
// Check-in desk (step 4.4, Appendix I): a return with the patron and the dates, a second scan the
// same day, "Rinnova invece", "Segna danneggiato", a copy not on loan, a card scanned here, a lost
// copy found again, and the barcode carried over from the checkout desk (confirmed with Enter).
// Keyboard only, like a USB scanner.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createBook, createPatron } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";
import { deskScan } from "./helpers/desk.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

const field = (page: Page, name: string): Locator => page.getByRole("textbox", { name });

async function scan(page: Page, name: string, code: string): Promise<void> {
	await field(page, name).fill(code);
	await field(page, name).press("Enter");
}

const CHECKIN = "Passa il codice del libro restituito";
const message = (page: Page): Locator => page.getByTestId("desk-message").first();
const messageText = (page: Page): Locator => page.getByTestId("desk-message-text").first();

test.describe.serial("check-in desk", () => {
	test("returns, explains every case and renews instead", async ({ page }) => {
		const t = tagOf(page);
		const student = await createPatron(page, `Rientro${t}`);
		const teacher = await createPatron(page, `Rientrodoc${t}`, "teacher");
		const book = await createBook(page, `Libro di ritorno ${t}`, 3);
		const [c1, c2, c3] = book.barcodes as [string, string, string];
		const title = `Libro di ritorno ${t}`;

		// lend c1, then switch to the check-in desk with the tab
		await page.goto(`/circulation/checkout?patron=${student.id}`);
		await waitForHydration(page);
		await deskScan(page, c1);
		await expect(message(page)).toHaveAttribute("data-code", "lent");
		await page.getByTestId("desk-tab-checkin").click();
		await expect(page).toHaveURL(/\/circulation\/checkin$/);
		await waitForHydration(page);
		await expect(page.getByTestId("desk-tab-checkin")).toHaveAttribute("aria-current", "page");
		await expectAxeClean(page);

		// the return, with the patron, the class and the dates
		await scan(page, CHECKIN, c1);
		await expect(message(page)).toHaveAttribute("data-code", "returned");
		await expect(messageText(page)).toHaveText(`Restituito: «${title}» (Anna Rientro${t}).`);
		const row = page.getByTestId("checkin-row").first();
		await expect(row).toContainText(`Anna Rientro${t}`);
		await expect(row).toContainText("4 B");
		await expect(row.getByTestId("status-badge")).toContainText("in tempo");
		await expectAxeClean(page);

		// the same book again today
		await scan(page, CHECKIN, c1);
		await expect(message(page)).toHaveAttribute("data-code", "already_returned_today");
		await expect(messageText(page)).toHaveText(
			new RegExp(`^«${title}» è già stato restituito oggi alle \\d{2}:\\d{2}\\.$`),
		);

		// the pupil wanted to keep it: renew instead
		await row.getByTestId("checkin-renew").click();
		await expect(message(page)).toHaveAttribute("data-code", "renewed_instead");
		await expect(messageText(page)).toContainText(
			`Rinnovato invece di restituito: «${title}», nuova scadenza`,
		);
		await expect(row.getByTestId("status-badge")).toContainText("rinnovato fino al");
		await expect(row.getByTestId("checkin-renew")).toHaveCount(0);

		// returned for good, worn: mark it damaged
		await scan(page, CHECKIN, c1);
		await expect(message(page)).toHaveAttribute("data-code", "returned");
		await expect(page.getByTestId("checkin-row")).toHaveCount(2);
		await page.getByTestId("checkin-row").first().getByTestId("checkin-damaged").click();
		await expect(messageText(page)).toHaveText(
			`«${title}» è segnato come danneggiato: si può ancora prestare.`,
		);
		await expect(page.getByTestId("checkin-row").first()).toContainText("Danneggiato");

		// a copy that is not on loan
		await scan(page, CHECKIN, c2);
		await expect(messageText(page)).toHaveText(
			`«${title}» non risulta in prestito: nessuna restituzione da registrare. Se era prestato senza registrazione, il libro è comunque disponibile.`,
		);

		// a card scanned at the check-in desk
		await scan(page, CHECKIN, student.card);
		await expect(message(page)).toHaveAttribute("data-code", "card_on_checkin");
		await expect(messageText(page)).toHaveText(
			`Questa è una tessera (Anna Rientro${t}), non un libro. Qui si registrano solo le restituzioni: per un prestito aprire Prestiti.`,
		);
		await expect(page.getByTestId("action-to-checkout")).toHaveAttribute(
			"href",
			`/circulation/checkout?patron=${student.id}`,
		);

		// a copy marked lost comes back
		await page.goto(book.url);
		await waitForHydration(page);
		await page.getByTestId(`status-item-${c3}`).click();
		await page.getByTestId("status-select").selectOption("lost");
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Stato aggiornato")).toBeVisible();
		await page.goto("/circulation/checkin");
		await waitForHydration(page);
		await scan(page, CHECKIN, c3);
		await expect(message(page)).toHaveAttribute("data-code", "was_lost_now_found");
		await expect(messageText(page)).toHaveText(
			`«${title}» era segnato come smarrito: ora torna disponibile.`,
		);
		await page.getByTestId("action-confirm-found").click();
		await expect(page.getByTestId("desk-message")).toHaveCount(0);

		// from the checkout desk: a copy still lent to someone else goes to Returns with its code,
		// and the return is confirmed there with Enter or with the message's button
		await page.goto(`/circulation/checkout?patron=${student.id}`);
		await waitForHydration(page);
		await deskScan(page, c2);
		await expect(message(page)).toHaveAttribute("data-code", "lent");
		await page.goto(`/circulation/checkout?patron=${teacher.id}`);
		await waitForHydration(page);
		await deskScan(page, c2);
		await expect(message(page)).toHaveAttribute("data-code", "item_on_loan_other_patron");
		await page.getByTestId("action-to-checkin").click();
		await expect(page).toHaveURL(/\/circulation\/checkin\?barcode=/);
		await waitForHydration(page);
		await expect(messageText(page)).toHaveText(
			`Premere Invio, o il pulsante qui sotto, per registrare la restituzione del libro ${c2}.`,
		);
		await expect(field(page, CHECKIN)).toHaveValue(c2);
		await expect(page.getByTestId("checkin-row")).toHaveCount(0);
		await field(page, CHECKIN).press("Enter");
		await expect(message(page)).toHaveAttribute("data-code", "returned", { timeout: 15_000 });
		await expect(page.getByTestId("checkin-row")).toHaveCount(1);

		// on a phone or with the mouse there is no Enter at hand: the message's button confirms it
		await page.goto(`/circulation/checkout?patron=${teacher.id}`);
		await waitForHydration(page);
		await deskScan(page, c2);
		await expect(message(page)).toHaveAttribute("data-code", "lent");
		await page.goto(`/circulation/checkout?patron=${student.id}`);
		await waitForHydration(page);
		await deskScan(page, c2);
		await expect(message(page)).toHaveAttribute("data-code", "item_on_loan_other_patron");
		await page.getByTestId("action-to-checkin").click();
		await expect(page).toHaveURL(/\/circulation\/checkin\?barcode=/);
		await waitForHydration(page);
		await expect(page.getByTestId("checkin-row")).toHaveCount(0);
		await page.getByTestId("action-confirm-return").click();
		await expect(message(page)).toHaveAttribute("data-code", "returned", { timeout: 15_000 });
		await expect(page.getByTestId("checkin-row")).toHaveCount(1);
		await expect(field(page, CHECKIN)).toHaveValue("");
	});
});
