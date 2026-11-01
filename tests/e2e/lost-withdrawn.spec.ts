// SPDX-License-Identifier: GPL-3.0-or-later
// Lost, damaged and withdrawn copies (step 4.8): a lost book closes its loan and shows on the
// patron page until it comes back at the returns desk; a withdrawn copy leaves the catalogue
// results and is never lent, not even by an administrator.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createBook, createPatron } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";
import { deskScan } from "./helpers/desk.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

async function scan(page: Page, name: string, code: string): Promise<void> {
	const field = page.getByRole("textbox", { name });
	await field.fill(code);
	await field.press("Enter");
}

test.describe.serial("lost and withdrawn copies", () => {
	test("a lost book, found again; a withdrawn book, never lent", async ({ page }) => {
		const t = tagOf(page);
		const teacher = await createPatron(page, `Smarrimento${t}`, "teacher");
		const title = `Libro perduto ${t}`;
		const book = await createBook(page, title, 2);
		const [c1, c2] = book.barcodes as [string, string];

		await page.goto(`/circulation/checkout?patron=${teacher.id}`);
		await waitForHydration(page);
		await deskScan(page, c1);
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute("data-code", "lent");

		// marked lost from the patron page: the loan closes, the book is listed as lost
		await page.goto(`/patrons/${teacher.id}`);
		await waitForHydration(page);
		await page.getByTestId("mark-lost").click();
		await page.getByTestId("lost-reason").fill("perso in gita");
		await page.getByTestId("confirm-button").click();
		await expect(
			page.getByRole("status").getByText(`«${title}» segnato come smarrito.`),
		).toBeVisible();
		await expect(page.getByTestId("open-loans")).toHaveCount(0);
		await expect(page.getByTestId("lost-items")).toContainText(title);
		await expectAxeClean(page);
		await page.getByRole("tab", { name: "Storico" }).click();
		await expect(page.getByTestId("data-grid").getByText("Smarrito")).toBeVisible();

		// it turns up: scanned at the returns desk it is available again
		await page.goto("/circulation/checkin");
		await waitForHydration(page);
		await scan(page, "Passa il codice del libro restituito", c1);
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute(
			"data-code",
			"was_lost_now_found",
		);
		await page.goto(`/patrons/${teacher.id}`);
		await waitForHydration(page);
		await expect(page.getByTestId("lost-items")).toHaveCount(0);

		// withdrawn: the record leaves the catalogue results while every copy is withdrawn
		await page.goto(book.url);
		await waitForHydration(page);
		for (const code of [c1, c2]) {
			await page.getByTestId(`status-item-${code}`).click();
			await page.getByTestId("status-select").selectOption("withdrawn");
			await page.getByTestId("confirm-button").click();
			await expect(
				page.getByRole("status").getByText("Stato aggiornato").first(),
			).toBeVisible();
		}
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(title);
		// the withdrawn book is left out (similar titles may follow, 9.24, never this one)
		await expect(page.getByTestId("biblio-count")).toContainText("0 titoli");
		await expect(page.getByTestId("data-grid").getByText(title, { exact: true })).toHaveCount(
			0,
		);
		await page.getByTestId("show-withdrawn").check();
		await expect(page.getByTestId("data-grid").getByText(title)).toBeVisible();

		// never lent, not even by an administrator
		await page.goto(`/circulation/checkout?patron=${teacher.id}`);
		await waitForHydration(page);
		await deskScan(page, c2);
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			`«${title}» risulta ritirato e non può essere prestato. Se il libro è tornato disponibile, aggiornarne lo stato dalla scheda.`,
		);
		await expect(page.getByTestId("action-override")).toHaveCount(0);
	});

	test("a refused change of a copy leaves its buttons working", async ({ page }) => {
		// the dialog closed on the refusal and never opened again (architecture review)
		const t = tagOf(page);
		const reader = await createPatron(page, `Storico${t}`, "teacher");
		const book = await createBook(page, `Libro con storico ${t}`, 1);
		const code = book.barcodes[0] ?? "";
		await page.goto(`/circulation/checkout?patron=${reader.id}`);
		await waitForHydration(page);
		await deskScan(page, code);
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute("data-code", "lent");
		await page.goto(`/catalog/${book.id}`);
		await waitForHydration(page);
		// on loan: no withdrawal; the dialog can be opened again
		await page.getByTestId(`status-item-${code}`).click();
		await page.getByTestId("status-select").selectOption("withdrawn");
		await page.getByTestId("confirm-button").click();
		await expect(page.getByText(/La copia è in prestito/)).toBeVisible();
		await page.getByRole("button", { name: "Annulla" }).click();
		await page.getByTestId(`status-item-${code}`).click();
		await expect(page.getByTestId("status-dialog")).toBeVisible();
		await page.getByRole("button", { name: "Annulla" }).click();
		// back, with a loan in its history: no deletion; the dialog can be opened again
		await page.goto("/circulation/checkin");
		await waitForHydration(page);
		await scan(page, "Passa il codice del libro restituito", code);
		await page.goto(`/catalog/${book.id}`);
		await waitForHydration(page);
		await page.getByTestId(`delete-item-${code}`).click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByText(/ha prestiti registrati/)).toBeVisible();
		await page.getByTestId(`delete-item-${code}`).click();
		await expect(page.getByTestId("confirm-button")).toBeVisible();
	});
});
