// SPDX-License-Identifier: GPL-3.0-or-later
// Administrator exports (steps 7.3, 9.19): the page, a download, the CSVs in the import formats, the JSON
// dump, one patron's data, and the refusal for an account without `admin`.
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createPatron } from "./helpers/data.js";
import { pageAction } from "./helpers/actions.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

test.describe("administrator exports", () => {
	test("downloads the library's data in the import formats and as JSON", async ({ page }) => {
		await page.goto("/admin");
		await waitForHydration(page);
		await page.getByTestId("admin-section-exports").click();
		await expect(page).toHaveURL(/\/admin\/exports$/);
		await waitForHydration(page);
		await expect(page.getByTestId(/^export-/)).toHaveCount(6);
		await expectAxeClean(page);
		const download = page.waitForEvent("download");
		await page.getByTestId("download-students").click();
		expect((await download).suggestedFilename()).toMatch(
			/^biblioviva-\d{4}-\d{2}-\d{2}-students\.csv$/,
		);

		// the formats of the imports, English columns (9.19)
		const students = await page.request.get("/admin/exports/students");
		expect((await students.body()).subarray(3).toString("utf8").split("\r\n")[0]).toBe(
			"first_name;last_name;level;section;external_id;card_number;email",
		);
		const teachers = await page.request.get("/admin/exports/teachers");
		expect((await teachers.body()).subarray(3).toString("utf8").split("\r\n")[0]).toBe(
			"first_name;last_name;group;external_id;card_number;email",
		);
		const catalog = await page.request.get("/admin/exports/catalog");
		expect((await catalog.text()).split("\r\n")[0]).toContain("biblio_key;isbn;issn;ean;title");
		const open = await page.request.get("/admin/exports/open-loans");
		expect((await open.text()).split("\r\n")[0]).toContain(
			"card_number;barcode;issued_on;due_on",
		);
		const dump = (await (await page.request.get("/admin/exports/dump")).json()) as {
			format: string;
			tables: Record<string, unknown[]>;
		};
		expect(dump.format).toBe("biblioviva-dump");
		expect(dump.tables.patron?.length).toBeGreaterThan(0);

		// one person's data from the patron page
		const person = await createPatron(page, `Accesso${page.viewportSize()?.width ?? 0}`);
		// a button, or an entry of "Altre azioni" holding the link
		await expect(
			(await pageAction(page, "export-patron")).locator("xpath=descendant-or-self::a"),
		).toHaveAttribute("href", `/admin/exports/patron/${person.id}`);
		const data = (await (
			await page.request.get(`/admin/exports/patron/${person.id}`)
		).json()) as {
			patron: { id: number; card_number: string };
		};
		expect(data.patron).toMatchObject({ id: person.id, card_number: person.card });
	});

	test("an account without admin cannot download them", async ({ page }) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("tessere", "tessere-test-pw");
		await expect(page).toHaveURL(/\/$/);
		expect((await page.request.get("/admin/exports/dump")).status()).toBe(403);
		expect((await page.request.get("/admin/exports/patron/1")).status()).toBe(403);
	});
});
