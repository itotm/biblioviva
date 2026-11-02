// SPDX-License-Identifier: GPL-3.0-or-later
// Library codes and barcodes (step 11.4; the sections became classes in Phase 12): an item type
// added, renamed and removed; the next card number
// and copy barcode previewed with a chosen counter start and barcode type, nothing saved. The
// configuration is shared: only the desktop project changes it, and it ends as it started.
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

test.describe.serial("library codes and barcodes", () => {
	test("item types: add, rename, remove", async ({ page, isMobile }) => {
		test.skip(isMobile, "the configuration is shared: one project changes it");
		await page.goto("/admin/config/library");
		await waitForHydration(page);
		await expect(page.getByTestId("block-itemTypes")).toBeVisible();
		await expectAxeClean(page);

		// an item type: added, renamed, removed (the page opened again after each save, so every
		// step starts from what the server has)
		const types = page.getByTestId("block-itemTypes");
		const reopen = async (): Promise<void> => {
			await page.goto("/admin/config/library");
			await waitForHydration(page);
			await expect(types.getByTestId("code-row")).not.toHaveCount(0);
		};
		const save = async (): Promise<void> => {
			await Promise.all([
				page.waitForResponse((r) => r.url().includes("saveItemTypesChange")),
				types.getByTestId("block-itemTypes-save").click(),
			]);
			// the list restarts from what was saved: nothing left to save
			await expect(types.getByTestId("block-itemTypes-save")).toBeDisabled();
		};
		await types.getByTestId("block-itemTypes-add").click();
		await types.getByTestId("code-input").last().fill("cd");
		await types.getByTestId("label-input").last().fill("Compact disc");
		await save();
		await expect(page.getByRole("status").getByText("Materiali salvati")).toBeVisible();
		await reopen();
		const cd = types.locator('[data-testid="code-row"][data-code="cd"]');
		// the books of the type: the type is the record's (9.45)
		await expect(cd.getByTestId("code-usage")).toHaveText("0 libri");
		await cd.getByTestId("code-input").fill("audio");
		await save();
		await reopen();
		const audio = types.locator('[data-testid="code-row"][data-code="audio"]');
		await expect(audio).toHaveCount(1);
		await expect(types.locator('[data-testid="code-row"][data-code="cd"]')).toHaveCount(0);
		await audio.getByTestId("code-remove").click();
		await save();
		await reopen();
		await expect(types.locator('[data-testid="code-row"][data-code="audio"]')).toHaveCount(0);
	});

	test("barcodes: the next card and copy with a chosen counter and barcode type", async ({
		page,
	}) => {
		await page.goto("/admin/config/barcodes");
		await waitForHydration(page);
		const block = page.getByTestId("block-barcodes");
		await expect(block.getByTestId("preview-card")).toContainText("Prossima tessera:");
		await expect(block.getByTestId("preview-item")).toContainText(
			/Prossima copia: \d{4}-[A-Z]\d{4}/,
		);
		// above every card that exists; a lower number changes nothing
		await block.getByTestId("counter-from-number").fill("500000");
		await expect(block.getByTestId("preview-card")).toContainText(
			/Prossima tessera: [A-Z]500000/,
		);
		// the card format holds six digits: a larger start is refused
		await block.getByTestId("counter-from-number").fill("5000000");
		await expect(block.getByTestId("counter-save")).toBeDisabled();
		await block.getByTestId("counter-from-number").fill("500000");
		await expect(block.getByTestId("counter-save")).toBeEnabled();
		await page.getByTestId("setting-barcodes.item.symbology").selectOption("code39");
		await expect(block.getByTestId("preview-item").locator("img")).toHaveAttribute(
			"src",
			/symbology=code39/,
		);
		await expectAxeClean(page);
		// back as it was: nothing to save
		await page.getByTestId("setting-barcodes.item.symbology").selectOption("code128");
		await block.getByTestId("counter-after-legacy").check();
		await expect(block.getByTestId("counter-save")).toBeDisabled();
		await expect(page.getByTestId("section-dirty")).toHaveCount(0);
	});
});
