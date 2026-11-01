// SPDX-License-Identifier: GPL-3.0-or-later
// Audit log page (step 1.7): the admin sees the login rows, filters work, no personal data shown.
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

test.describe("admin audit log", () => {
	test("lists login entries and filters by action", async ({ page }) => {
		await page.goto("/admin");
		await waitForHydration(page);
		await page.getByTestId("admin-section-audit").click();
		await expect(page).toHaveURL(/\/admin\/audit$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Registro operazioni");
		await expect(page.getByTestId("audit-count")).toContainText(/di \d+ operazion[ie]/);
		const grid = page.getByTestId("data-grid");
		// newest first: other specs may have written many rows since the last login
		await expect(grid.locator(".wx-row").first()).toBeVisible();
		await expectAxeClean(page);

		await page.getByTestId("audit-action").selectOption("auth.login");
		await expect(grid.getByText("auth.login").first()).toBeVisible();
		await page.getByTestId("audit-user").selectOption({ label: "admin" });
		await expect(grid.getByText("admin").first()).toBeVisible();

		// a future date range yields the empty state
		await page.getByLabel("Dal").fill("2099-01-01");
		await expect(page.getByTestId("empty-state")).toBeVisible();
		await expect(page.getByTestId("audit-count")).toContainText("0 di 0");
	});

	test("exports the filtered grid as CSV and ODS", async ({ page }) => {
		await page.goto("/admin/audit");
		await waitForHydration(page);
		await page.getByTestId("audit-action").selectOption("auth.login");
		await page.getByTestId("export-menu").click();
		const csvLink = page.getByRole("menuitem", { name: /CSV/ });
		await expect(csvLink).toBeVisible();
		const csvHref = await csvLink.getByRole("link").getAttribute("href");
		expect(csvHref).toContain("/export/audit?format=csv");
		expect(csvHref).toContain("action=auth.login");

		const csv = await page.request.get(csvHref!);
		expect(csv.status()).toBe(200);
		expect(csv.headers()["content-type"]).toContain("text/csv");
		expect(csv.headers()["content-disposition"]).toMatch(/audit-\d{8}-\d{4}\.csv/);
		const raw = await csv.body();
		expect([...raw.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
		const text = raw.subarray(3).toString("utf8");
		expect(text.split("\r\n")[0]).toBe("Quando;Account;Operazione;Oggetto;ID;Dettagli");
		expect(text).toContain(";auth.login;");
		expect(text).not.toContain("patron.create");

		const ods = await page.request.get(csvHref!.replace("format=csv", "format=ods"));
		expect(ods.status()).toBe(200);
		expect(ods.headers()["content-type"]).toContain("opendocument.spreadsheet");
		const bytes = await ods.body();
		expect(bytes.subarray(0, 2).toString()).toBe("PK");
		expect(bytes.subarray(30, 38).toString()).toBe("mimetype");

		expect((await page.request.get("/export/nope?format=csv")).status()).toBe(404);
		expect((await page.request.get("/export/audit?format=xlsx")).status()).toBe(400);
		expect((await page.request.get("/export/audit?format=csv&from=bad")).status()).toBe(400);
	});
});
