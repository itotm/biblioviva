// SPDX-License-Identifier: GPL-3.0-or-later
// Class upgrade (step 7.1, Phase 12.5), run on the seed data once every other spec is done
// (project `final`): the classes 2 E and 5 E made for the test, backup first, a repeater placed in
// the class of their year and a change of class, the leavers of the last year — the ones with books
// block the run until unticked, and a kept one needs a class —, the upgrade applied (2 E is now
// 3 E, the same class), the anonymized leaver gone from the patron search, and the extra
// confirmation asked for a second run within six months.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createBook, createPatron } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";
import { deskField, deskScan } from "./helpers/desk.js";

/**
 * Places every pupil still waiting for a class in the first class offered: other specs leave such
 * pupils behind (the pluriclasse of admin-classes.spec.ts).
 */
async function placeTheOthers(page: Page): Promise<void> {
	for (const select of await page.locator('select[data-testid^="group-"]').all()) {
		if ((await select.isVisible()) && (await select.inputValue()) === "") {
			await select.selectOption({ index: 1 });
		}
	}
	await expect(page.getByTestId("rollover-unplaced")).toHaveCount(0);
}

test("the administrator upgrades every class", async ({ page }) => {
	test.setTimeout(120_000);
	// the classes of the test: 2 E and 5 E
	await page.goto("/admin/classes");
	await waitForHydration(page);
	await page.getByTestId("classes-new").click();
	const dialog = page.getByTestId("class-dialog");
	await dialog.getByTestId("class-level-2").click();
	await dialog.getByTestId("class-level-5").click();
	await dialog.getByTestId("class-names").fill("E");
	await dialog.getByTestId("class-save").click();
	await expect(dialog).toBeHidden();
	const up = await createPatron(page, "Promosso", "student", ["2", "E"]);
	const again = await createPatron(page, "Ripetente", "student", ["2", "E"]);
	const moved = await createPatron(page, "Trasferito", "student", ["2", "E"]);
	const gone = await createPatron(page, "Diplomato", "student", ["5", "E"]);
	const lender = await createPatron(page, "Conlibro", "student", ["5", "E"]);
	const book = await createBook(page, "Libro della maturità", 1);
	await page.goto(`/circulation/checkout?patron=${lender.id}`);
	await waitForHydration(page);
	await deskScan(page, book.barcodes[0] ?? "");
	await expect(page.getByTestId("desk-message").first()).toHaveAttribute("data-code", "lent");

	await page.goto("/admin");
	await waitForHydration(page);
	await page.getByTestId("admin-section-rollover").click();
	await expect(page).toHaveURL(/\/admin\/rollover$/);
	await waitForHydration(page);

	// 1. the backup
	await expect(page.getByTestId("rollover-next")).toBeDisabled();
	await page.getByTestId("rollover-make-backup").click();
	await expect(page.getByTestId("rollover-backup")).toContainText("Backup creato: biblioviva-");
	await page.getByTestId("rollover-next").click();

	// 2. the classes: 2 E becomes 3 E; one repeats (no other E class of the second year: the
	// class is picked), one changes class
	const group = page.getByTestId("rollover-group-2E");
	await expect(group.locator("summary")).toContainText("2 E → 3 E");
	await group.locator("summary").click();
	await group.getByTestId(`repeat-${again.id}`).check();
	await expect(page.getByTestId("rollover-unplaced")).toBeVisible();
	await expect(page.getByTestId("rollover-next")).toBeDisabled();
	await group.getByTestId(`group-${again.id}`).selectOption({ label: "2 A" });
	await group.getByTestId(`group-${moved.id}`).selectOption({ label: "3 A" });
	await placeTheOthers(page);
	await expect(group.locator("summary")).toContainText("2 eccezioni");
	await expectAxeClean(page);
	await page.getByTestId("rollover-next").click();

	// 3. the leavers: whoever still has books blocks the run until unticked
	await expect(page.getByTestId("rollover-blocked")).toBeVisible();
	await expect(page.getByTestId("rollover-next")).toBeDisabled();
	for (const row of await page.locator('[data-testid^="rollover-leaver-"]').all()) {
		if ((await row.getByText(/libr[io] in prestito/).count()) > 0) {
			await row.getByRole("checkbox").uncheck();
		}
	}
	await expect(page.getByTestId(`leaves-${lender.id}`)).not.toBeChecked();
	await expect(page.getByTestId(`leaves-${gone.id}`)).toBeChecked();
	await expect(page.getByTestId("rollover-blocked")).toHaveCount(0);
	// kept in the last year with no other E class: the class is picked
	await expect(page.getByTestId("rollover-next")).toBeDisabled();
	await page.getByTestId(`group-${lender.id}`).selectOption({ label: "5 A" });
	await placeTheOthers(page);
	await page.getByTestId("rollover-next").click();

	// 4. the summary and the run
	await expect(page.getByTestId("rollover-summary")).toContainText(/lascia(no)? la scuola/);
	await page.getByTestId("rollover-run").click();
	await expect(page.getByTestId("rollover-done")).toBeVisible();
	await expect(page.getByTestId("rollover-import")).toHaveAttribute(
		"href",
		"/admin/imports/students",
	);

	// the results on the patron pages
	const classOf = async (id: number): Promise<string> => {
		await page.goto(`/patrons/${id}`);
		await waitForHydration(page);
		return (await page.getByTestId("class-badge").first().innerText()).trim();
	};
	expect(await classOf(up.id)).toBe("3 E");
	expect(await classOf(again.id)).toBe("2 A");
	expect(await classOf(moved.id)).toBe("3 A");
	expect(await classOf(lender.id)).toBe("5 A");
	await page.goto(`/patrons/${gone.id}`);
	await waitForHydration(page);
	await expect(page.getByTestId("status-badge")).toContainText("Rimosso");
	await page.goto("/circulation/checkout");
	await waitForHydration(page);
	await deskField(page).fill("diplomato");
	await expect(page.getByTestId("desk-scan-results")).toContainText("Nessun utente trovato.");

	// a second run within six months asks for an extra confirmation
	await page.goto("/admin/rollover");
	await waitForHydration(page);
	await page.getByTestId("rollover-make-backup").click();
	await page.getByTestId("rollover-next").click();
	await placeTheOthers(page);
	await page.getByTestId("rollover-next").click();
	for (const row of await page.locator('[data-testid^="rollover-leaver-"]').all()) {
		if ((await row.getByText(/libr[io] in prestito/).count()) > 0) {
			await row.getByRole("checkbox").uncheck();
		}
	}
	await placeTheOthers(page);
	await page.getByTestId("rollover-next").click();
	await expect(page.getByTestId("rollover-run")).toBeDisabled();
	await page.getByTestId("rollover-recent").check();
	await expect(page.getByTestId("rollover-run")).toBeEnabled();
});
