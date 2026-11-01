// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { beeps, countBeeps } from "./helpers/beeps.js";
import { waitForHydration } from "./helpers/hydration.js";

test.describe("style guide /dev/ui", () => {
	test("renders the Skeleton components and is axe clean", async ({ page }) => {
		await page.goto("/dev/ui");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1, name: "BiblioViva UI" })).toBeVisible();

		// Wait for hydration (the grid renders its virtual window client-side).
		await expect
			.poll(() => page.getByTestId("data-grid").locator(".wx-row").count())
			.toBeGreaterThan(5);
		await expectAxeClean(page);
	});

	test("dialog opens and closes with the keyboard", async ({ page }) => {
		await page.goto("/dev/ui");
		await waitForHydration(page);
		await page.getByRole("button", { name: "Apri dialogo" }).focus();
		await page.keyboard.press("Enter");
		await expect(page.getByRole("dialog")).toBeVisible();
		// Wait for the focus trap before sending Escape to the dialog.
		await expect(
			page.getByRole("dialog").getByRole("button", { name: "Chiudi" }),
		).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("dialog")).toBeHidden();
	});

	test("tabs switch with arrow keys and the toast appears", async ({ page }) => {
		await page.goto("/dev/ui");
		await waitForHydration(page);
		await page.getByRole("tab", { name: "Prestiti" }).focus();
		await page.keyboard.press("ArrowRight");
		await expect(page.getByRole("tab", { name: "Storico" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		await page.getByRole("button", { name: "Mostra toast" }).click();
		const toast = page.locator('[data-scope="toast"][data-part="root"]').filter({
			hasText: "Prestito registrato",
		});
		await expect(toast).toBeVisible();
		await expect(toast).toHaveAttribute("data-type", "success");
		// step 3.8b: bottom right on desktop, top on phones (the bottom holds the navigation bar)
		const box = (await toast.boundingBox())!;
		const viewport = page.viewportSize()!;
		if (viewport.width >= 768) {
			expect(box.y + box.height).toBeGreaterThan(viewport.height - 120);
			expect(box.x + box.width).toBeGreaterThan(viewport.width - 60);
		} else {
			expect(box.y).toBeLessThan(80);
		}
		// errors stay until closed; the others go away by themselves
		await page.getByTestId("toast-kinds").click();
		const error = page.locator('[data-scope="toast"][data-type="error"]');
		await expect(error).toBeVisible();
		await expect(page.locator('[data-scope="toast"][data-type="warning"]')).toBeVisible();
		await expect(error).toContainText("Resta finché non la chiudi.");
		await error.getByRole("button", { name: "Chiudi" }).click();
		await expect(error).toBeHidden();
	});

	test("combobox filters patrons", async ({ page }) => {
		await page.goto("/dev/ui");
		await waitForHydration(page);
		const input = page.getByRole("combobox", { name: "Utente" });
		await input.fill("ver");
		await expect(page.getByRole("option", { name: /Verdi/ })).toBeVisible();
		await expect(page.getByRole("option", { name: /Rossi/ })).toHaveCount(0);
	});
});

test.describe("DataGrid wrapper", () => {
	test("virtualises 10 000 rows, sorts and selects", async ({ page }) => {
		await page.goto("/dev/ui");
		await waitForHydration(page);
		const grid = page.getByTestId("data-grid");
		await expect(grid.getByText("Rossi 1", { exact: true })).toBeVisible();
		// Only the visible window of rows is rendered (after hydration).
		await expect.poll(() => grid.locator(".wx-row").count()).toBeGreaterThan(5);
		expect(await grid.locator(".wx-row").count()).toBeLessThan(200);
		// Sort by class: the first class label becomes "1 A".
		await grid.getByText("Classe", { exact: true }).click();
		await expect(grid.locator(".wx-row").first()).toContainText("1 A");
		// Click selects and reports the row.
		await grid.locator(".wx-row").first().click();
		await expect(page.getByTestId("grid-clicked")).toContainText("Selezionato:");
	});

	test("is usable at the mobile viewport", async ({ page }) => {
		await page.goto("/dev/ui");
		await waitForHydration(page);
		const grid = page.getByTestId("data-grid");
		await expect(grid.getByText("Rossi 1", { exact: true })).toBeVisible();
		const noHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
		);
		expect(noHorizontalOverflow).toBe(true);
	});

	test("BarcodeInput recognises typed codes and ConfirmDialog confirms", async ({ page }) => {
		await page.goto("/dev/ui");
		await waitForHydration(page);
		const input = page.getByRole("textbox", { name: "Codice a barre" });
		// a copy of the configured format (2026-E0267) typed with the Italian layout's ' for -
		await input.fill("2026'E0267");
		await input.press("Enter");
		await expect(page.getByTestId("scan-result")).toHaveText(/item: 2026-E0267/);
		await input.fill("2026-A0267");
		await input.press("Enter");
		await expect(page.getByTestId("barcode-error")).toContainText("carattere di controllo");
		await expect(page.getByTestId("form-errors")).toContainText("Cognome: Campo obbligatorio");

		await page.getByRole("button", { name: "Elimina copia…" }).click();
		const dialog = page.getByRole("alertdialog");
		await expect(dialog).toBeVisible();
		// axe blends colours during the fade-in: wait for the transition to end
		await expect(dialog).toHaveCSS("opacity", "1");
		await expectAxeClean(page);
		await dialog.getByTestId("confirm-button").click();
		await expect(dialog).toBeHidden();
		await expect(page.getByTestId("confirm-count")).toHaveText("Confermate: 1");
	});

	test("the camera scanner loads lazily, starts the camera and beeps once", async ({ page }) => {
		// count the sounds started (9.40): the read is taken with one beep
		await countBeeps(page);
		const scannerRequests: string[] = [];
		page.on("request", (r) => {
			if (/zxing|barcode-detector|\.wasm/.test(r.url())) {
				scannerRequests.push(r.url());
			}
		});
		await page.goto("/dev/ui");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1, name: "BiblioViva UI" })).toBeVisible();
		expect(scannerRequests).toHaveLength(0);
		await page.getByRole("button", { name: "Fotocamera", exact: true }).click();
		await expect(page.getByTestId("scanner-overlay")).toBeVisible();
		await expect.poll(() => scannerRequests.length).toBeGreaterThan(0);
		// the fake feed shows barcodes: the first decoded one closes the overlay and fills the input
		await expect(page.getByTestId("scan-result")).toContainText(/isbn|card|legacy_item/, {
			timeout: 20_000,
		});
		await expect.poll(() => beeps(page)).toBe(1);
	});

	test("the fake camera feed is decoded: EAN-13, Code 128 and Code 39 (step 3.3)", async ({
		page,
	}) => {
		await page.goto("/dev/ui");
		await waitForHydration(page);
		await page.getByTestId("toggle-scanner").click();
		await expect(page.getByTestId("scanner-overlay")).toBeVisible();
		const log = page.getByTestId("scan-log");
		await expect(log).toContainText("isbn: 9788804668237", { timeout: 20_000 });
		await expect(log).toContainText("card: 0000001240", { timeout: 20_000 });
		await expect(log).toContainText("legacy_item: 2026-0042", { timeout: 20_000 });
	});
});
