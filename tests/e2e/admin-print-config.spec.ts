// SPDX-License-Identifier: GPL-3.0-or-later
// Printing in the Configurazione area (step 11.6): the adhesive stocks with their live drawing (a
// new sheet too wide for the page flagged, fixed, saved and removed again), the card template of
// each patron type, the templates and stocks offered as choices by the generated forms, and the
// template folders (a slip template duplicated, an image uploaded and removed, renamed, deleted).
// The configuration is shared: only the desktop project changes it, never what the other specs
// print, and it ends as it started.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

async function open(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await waitForHydration(page);
}

test.describe.serial("printing configuration", () => {
	test("label stocks: drawing, a new sheet checked, saved and removed", async ({
		page,
		isMobile,
	}) => {
		await open(page, "/admin/config/labels");
		const block = page.getByTestId("block-stocks");
		await expect(block.getByTestId("stock-drawing").locator("rect")).toHaveCount(19);
		await expect(page.getByTestId("setting-labels.pair.template")).toContainText(
			"pair-default",
		);
		await expect(page.getByTestId("setting-labels.pair.stock")).toContainText("70 × 48");
		await expectAxeClean(page);
		test.skip(isMobile, "the configuration is shared: one project changes it");

		await block.getByTestId("stock-add").click();
		await expect(block.getByTestId("stock-a4-70x48-2")).toHaveAttribute("aria-pressed", "true");
		await block.getByTestId("stock-id").fill("e2e-foglio");
		await block.getByTestId("stock-name").fill("Foglio di prova");
		await block.getByTestId("stock-columns").fill("4");
		await expect(block.getByTestId("stock-problems")).toContainText("280.0 mm");
		await expect(block.locator('[data-over="true"]')).not.toHaveCount(0);
		await expect(block.getByTestId("stocks-save")).toBeDisabled();
		await block.getByTestId("stock-label-width").fill("50");
		await expect(block.getByTestId("stock-problems")).toHaveCount(0);
		const save = async (): Promise<void> => {
			await Promise.all([
				page.waitForResponse((r) => r.url().includes("saveLabelStocks")),
				block.getByTestId("stocks-save").click(),
			]);
			await expect(block.getByTestId("stocks-save")).toBeDisabled();
		};
		await save();
		await expect(
			page.getByRole("status").getByText("Fogli di etichette salvati"),
		).toBeVisible();

		await open(page, "/admin/config/labels");
		const saved = block.getByTestId("stock-e2e-foglio");
		await saved.click();
		await expect(block.getByTestId("stock-columns")).toHaveValue("4");
		// the sheet it was copied from is still the one the jobs print on
		await expect(page.getByTestId("setting-labels.pair.stock")).toHaveValue("a4-70x48");
		await expect(block.getByTestId("stock-calibration")).toHaveAttribute(
			"href",
			/stock=e2e-foglio/,
		);
		await block.getByTestId("stock-remove").click();
		await expect(saved).toHaveCount(0);
		await save();
		await open(page, "/admin/config/labels");
		await expect(block.getByTestId("stock-e2e-foglio")).toHaveCount(0);
	});

	test("card template per patron type", async ({ page, isMobile }) => {
		await open(page, "/admin/config/cards");
		const block = page.getByTestId("block-cardTemplates");
		await expect(block.getByTestId("card-template-teacher")).toHaveValue("");
		// no coloured outline by default: the crop marks show where to cut (step 11.17)
		await expect(block.getByTestId("cut-lines")).not.toBeChecked();
		await block.getByTestId("cut-lines").check();
		await expect(block.getByTestId("cut-lines-color")).toBeVisible();
		await expect(page.getByTestId("section-dirty")).toHaveCount(0);
		await block.getByTestId("cut-lines").uncheck();
		await expect(block.getByTestId("card-templates-save")).toBeDisabled();
		await expectAxeClean(page);
		test.skip(isMobile, "the configuration is shared: one project changes it");

		// the same template the default gives: the printed cards stay the same
		await block.getByTestId("card-template-teacher").selectOption("default");
		await Promise.all([
			page.waitForResponse((r) => r.url().includes("saveCardTemplateSettings")),
			block.getByTestId("card-templates-save").click(),
		]);
		await expect(
			page.getByRole("status").getByText("Template delle tessere salvati"),
		).toBeVisible();
		await open(page, "/admin/config/cards");
		await expect(block.getByTestId("card-template-teacher")).toHaveValue("default");
		await block.getByTestId("card-template-teacher").selectOption("");
		await Promise.all([
			page.waitForResponse((r) => r.url().includes("saveCardTemplateSettings")),
			block.getByTestId("card-templates-save").click(),
		]);
		await open(page, "/admin/config/cards");
		await expect(block.getByTestId("card-template-teacher")).toHaveValue("");
	});

	test("template folders: duplicate, upload an image, rename, delete", async ({
		page,
		isMobile,
	}) => {
		await open(page, "/admin/config");
		await page.getByTestId("config-templates").click();
		await expect(page).toHaveURL(/\/admin\/config\/templates$/);
		await waitForHydration(page);
		const card = page.getByTestId("template-cards-default");
		await expect(card.getByTestId("template-used")).toContainText("Usato da");
		await expectAxeClean(page);
		test.skip(isMobile, "the configuration is shared: one project changes it");

		await page.getByTestId("templates-tab-slips").click();
		const source = page.getByTestId("template-slips-overdue-patron");
		await source.getByTestId("template-duplicate").click();
		const dialog = page.getByTestId("confirm-dialog");
		await dialog.getByTestId("template-name").fill("E2E");
		await expect(dialog.getByTestId("confirm-button")).toBeDisabled();
		await dialog.getByTestId("template-name").fill("e2e-copia");
		await dialog.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Template duplicato")).toBeVisible();

		const copy = page.getByTestId("template-slips-e2e-copia");
		await expect(copy.getByTestId("template-source")).toHaveText("Aggiunto");
		await copy.getByTestId("template-assets").click();
		await copy.getByTestId("asset-upload").click();
		await page.getByTestId("asset-input").setInputFiles("tests/fixtures/images/landscape.jpg");
		await expect(copy.getByTestId("asset-landscape.jpg")).toBeVisible();
		await copy.getByTestId("asset-landscape.jpg").getByTestId("asset-remove").click();
		await expect(copy.getByTestId("asset-landscape.jpg")).toHaveCount(0);

		await copy.getByTestId("template-rename").click();
		await dialog.getByTestId("template-name").fill("e2e-rinominato");
		await dialog.getByTestId("confirm-button").click();
		const renamed = page.getByTestId("template-slips-e2e-rinominato");
		await expect(renamed).toBeVisible();
		await expect(copy).toHaveCount(0);
		await renamed.getByTestId("template-delete").click();
		await dialog.getByTestId("confirm-button").click();
		await expect(renamed).toHaveCount(0);
	});
});
