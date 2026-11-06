// SPDX-License-Identifier: GPL-3.0-or-later
// Classification editor (steps 11.1, 12.6): a new genre with its colour and pictogram, previewed on
// the spine band and saved; the catalogue offers it; removing it while a book uses it asks where
// the book goes, and the book, its call number and its spine band follow. A reading level added to
// the scale, a book filed with it and its pair label; the level removed while the book uses it asks
// where the book goes. The taxonomy is shared configuration: only the desktop project changes it,
// it ends as it started, and every test that saves it lives in this serial block — a save sends the
// whole classification, so two files saving at the same time would undo each other's codes.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createBook } from "./helpers/data.js";
import { pageAction } from "./helpers/actions.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

async function openOptions(page: Page): Promise<void> {
	await page.goto("/admin/config/classification");
	await waitForHydration(page);
	await page.getByTestId("taxonomy-tab-options").click();
	await expect(page.getByTestId("reading-levels")).toBeVisible();
}

async function save(page: Page): Promise<ReturnType<Page["getByTestId"]>> {
	await page.getByTestId("taxonomy-save").click();
	const dialog = page.getByTestId("taxonomy-save-dialog");
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe.serial("classification editor", () => {
	test("adds a genre, files a book under it, removes it moving the book", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "the taxonomy is shared configuration: one project changes it");
		const tag = Date.now().toString(36).slice(-5).toUpperCase();
		const code = `Z${tag}`;
		const book = await createBook(page, `Tassonomia ${tag}`, 1);
		const barcode = book.barcodes[0] ?? "";

		await page.goto("/admin");
		await waitForHydration(page);
		await page.getByTestId("admin-section-config").click();
		await expect(page).toHaveURL(/\/admin\/config$/);
		await page.getByTestId("config-section-classification").click();
		await expect(page).toHaveURL(/\/admin\/config\/classification$/);
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Classificazione");
		await expect(page.getByTestId("taxonomy-file")).toContainText("classification.json");
		await expect(page.getByTestId("taxonomy-list-fiction")).toBeVisible();
		await expectAxeClean(page);

		// a new genre: code, name, colour and pictogram, the spine band follows the draft
		await page.getByTestId("taxonomy-add-fiction").click();
		await expect(page.getByTestId("taxonomy-save")).toBeDisabled();
		await expect(page.getByTestId("field-error-code")).toHaveText("Il codice è obbligatorio.");
		await page.getByTestId("taxonomy-code").fill("A");
		await expect(page.getByTestId("field-error-code")).toHaveText(
			"Questo codice è già usato da un altro genere o argomento.",
		);
		await page.getByTestId("taxonomy-code").fill(code);
		await page.getByTestId("taxonomy-label").fill(`Genere di prova ${tag}`);
		await page.getByTestId("taxonomy-color-none").uncheck();
		await page.getByTestId("taxonomy-color-text").fill("#00aa55");
		await page
			.getByTestId("pictogram-file")
			.setInputFiles("tests/fixtures/images/landscape.jpg");
		await expect(
			page.getByTestId("taxonomy-panel").getByTestId("pictogram-image"),
		).toBeVisible();
		await expect(page.getByTestId("band-preview-frame")).toHaveAttribute(
			"srcdoc",
			new RegExp(`${code} 4`),
		);
		await expect(page.getByTestId("taxonomy-dirty")).toBeVisible();
		await expectAxeClean(page);
		await page.getByTestId("taxonomy-save").click();
		const dialog = page.getByTestId("taxonomy-save-dialog");
		await expect(dialog.getByTestId("taxonomy-save-confirm")).toBeEnabled();
		await dialog.getByTestId("taxonomy-save-confirm").click();
		await expect(page.getByRole("status").getByText("Classificazione salvata")).toBeVisible();
		await expect(page.getByTestId("taxonomy-dirty")).toHaveCount(0);

		// the catalogue offers the genre with its pictogram: file the book under it; its call
		// number is computed with the code (Q143)
		await page.goto(`${book.url}/edit`);
		await waitForHydration(page);
		const tile = page.getByTestId(`genre-${code}`);
		// versioned by the image file, so the new pictogram shows at once
		await expect(tile.locator("img")).toHaveAttribute(
			"src",
			new RegExp(`^/media/classification/${code}\\?v=${code}-\\d{8}-\\d{6}\\.png$`),
		);
		await tile.click();
		await page.getByTestId("biblio-submit").click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(page.getByTestId(`item-row-${barcode}`)).toContainText(`${code} PRO`);

		// removing a genre in use asks where its books go
		await page.goto("/admin/config/classification");
		await waitForHydration(page);
		const row = page.locator(`[data-testid="taxonomy-node"][data-code="${code}"]`);
		await expect(row.getByTestId("taxonomy-node-usage")).toHaveText("1 libro");
		await row.getByTestId("taxonomy-node-open").click();
		await expect(page.getByTestId("taxonomy-usage")).toHaveText("Usato da 1 libro (1 copia).");
		await page.getByTestId("taxonomy-remove").click();
		await page.getByTestId("confirm-button").click();
		await expect(row).toHaveCount(0);
		await page.getByTestId("taxonomy-save").click();
		await expect(dialog.getByTestId("taxonomy-save-removed")).toBeVisible();
		await expect(dialog.getByTestId("taxonomy-save-confirm")).toBeDisabled();
		await dialog.getByTestId(`replacement-${code}`).selectOption("B");
		await expect(dialog.getByTestId("taxonomy-save-call-numbers")).toContainText(
			"1 copia cambia segnatura",
		);
		await dialog.getByTestId("taxonomy-save-confirm").click();
		await expect(page.getByRole("status").getByText("Classificazione salvata")).toBeVisible();

		// the book is back in B with its call number computed again
		await page.goto(book.url);
		await waitForHydration(page);
		await expect(page.getByTestId("classification-badge")).toContainText("B");
		await expect(page.getByTestId(`item-row-${barcode}`)).toContainText("B PRO");
		await page.goto("/admin/audit");
		await waitForHydration(page);
		await page.getByLabel("Operazione").selectOption("config.classification");
		await expect(
			page.getByTestId("data-grid").getByText("config.classification").first(),
		).toBeVisible();
	});

	test("edits in a panel (a dialog on phones), asks before leaving unsaved changes", async ({
		page,
		isMobile,
	}) => {
		await page.goto("/admin/config/classification");
		await waitForHydration(page);
		await page
			.locator('[data-testid="taxonomy-node"][data-code="A"]')
			.getByTestId("taxonomy-node-open")
			.click();
		if (isMobile) {
			await expect(page.getByTestId("taxonomy-panel-dialog")).toBeVisible();
		}
		const panel = page.getByTestId("taxonomy-panel");
		await expect(panel.getByTestId("taxonomy-code")).toHaveValue("A");
		await expect(panel.getByTestId("band-preview-frame")).toBeVisible();
		await panel.getByTestId("taxonomy-label").fill("Romanzi e racconti (bozza)");
		if (isMobile) {
			await page
				.getByTestId("taxonomy-panel-dialog")
				.getByRole("button", { name: "Chiudi" })
				.click();
			await expect(page.getByTestId("taxonomy-panel-dialog")).toHaveCount(0);
		}
		await expect(page.getByTestId("taxonomy-dirty")).toBeVisible();

		// the Dewey tester and the call number examples work on the draft
		await page.getByTestId("taxonomy-tab-dewey").click();
		await page.getByTestId("dewey-probe").fill("004.6");
		await expect(page.getByTestId("dewey-probe-result")).toContainText("004");
		await page.getByTestId("taxonomy-tab-options").click();
		await expect(page.getByTestId("option-call-number-examples")).toHaveText(
			"Esempi: A 4 DEL · A DEL · 000 ROS",
		);

		// leaving asks first; staying keeps the draft, "Annulla modifiche" drops it
		await page.getByTestId("page-back").click();
		await expect(page.getByTestId("confirm-dialog")).toContainText("Uscire senza salvare?");
		await page.getByTestId("confirm-dialog").getByRole("button", { name: "Annulla" }).click();
		await expect(page).toHaveURL(/\/admin\/config\/classification$/);
		await page.getByTestId("taxonomy-discard").click();
		await expect(page.getByTestId("taxonomy-dirty")).toHaveCount(0);
		await page.getByTestId("page-back").click();
		await expect(page).toHaveURL(/\/admin\/config$/);
	});

	test("reading levels: added, used by a book and its label, removed moving the book", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "the scale is shared configuration: one project changes it");
		const tag = Date.now().toString(36).slice(-5);
		const title = `Livello ${tag}`;

		// a sixth level
		await openOptions(page);
		await page.getByTestId("reading-level-add").click();
		await page.getByTestId("reading-level-code").last().fill("6");
		await page.getByTestId("reading-level-label").last().fill("6ª");
		await expectAxeClean(page);
		let dialog = await save(page);
		await dialog.getByTestId("taxonomy-save-confirm").click();
		await expect(dialog).toBeHidden();

		// a book filed with it, then its copy
		await page.goto("/catalog/new");
		await waitForHydration(page);
		await page.getByLabel("Titolo", { exact: true }).fill(title);
		await page.getByLabel("Autore", { exact: true }).fill("Livelli, Anna");
		await page.getByTestId("quick-publisher").click();
		await page.getByTestId("genre-B").click();
		await page.getByTestId("reading-level-6").click();
		await page.getByTestId("biblio-submit").click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(page.getByTestId("classification-badge")).toContainText("6");
		const bookUrl = page.url();
		await (await pageAction(page, "add-copies")).click();
		await expect(page.getByTestId("add-call-number")).toContainText("B 6 LIV");
		await page.getByTestId("confirm-button").click();
		await expect(page.getByTestId("items-table").locator("tbody tr")).toHaveCount(1);
		await expect(page.getByTestId("items-table")).toContainText("B 6 LIV");

		// the pair label carries the level in the call number
		await (await pageAction(page, "print-labels")).click();
		const href = await page.getByTestId("label-print").getAttribute("href");
		expect(href).toContain("/print/labels/pair");
		const sheet = await (await page.request.get(`${href ?? ""}&preview=1`)).text();
		expect(sheet).toContain('<div class="head">B 6</div>');

		// removed while in use: the book goes to level 5, its call number follows
		await openOptions(page);
		await page.getByTestId("reading-level-remove").last().click();
		dialog = await save(page);
		await expect(dialog.getByTestId("taxonomy-save-levels")).toBeVisible();
		await expect(dialog.getByTestId("taxonomy-save-confirm")).toBeDisabled();
		await dialog.getByTestId("level-replacement-6").selectOption("5");
		await dialog.getByTestId("taxonomy-save-confirm").click();
		await expect(dialog).toBeHidden();
		await page.goto(bookUrl);
		await waitForHydration(page);
		await expect(page.getByTestId("classification-badge")).toContainText("5");
		await expect(page.getByTestId("items-table")).toContainText("B 5 LIV");
	});

	test("is for administrators only", async ({ page }) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("prestiti", "prestiti-test-pw");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		await page.goto("/admin/config/classification");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			/non è disponibile per l'account in uso/,
		);
		expect((await page.request.get("/media/classification/file/A.png")).status()).toBe(403);
	});
});
