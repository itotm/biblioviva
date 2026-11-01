// SPDX-License-Identifier: GPL-3.0-or-later
// Checkout desk (step 4.3, Appendix I, 9.13 round 33): the circulation area opens on the desk; one
// field, the patron first (card, or a part of the name), then the books; a copy scanned before the
// card, the card, a loan with its due date, a duplicate scan, the loan limit of a student (the
// field of the books gives way; a patron already at the limit gets the dialog in the middle of the
// page, with the link to Returns), undo, a copy lent to someone else, unknown and mistyped codes,
// an administrator's override. Keyboard only: every code is typed and confirmed with Enter, like a
// USB scanner.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createBook, createPatron, withWrongCheck } from "./helpers/data.js";
import { pageAction } from "./helpers/actions.js";
import { waitForHydration } from "./helpers/hydration.js";
import { deskField, deskScan } from "./helpers/desk.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

const scan = deskScan;

const message = (page: Page): Locator => page.getByTestId("desk-message").first();

test.describe.serial("checkout desk", () => {
	test("lends, explains every refusal and undoes", async ({ page }) => {
		const t = tagOf(page);
		const student = await createPatron(page, `Prestito${t}`);
		const teacher = await createPatron(page, `Docenza${t}`, "teacher");
		const book = await createBook(page, `Libro del banco ${t}`, 3);
		const [c1, c2, c3] = book.barcodes as [string, string, string];

		await page.goto("/circulation");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		await waitForHydration(page);
		await expectAxeClean(page);

		// a book before the card
		await scan(page, c1);
		await expect(message(page)).toHaveAttribute("data-code", "no_patron_selected");
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			`È stato letto il libro «Libro del banco ${t}» senza una tessera. Leggere prima la tessera dell'utente; per una restituzione aprire Restituzioni.`,
		);
		await expect(page.getByTestId("action-to-checkin")).toHaveAttribute(
			"href",
			`/circulation/checkin?barcode=${encodeURIComponent(c1)}`,
		);

		// the card, then the first book
		await scan(page, student.card);
		await expect(page.getByTestId("desk-patron-name")).toHaveText(`Prestito${t}`);
		await expect(page.getByTestId("desk-patron-count")).toHaveText("0 di 1 prestito");
		await scan(page, c1);
		await expect(message(page)).toHaveAttribute("data-code", "lent");
		await expect(page.getByTestId("desk-session-list")).toContainText(`Libro del banco ${t}`);
		await expect(page.getByTestId("desk-patron-count")).toHaveText("1 di 1 prestito");
		await expectAxeClean(page);

		// the student's limit is one: the field of the books gives way to the notice
		await expect(page.getByTestId("desk-limit").locator("p")).toHaveText(
			`Anna Prestito${t} ha raggiunto il limite di prestiti (1): nessun nuovo prestito prima di una restituzione. Restano possibili i rinnovi dei prestiti in corso.`,
		);
		await expect(deskField(page)).toHaveCount(0);
		await expect(page.getByTestId("desk-renew")).toHaveText("Rinnova");

		// undo the last loan: the student can borrow again
		await page.getByTestId("desk-undo").click();
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			`Annullato: «Libro del banco ${t}» non è più in prestito a Anna Prestito${t}.`,
		);
		await expect(page.getByTestId("desk-patron-count")).toHaveText("0 di 1 prestito");
		await scan(page, c1);
		await expect(message(page)).toHaveAttribute("data-code", "lent");
		await page.getByTestId("desk-finish").click();
		await expect(page.getByTestId("desk-patron")).toHaveCount(0);

		// the student again, found by a part of the name: already at the limit, the dialog says so
		// in the middle of the page and the books are never asked for
		await deskField(page).fill(`restito${t}`.toLowerCase());
		await expect(page.getByTestId("desk-scan-results")).toContainText(`Prestito${t} Anna`);
		await deskField(page).press("Enter");
		const limit = page.getByTestId("desk-limit-dialog");
		await expect(limit.getByTestId("desk-message-text")).toHaveText(
			`Anna Prestito${t} ha già 1 libro in prestito («Libro del banco ${t}»); il limite è 1. Per un nuovo prestito registrare prima una restituzione nella pagina Restituzioni.`,
		);
		await expect(limit.getByTestId("action-to-checkin")).toHaveAttribute(
			"href",
			"/circulation/checkin",
		);
		await expect(limit.getByTestId("action-override")).toHaveCount(0);
		await expectAxeClean(page);
		await limit.getByTestId("desk-limit-close").click();
		await expect(limit).toHaveCount(0);
		await expect(page.getByTestId("desk-limit")).toBeVisible();
		await expect(deskField(page)).toHaveCount(0);
		// the desk's own tab starts it again with no patron (bug: it kept the patron at the limit)
		await page.getByTestId("desk-tab-checkout").click();
		await expect(page.getByTestId("desk-patron")).toHaveCount(0);
		await expect(
			page.getByRole("combobox", { name: "Tessera o nome dell'utente" }),
		).toBeFocused();
		// and the notice of the limit has its own way out
		await deskField(page).fill(student.card);
		await deskField(page).press("Enter");
		await page.getByTestId("desk-limit-close").click();
		await page.getByTestId("desk-limit").getByRole("button", { name: "Fine" }).click();
		await expect(page.getByTestId("desk-patron")).toHaveCount(0);

		// the teacher, found by surname with the keyboard
		const search = deskField(page);
		await search.fill(`docenza${t}`.toLowerCase());
		await expect(page.getByTestId("desk-scan-results")).toContainText(`Docenza${t} Anna`);
		await search.press("ArrowDown");
		await search.press("Enter");
		await expect(page.getByTestId("desk-patron-name")).toHaveText(`Docenza${t}`);

		// a book, then the same book again in this session
		await scan(page, c2);
		await expect(message(page)).toHaveAttribute("data-code", "lent");
		await scan(page, c2);
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			`«Libro del banco ${t}» è già nell'elenco di questo prestito.`,
		);

		// the book lent to the student is refused, with the link to Returns carrying the barcode
		await scan(page, c1);
		await expect(message(page)).toHaveAttribute("data-code", "item_on_loan_other_patron");
		await expect(page.getByTestId("desk-message-text").first()).toContainText(
			`«Libro del banco ${t}» risulta in prestito a Anna Prestito${t} dal`,
		);

		// unknown and mistyped codes
		await scan(page, "2099-0001");
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			/^Codice 2099-0001 non trovato\. Verificare la lettura dello scanner o digitare il codice: i codici dei libri hanno la forma \d{4}-[A-Z]0123, i numeri delle tessere [A-Z]000123\.$/,
		);
		const mistyped = withWrongCheck(c2);
		await scan(page, mistyped);
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			`Il codice ${mistyped} non è valido: il carattere di controllo non corrisponde. Rileggere il codice o digitarlo.`,
		);

		// a copy in repair: only an administrator may force it, with a reason
		await page.goto(book.url);
		await waitForHydration(page);
		await page.getByTestId(`status-item-${c3}`).click();
		await page.getByTestId("status-select").selectOption("in_repair");
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Stato aggiornato")).toBeVisible();
		await page.goto(`/circulation/checkout?patron=${teacher.id}`);
		await waitForHydration(page);
		await expect(page.getByTestId("desk-patron-name")).toHaveText(`Docenza${t}`);
		await scan(page, c3);
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			`«Libro del banco ${t}» risulta in riparazione e non può essere prestato. Se il libro è tornato disponibile, aggiornarne lo stato dalla scheda.`,
		);
		await page.getByTestId("action-override").click();
		await page.getByTestId("override-reason").fill("riparato stamattina");
		await page.getByTestId("confirm-button").click();
		await expect(message(page)).toHaveAttribute("data-code", "lent");
		await expect(page.getByTestId("desk-patron-count")).toHaveText("2 di 4 prestiti");
	});

	test("a removed patron cannot borrow", async ({ page }) => {
		const t = tagOf(page);
		const gone = await createPatron(page, `Rimosso${t}`);
		const book = await createBook(page, `Libro del rimosso ${t}`, 1);
		await page.goto(`/patrons/${gone.id}`);
		await waitForHydration(page);
		await (await pageAction(page, "remove-patron")).click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Utente rimosso")).toBeVisible();
		// the card number is erased with the names: the old card is an unknown code
		await page.goto(`/circulation/checkout?patron=${gone.id}`);
		await waitForHydration(page);
		await scan(page, book.barcodes[0] ?? "");
		await expect(message(page)).toHaveAttribute("data-code", "patron_anonymized");
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			"Questa tessera appartiene a un utente rimosso e non è più valida.",
		);
		await scan(page, gone.card);
		await expect(message(page)).toHaveAttribute("data-code", "unknown_barcode");
	});

	test("a long title stays inside the window", async ({ page }) => {
		// a phone: the desk's boxes ran past the right edge with a long title of the day
		const t = tagOf(page);
		const reader = await createPatron(page, `Lungo${t}`, "teacher");
		const book = await createBook(
			page,
			`Opere complete di un autore dal nome molto lungo, edizione commentata ${t}`,
			1,
		);
		await page.goto("/circulation/checkout");
		await waitForHydration(page);
		await scan(page, reader.card);
		await scan(page, book.barcodes[0] ?? "");
		await expect(message(page)).toHaveAttribute("data-code", "lent");
		await page.goto("/circulation/checkout");
		await waitForHydration(page);
		await expect(page.getByTestId("today-issued")).toContainText("Opere complete");
		const width = page.viewportSize()?.width ?? 0;
		for (const id of ["desk-scan-card", "today-issued", "today-returned"]) {
			const box = await page.getByTestId(id).boundingBox();
			expect(box, id).not.toBeNull();
			// inside the window, with the page's own margin on the right
			expect((box?.x ?? 0) + (box?.width ?? 0), id).toBeLessThanOrEqual(width - 8);
		}
		// the title itself is cut short inside its box
		const title = await page
			.getByTestId("today-issued")
			.getByText(new RegExp(`^Opere complete .* ${t}$`))
			.boundingBox();
		expect((title?.x ?? 0) + (title?.width ?? 0)).toBeLessThanOrEqual(width - 8);
	});
});
