// SPDX-License-Identifier: GPL-3.0-or-later
// The warning of an early renewal (Appendix I `renewal_early`): a renewal before half of the loan
// period has passed asks, in the middle of the page, "Rinnova comunque" or "Annulla" — at the
// checkout desk (the patron panel and a copy already lent to the same patron), on the patron
// page (one loan, all loans), at the check-in desk ("Rinnova invece") and from the loans grid.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createBook, createPatron, dayFromToday, importLoans } from "../helpers/data.js";
import { deskField, deskScan } from "../helpers/desk.js";
import { waitForHydration } from "../helpers/hydration.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

const CHECKIN = "Passa il codice del libro restituito";
const dialog = (page: Page): Locator => page.getByTestId("early-renewal-dialog");
const cancel = (page: Page): Locator => page.getByTestId("early-renewal-cancel");
const confirm = (page: Page): Locator => page.getByTestId("early-renewal-confirm");
const earlyText = (title: string): string =>
	`«${title}» è in prestito da 2 giorni su 15: non è ancora passata metà del periodo del prestito (scadenza`;

// lent two days ago for fifteen days: 2 of 15 days gone, an early renewal
const early = (card: string, code: string): [string, string, string, string] => [
	card,
	code,
	dayFromToday(-2),
	dayFromToday(13),
];

