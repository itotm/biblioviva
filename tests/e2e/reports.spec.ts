// SPDX-License-Identifier: GPL-3.0-or-later
// Reports (step 6.2): the library by category, three reports run with parameters (the form, the
// URL, required parameters), the bar chart, CSV and ODS export, the print view.
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

test.describe("reports", () => {
	test("runs reports with parameters, draws the chart, exports and prints", async ({
		page,
		isMobile,
	}) => {
		await page.goto("/reports");
		await waitForHydration(page);
		await expect(page.getByTestId("report-category-loans")).toBeVisible();
		await expect(page.getByTestId("report-top-readers")).toBeVisible();
		await expectAxeClean(page);

		// 1. loans by class and section: defaults filled in, a wider period from the form
		await page.getByTestId("report-loans-by-class-section").click();
		await expect(page).toHaveURL(/\/reports\/loans-by-class-section$/);
		await waitForHydration(page);
		await expect(page.getByTestId("param-from")).toHaveValue(/^\d{4}-09-01$/);
		await page.getByTestId("param-from").fill("2025-09-01");
		await page.getByTestId("report-run").click();
		await expect(page).toHaveURL(/from=2025-09-01/);
		await expect(page.getByTestId("report-count")).toHaveText(/^\d+ righe$/);
		await expect(page.getByTestId("data-grid").locator(".wx-row").first()).toBeVisible();
		const chart = page.getByTestId("report-chart").locator("canvas");
		await expect(chart).toBeVisible();
		await expect
			.poll(async () => (await chart.boundingBox())?.height ?? 0)
			.toBeGreaterThan(100);
		if (!isMobile) {
			await expectAxeClean(page);
		}
		const to = await page.getByTestId("param-to").inputValue();
		const csv = await page.request.get(
			`/export/report?id=loans-by-class-section&from=2025-09-01&to=${to}&format=csv`,
		);
		expect(csv.status()).toBe(200);
		// a pivot table (9.20): one column per section, then the total; the total row last
		const lines = (await csv.body()).subarray(3).toString("utf8").trim().split("\r\n");
		expect(lines[0]).toMatch(/^Classe \(anno\);A;.*;Totale$/);
		expect(lines.at(-1)).toMatch(/^Totale;/);
		expect(lines.some((l) => l.startsWith("Docenti;"))).toBe(true);
		const ods = await page.request.get(
			`/export/report?id=loans-by-class-section&from=2025-09-01&to=${to}&format=ods`,
		);
		expect(ods.status()).toBe(200);
		expect(ods.headers()["content-type"]).toContain("opendocument.spreadsheet");
		await expect(page.getByTestId("report-print")).toHaveAttribute(
			"href",
			new RegExp(`/print/reports/loans-by-class-section\\?from=2025-09-01&to=${to}`),
		);
		// "Esporta" sits in the header beside "Stampa", with the parameters the report ran with
		await expect(page.getByTestId("report-copy-link")).toHaveCount(0);
		await expect(page.getByTestId("grid-footer")).toHaveCount(0);
		await page.getByTestId("export-menu").click();
		await expect(page.getByRole("menuitem", { name: "CSV" }).locator("a")).toHaveAttribute(
			"href",
			`/export/report?format=csv&id=loans-by-class-section&from=2025-09-01&to=${to}`,
		);
		await page.keyboard.press("Escape");

		// 2. overdue loans, through the URL: patron types shown as words
		await page.goto("/reports/overdue-loans?minDays=3");
		await waitForHydration(page);
		await expect(page.getByTestId("param-minDays")).toHaveValue("3");
		await expect(page.getByTestId("report-count")).toBeVisible();

		// 3. a parameter that is not valid is named
		await page.goto("/reports/top-titles?from=ieri");
		await waitForHydration(page);
		await expect(page.getByTestId("report-error")).toHaveText(
			"Il valore di «Dal» non è valido.",
		);
		await page.getByTestId("param-from").fill("2025-09-01");
		await page.getByTestId("report-run").click();
		await expect(page.getByTestId("report-error")).toHaveCount(0);
		await expect(page.getByTestId("report-count")).toBeVisible();

		// the print view
		const printed = await page.request.get("/print/reports/acquisitions-by-year");
		expect(printed.status()).toBe(200);
		const html = await printed.text();
		expect(html).toContain("<h1>Acquisizioni per anno</h1>");
		expect(html).toContain("<th>Anno</th>");
		expect(html).toContain(`<th class="n">Copie</th>`);
	});

	test("an account without the reports permission cannot open them", async ({ page }) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("prestiti", "prestiti-test-pw");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		expect((await page.request.get("/print/reports/acquisitions-by-year")).status()).toBe(403);
		await page.goto("/reports");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			/non è disponibile per l'account in uso/,
		);
	});
});
