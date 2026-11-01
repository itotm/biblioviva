// SPDX-License-Identifier: GPL-3.0-or-later
// The report editor (step 9.20, Q116): a new guided report — loans of the period by class year and
// section, with the totals (the owner's example) — previewed, saved, run, printed and exported; a
// built-in customised and restored; a report duplicated and turned into SQL, whose broken SQL or
// JSON is refused before it is saved. The configuration is
// shared: only the desktop project changes it, and it ends as it started.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

async function remove(page: Page, id: string): Promise<void> {
	await page.goto("/admin/config/reports");
	await waitForHydration(page);
	await page.getByTestId(`report-${id}`).getByTestId("report-remove").click();
	await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
}

test.describe.serial("report editor", () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, "the configuration is shared: one project changes it");
	});

	test("a guided pivot table: class year × section with the totals", async ({ page }) => {
		await page.goto("/admin/config/reports");
		await waitForHydration(page);
		await page.getByTestId("report-new").click();
		await expect(page).toHaveURL(/\/admin\/config\/reports\/new$/);
		await waitForHydration(page);
		await page.getByTestId("editor-id").fill("e2e-pivot");
		await page.getByTestId("editor-title-it").fill("Prestiti per anno e sezione");
		await page.getByTestId("editor-title-en").fill("Loans by year and section");
		await page.getByTestId("editor-source").selectOption("loans");
		await page.getByTestId("editor-row-0").selectOption("classYear");
		await page.getByTestId("editor-columns").selectOption("section");
		await page.getByTestId("editor-totals").selectOption("both");
		await page.getByTestId("editor-filter-mode-period").selectOption("ask");
		await page.getByTestId("editor-chart").selectOption("bar");
		await page.getByTestId("editor-run-preview").click();
		const preview = page.getByTestId("editor-preview");
		await expect(preview.getByTestId("data-grid")).toContainText("Totale");
		await expect(preview.getByTestId("data-grid")).toContainText("Docenti");
		await expect(preview.getByTestId("report-chart")).toBeVisible();
		// the SQL tab shows what the guided report becomes, read-only
		await page.getByTestId("editor-tab-sql").click();
		await expect(page.getByTestId("editor-compiled")).toContainText("SELECT");
		await page.getByTestId("editor-tab-guided").click();
		await expectAxeClean(page);
		await page.getByTestId("editor-save").click();
		await expect(page).toHaveURL(/\/admin\/config\/reports\/e2e-pivot$/);

		await page.goto("/reports/e2e-pivot?from=2025-09-01");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			"Prestiti per anno e sezione",
		);
		const grid = page.getByTestId("data-grid");
		await expect(grid).toContainText("Classe (anno)");
		await expect(grid).toContainText("Totale");
		const to = await page.getByTestId("param-to").inputValue();
		const csv = await page.request.get(
			`/export/report?id=e2e-pivot&from=2025-09-01&to=${to}&format=csv`,
		);
		const lines = (await csv.body()).subarray(3).toString("utf8").trim().split("\r\n");
		expect(lines[0]).toMatch(/^Classe \(anno\);A;.*;Totale$/);
		expect(lines.at(-1)).toMatch(/^Totale;/);
		const printed = await page.request.get(`/print/reports/e2e-pivot?from=2025-09-01&to=${to}`);
		expect(await printed.text()).toContain('class="total"');

		await remove(page, "e2e-pivot");
		await expect(page.getByTestId("report-e2e-pivot")).toHaveCount(0);
	});

	test("a built-in customised, then back to the original", async ({ page }) => {
		await page.goto("/admin/config/reports");
		await waitForHydration(page);
		await page.getByTestId("report-loans-by-weekday").getByTestId("report-edit").click();
		await expect(page).toHaveURL(/\/admin\/config\/reports\/loans-by-weekday$/);
		await waitForHydration(page);
		await expect(page.getByTestId("editor-builtin-hint")).toBeVisible();
		await expect(page.getByTestId("editor-id")).toBeDisabled();
		await page.getByTestId("editor-title-it").fill("Prestiti per giorno (scuola)");
		await page.getByTestId("editor-save").click();
		await expect(page.getByText("Report «loans-by-weekday» salvato")).toBeVisible();
		await page.goto("/admin/config/reports");
		await waitForHydration(page);
		const row = page.getByTestId("report-loans-by-weekday");
		await expect(row.getByTestId("report-origin")).toHaveText("Personalizzato");
		await expect(row).toContainText("Prestiti per giorno (scuola)");
		await remove(page, "loans-by-weekday");
		await expect(row.getByTestId("report-origin")).toHaveText("Fornito con BiblioViva");
	});

	test("a report duplicated and turned into SQL", async ({ page }) => {
		await page.goto("/admin/config/reports");
		await waitForHydration(page);
		await page.getByTestId("report-loans-by-month").getByTestId("report-duplicate").click();
		await expect(page).toHaveURL(/\/admin\/config\/reports\/new\?from=loans-by-month$/);
		await waitForHydration(page);
		await expect(page.getByTestId("editor-id")).toHaveValue("loans-by-month-copia");
		await page.getByTestId("editor-tab-sql").click();
		await page.getByTestId("editor-convert").click();
		await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
		await expect(page.getByTestId("editor-sql-text")).toHaveValue(/^SELECT /);
		// an SQL that compiles but fails when it runs is refused, nothing is saved
		const sql = await page.getByTestId("editor-sql-text").inputValue();
		await page
			.getByTestId("editor-sql-text")
			.fill(
				"SELECT json_extract('x', '$.a') AS month, 1 AS loans, 1 AS readers WHERE :from <= :to",
			);
		await page.getByTestId("editor-save").click();
		await expect(page.getByTestId("editor-save-problems")).toContainText(
			"La query non funziona su questo database: malformed JSON",
		);
		await expect(page).toHaveURL(/\/admin\/config\/reports\/new\?from=loans-by-month$/);
		// a JSON part that does not parse blocks the save too
		await page.getByTestId("editor-json-columns").fill("[");
		await page.getByTestId("editor-save").click();
		await expect(page.getByTestId("editor-save-problems")).toContainText("parti JSON");
		await page.getByTestId("editor-sql-text").fill(sql);
		await page.getByTestId("editor-json-columns").fill(
			JSON.stringify([
				{ key: "month", label: { it: "Mese", en: "Month" }, type: "month" },
				{ key: "loans", label: { it: "Prestiti", en: "Loans" }, type: "int" },
				{ key: "readers", label: { it: "Lettori", en: "Readers" }, type: "int" },
			]),
		);
		await expect(page.getByTestId("editor-json-columns")).toHaveValue(/"month"/);
		// the guided tab knows it is SQL now
		await page.getByTestId("editor-tab-guided").click();
		await expect(page.getByTestId("editor-guided")).toContainText("scritto in SQL");
		await page.getByTestId("editor-save").click();
		await expect(page).toHaveURL(/\/admin\/config\/reports\/loans-by-month-copia$/);
		await page.goto("/admin/config/reports");
		await waitForHydration(page);
		await expect(
			page.getByTestId("report-loans-by-month-copia").getByTestId("report-origin"),
		).toHaveText("Aggiunto");
		await remove(page, "loans-by-month-copia");
		await expect(page.getByTestId("report-loans-by-month-copia")).toHaveCount(0);
	});
});
