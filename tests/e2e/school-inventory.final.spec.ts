// SPDX-License-Identifier: GPL-3.0-or-later
// The school inventory (step 9.64, Q155), run once after the other specs (project `final`): the
// switch is shared configuration. On, a new copy is proposed the next inventory number and has
// its origin and value; a withdrawal keeps its day and reason; the two lists for the office show
// them; the phone shows the same form. Off again, the fields and the column are gone.
import { expect, test, type Page } from "@playwright/test";
import { pageAction } from "./helpers/actions.js";
import { createBook } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";

async function setInventory(page: Page, on: boolean): Promise<void> {
	await page.goto("/admin/config/catalog");
	await waitForHydration(page);
	const box = page.getByTestId("setting-catalog.inventory.enabled");
	await box.setChecked(on);
	await page.getByTestId("section-save").click();
	await expect(page.getByRole("status").first()).toBeVisible();
	await page.reload();
	await waitForHydration(page);
	await expect(page.getByTestId("setting-catalog.inventory.enabled")).toBeChecked({
		checked: on,
	});
}

test.describe.serial("school inventory", () => {
	test("numbers, origin, value, the withdrawal and the two lists", async ({ page }) => {
		const tag = String(Date.now()).slice(-6);
		const book = await createBook(page, `Libro inventariato ${tag}`, 1);
		// off by default: no field, no column
		await expect(page.getByTestId(`item-inventory-${book.barcodes[0] ?? ""}`)).toHaveCount(0);

		await setInventory(page, true);
		await page.goto(book.url);
		await waitForHydration(page);
		await (await pageAction(page, "add-copies")).click();
		const number = page.getByTestId("add-inventory-number");
		// the next number is proposed
		await expect(number).toHaveValue(/^\d+$/);
		const proposed = await number.inputValue();
		await page.getByTestId("add-origin").selectOption("Dono");
		await page.getByTestId("add-value").fill("12,50");
		await page.getByTestId("confirm-button").click();
		const rows = page.getByTestId("items-table").locator("tbody tr");
		await expect(rows).toHaveCount(2);
		const added = (await rows.nth(1).locator("td").first().innerText()).trim();
		const cell = page.getByTestId(`item-inventory-${added}`);
		await expect(cell).toContainText(proposed);
		await expect(cell).toContainText("Dono");
		await expect(cell).toContainText("12,50");

		// a number already given is refused
		await page.getByTestId(`edit-item-${book.barcodes[0] ?? ""}`).click();
		await page.getByTestId("edit-inventory-number").fill(proposed);
		await page.getByTestId("confirm-button").click();
		await expect(page.getByTestId("item-issue")).toContainText("già usato");
		await page.getByRole("button", { name: "Annulla" }).click();

		// the withdrawal keeps its day and reason on the copy
		await page.getByTestId(`status-item-${added}`).click();
		await page.getByTestId("status-select").selectOption("withdrawn");
		await page.getByTestId("status-reason").fill("usurato");
		await page.getByTestId("confirm-button").click();
		await expect(page.getByTestId(`item-withdrawn-${added}`)).toContainText("usurato");

		// the two lists for the school office, over the current school year
		await page.goto("/reports/withdrawn-copies");
		await waitForHydration(page);
		await page.getByTestId("report-run").click();
		await expect(page.getByTestId("data-grid").getByText(added)).toBeVisible();
		await expect(page.getByTestId("data-grid").getByText("usurato")).toBeVisible();
		await page.goto("/reports/entered-copies");
		await waitForHydration(page);
		await page.getByTestId("report-run").click();
		await expect(page.getByTestId("data-grid").getByText(added)).toBeVisible();
	});

	test("the copy form on the phone", async ({ page }) => {
		await page.setViewportSize({ width: 412, height: 915 });
		const book = await createBook(page, `Libro al telefono ${String(Date.now()).slice(-6)}`, 1);
		await page.getByTestId(`edit-item-${book.barcodes[0] ?? ""}`).click();
		for (const id of ["edit-inventory-number", "edit-origin", "edit-value"]) {
			await expect(page.getByTestId(id)).toBeVisible();
		}
		// a copy created with the inventory on has its number
		await expect(page.getByTestId("edit-inventory-number")).toHaveValue(/^\d+$/);
		await page.getByRole("button", { name: "Annulla" }).click();
	});

	test("switched off, the fields and the column go", async ({ page }) => {
		await setInventory(page, false);
		const book = await createBook(
			page,
			`Libro senza inventario ${String(Date.now()).slice(-6)}`,
			1,
		);
		const code = book.barcodes[0] ?? "";
		await expect(page.getByTestId(`item-inventory-${code}`)).toHaveCount(0);
		await page.getByTestId(`edit-item-${code}`).click();
		await expect(page.getByTestId("edit-inventory-number")).toHaveCount(0);
		await page.getByRole("button", { name: "Annulla" }).click();
	});
});
