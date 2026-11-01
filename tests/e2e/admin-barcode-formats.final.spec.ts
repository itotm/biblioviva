// SPDX-License-Identifier: GPL-3.0-or-later
// Formats of copy barcodes and card numbers (step 12.2), run once every other spec is done
// (project `final`) because it changes the formats of the shared configuration: a pair of formats
// that copies and cards would share is refused with an example; the "letter in front" pair is
// saved; a new copy gets the new format while a copy and a card made before still work at the desk
// (their format is now among the previous ones); the try box tells a code's kind; the standard
// formats are put back at the end.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createBook, createPatron } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";
import { deskScan } from "./helpers/desk.js";

async function openFormats(page: Page): Promise<void> {
	await page.goto("/admin/config/barcodes");
	await waitForHydration(page);
	await expect(page.getByTestId("block-barcode-formats")).toBeVisible();
	await expect(page.getByTestId("format-verdict-ok")).toBeVisible();
}

async function scan(page: Page, code: string): Promise<void> {
	await deskScan(page, code);
}

test.describe.serial("barcode formats", () => {
	test("refused when confusable, saved, used for new copies while old codes keep working", async ({
		page,
	}) => {
		// made with the standard formats, before the change
		const teacher = await createPatron(page, "Formati", "teacher");
		const before = await createBook(page, "Libro prima del cambio", 1);
		const [oldCopy] = before.barcodes as [string];
		expect(teacher.card).toMatch(/^[A-Z]\d{6}$/);

		await openFormats(page);
		const block = page.getByTestId("block-barcode-formats");
		await expect(block).toContainText("Copie e tessere non si possono confondere.");
		await expectAxeClean(page);

		// cards with the copies' own format: refused, with a code both would accept
		await block.getByTestId("format-advanced").locator("summary").click();
		await block.getByTestId("format-patron-pattern").fill("YYYY-CNNNN");
		await expect(block.getByTestId("format-verdict-error")).toContainText(
			/possono dare lo stesso codice, per esempio \d{4}-[A-Z]\d{4}/,
		);
		await expect(block.getByTestId("format-save")).toBeDisabled();

		// the pair with a letter in front
		await block.getByTestId("format-preset-prefix").click();
		await expect(block.getByTestId("format-verdict-ok")).toBeVisible();
		await expect(block.getByTestId("format-item-examples")).toContainText(/L-\d{6}[A-Z]/);
		await expect(block.getByTestId("format-patron-examples")).toContainText(/T\d{6}[A-Z]/);
		await block.getByTestId("format-save").click();
		await expect(
			page.getByRole("status").getByText("Formati dei codici salvati"),
		).toBeVisible();
		// the standard formats are now among the formats of the past, with their codes
		await expect(block.getByTestId("format-item-retired-0")).toContainText("YYYY-CNNNN");
		await expect(block.getByTestId("format-item-retired-0-remove")).toBeDisabled();

		// the try box reads the old card as a card
		await block.getByTestId("format-try").fill(teacher.card);
		await expect(block.getByTestId("format-try-result")).toContainText("numero di tessera");

		// a new copy gets the new format
		const after = await createBook(page, "Libro dopo il cambio", 1);
		const [newCopy] = after.barcodes as [string];
		expect(newCopy).toMatch(/^L-\d{6}[A-Z]$/);

		// the old card and both copies at the desk
		await page.goto("/circulation/checkout");
		await waitForHydration(page);
		await scan(page, teacher.card);
		await expect(page.getByTestId("desk-patron-name")).toHaveText("Formati");
		await scan(page, oldCopy);
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute("data-code", "lent");
		await scan(page, newCopy);
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute("data-code", "lent");
		await page.getByTestId("desk-finish").click();

		// the standard formats back
		await openFormats(page);
		const again = page.getByTestId("block-barcode-formats");
		await again.getByTestId("format-preset-standard").click();
		await expect(again.getByTestId("format-verdict-ok")).toBeVisible();
		await again.getByTestId("format-save").click();
		await expect(
			page.getByRole("status").getByText("Formati dei codici salvati"),
		).toBeVisible();
		await expect(again.getByTestId("format-item-retired-0")).toContainText("'L'-YYNNNNC");
	});
});