test.describe.serial("early renewal warning", () => {
	test("the checkout desk asks before an early renewal and keeps the scan field", async ({
		page,
	}) => {
		const t = tagOf(page);
		const teacher = await createPatron(page, `Anticipo${t}`, "teacher");
		const title = `Libro rinnovo anticipato ${t}`;
		const book = await createBook(page, title, 1);
		const [c1] = book.barcodes as [string];
		await importLoans(page, [early(teacher.card, c1)]);

		await page.goto(`/circulation/checkout?patron=${teacher.id}`);
		await waitForHydration(page);
		const row = page.getByTestId("desk-patron-loans").locator("li").first();
		const due = await row.getByTestId("status-badge").innerText();

		// the warning, with what happened; "Annulla" changes nothing and returns to the field
		await row.getByTestId("desk-renew").click();
		await expect(dialog(page)).toBeVisible();
		await expect(dialog(page)).toContainText("Rinnovo anticipato");
		await expect(dialog(page).getByTestId("desk-message")).toHaveAttribute(
			"data-code",
			"renewal_early",
		);
		await expect(dialog(page).getByTestId("desk-message-text")).toContainText(earlyText(title));
		// the focus starts on "Annulla": a stray Enter from the scanner cancels, never renews
		await expect(cancel(page)).toBeFocused();
		await expect(confirm(page)).toHaveText("Rinnova comunque");
		await cancel(page).click();
		await expect(dialog(page)).toHaveCount(0);
		await expect(deskField(page)).toBeFocused();
		await expect(row.getByTestId("status-badge")).toHaveText(due);
		await expect(page.getByTestId("desk-message")).toHaveCount(0);

		// the same copy scanned for the same patron: "Rinnova" leads to the same warning
		await deskScan(page, c1);
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute(
			"data-code",
			"item_on_loan_same_patron",
		);
		await page.getByTestId("action-renew").click();
		await expect(dialog(page)).toBeVisible();
		// the focus trap is up when "Annulla" has the focus: Escape closes like "Annulla"
		await expect(cancel(page)).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(dialog(page)).toHaveCount(0);
		await expect(row.getByTestId("status-badge")).toHaveText(due);

		// "Rinnova comunque" renews
		await row.getByTestId("desk-renew").click();
		await confirm(page).click();
		await expect(dialog(page)).toHaveCount(0);
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute(
			"data-code",
			"renewed",
		);
		await expect(row.getByTestId("status-badge")).not.toHaveText(due);
		await expect(deskField(page)).toBeFocused();
	});

	test("the patron page asks for one loan and, once, for all of them", async ({ page }) => {
		const t = tagOf(page);
		const student = await createPatron(page, `Anticipopag${t}`);
		const title = `Libro pagina anticipo ${t}`;
		const book = await createBook(page, title, 3);
		const [c1, c2, c3] = book.barcodes as [string, string, string];
		// two early loans and one past half of its period (10 of 15 days)
		await importLoans(page, [
			early(student.card, c1),
			early(student.card, c2),
			[student.card, c3, dayFromToday(-10), dayFromToday(5)],
		]);

		await page.goto(`/patrons/${student.id}`);
		await waitForHydration(page);
		const loans = page.getByTestId("open-loans");
		const rows = loans.locator("li");
		await expect(rows).toHaveCount(3);
		const dues = await rows.allInnerTexts();

		// one early loan (the open loans are in order of due date: the early ones come last)
		await rows.last().getByTestId("renew-loan").click();
		await expect(dialog(page)).toBeVisible();
		await expect(dialog(page).getByTestId("desk-message-text")).toContainText(
			"è in prestito da 2 giorni su 15",
		);
		await cancel(page).click();
		await expect(dialog(page)).toHaveCount(0);
		await expect(rows).toHaveText(dues);
		await expect(page.getByTestId("desk-message")).toHaveCount(0);

		// all the loans: one dialog listing the early ones, "Annulla" renews none
		await page.getByTestId("renew-all").click();
		await expect(dialog(page)).toBeVisible();
		await expect(page.getByTestId("early-renewal-line")).toHaveCount(2);
		await expect(page.getByTestId("early-renewal-line").first()).toContainText(
			`«${title}»: in prestito da 2 giorni su 15, scadenza`,
		);
		await cancel(page).click();
		await expect(dialog(page)).toHaveCount(0);
		await expect(rows).toHaveText(dues);
		await expect(page.getByTestId("desk-message")).toHaveCount(0);

		// "Rinnova comunque" renews every loan of the request, the early ones and the other
		await page.getByTestId("renew-all").click();
		await confirm(page).click();
		await expect(dialog(page)).toHaveCount(0);
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			"Rinnovati 3 prestiti su 3.",
		);
		await expect(rows).not.toHaveText(dues);

		// a loan renewed a moment ago renews again without a question: the due date would not move
		await rows.last().getByTestId("renew-loan").click();
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute(
			"data-code",
			"renewed",
		);
	});

	test("the check-in desk keeps the return when 'Rinnova invece' is cancelled", async ({
		page,
	}) => {
		const t = tagOf(page);
		const student = await createPatron(page, `Anticipoin${t}`);
		const title = `Libro rientro anticipo ${t}`;
		const book = await createBook(page, title, 1);
		const [c1] = book.barcodes as [string];
		await importLoans(page, [early(student.card, c1)]);

		await page.goto("/circulation/checkin");
		await waitForHydration(page);
		const field = page.getByRole("textbox", { name: CHECKIN });
		await field.fill(c1);
		await field.press("Enter");
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute(
			"data-code",
			"returned",
		);
		const row = page.getByTestId("checkin-row").first();

		await row.getByTestId("checkin-renew").click();
		await expect(dialog(page)).toBeVisible();
		await expect(dialog(page).getByTestId("desk-message-text")).toContainText(earlyText(title));
		await cancel(page).click();
		await expect(dialog(page)).toHaveCount(0);
		await expect(field).toBeFocused();
		// still returned, still offering "Rinnova invece"
		await expect(row.getByTestId("checkin-renew")).toBeVisible();
		await expect(row.getByTestId("status-badge")).not.toContainText("rinnovato fino al");

		await row.getByTestId("checkin-renew").click();
		await confirm(page).click();
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute(
			"data-code",
			"renewed_instead",
		);
		await expect(row.getByTestId("status-badge")).toContainText("rinnovato fino al");
	});

	test("the loans grid asks once for the selection", async ({ page }) => {
		const t = tagOf(page);
		const teacher = await createPatron(page, `Anticipogr${t}`, "teacher");
		const book = await createBook(page, `Libro griglia anticipo ${t}`, 2);
		const [c1, c2] = book.barcodes as [string, string];
		await importLoans(page, [early(teacher.card, c1), early(teacher.card, c2)]);

		await page.goto("/circulation/loans");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(`anticipogr${t}`.toLowerCase());
		const grid = page.getByTestId("data-grid");
		const rows = grid.locator(".wx-row");
		await expect(rows).toHaveCount(2);
		await rows.nth(0).click({ modifiers: ["Control"] });
		await rows.nth(1).click({ modifiers: ["Control"] });

		await page.getByTestId("renew-selected").click();
		await expect(dialog(page)).toBeVisible();
		await expect(page.getByTestId("early-renewal-line")).toHaveCount(2);
		await cancel(page).click();
		await expect(dialog(page)).toHaveCount(0);
		await expect(page.getByTestId("desk-message")).toHaveCount(0);

		await page.getByTestId("renew-selected").click();
		await confirm(page).click();
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			"Rinnovati 2 prestiti su 2.",
		);
	});
});
