// SPDX-License-Identifier: GPL-3.0-or-later
// Loans list and overdue notices (step 4.6, Appendix H): the loans grid with its filters and a
// renewal of the selection, the overdues grouped by class with the minimum delay, the printed
// notices (heading, three columns, page break), "Segna solleciti stampati", the per-patron
// reminder and a visual snapshot of the notice layout on made-up data.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import {
	createBook,
	createPatron,
	dayFromToday,
	importLoans,
	seededClassId,
} from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

/** `dd/MM/yyyy` of today, as in the printed headings. */
const printedToday = (): string => {
	const [y, m, d] = dayFromToday(0).split("-");
	return `${d}/${m}/${y}`;
};

test.describe.serial("loans and overdue notices", () => {
	test("lists, groups, prints and marks the overdue loans", async ({ page }) => {
		const t = tagOf(page);
		const student = await createPatron(page, `Sollecito${t}`);
		const teacher = await createPatron(page, `Sollecitodoc${t}`, "teacher");
		const book = await createBook(page, `Libro in ritardo ${t}`, 3);
		const [c1, c2, c3] = book.barcodes as [string, string, string];
		await importLoans(page, [
			[student.card, c1, dayFromToday(-30), dayFromToday(-10)],
			[teacher.card, c2, dayFromToday(-40), dayFromToday(-20)],
			[teacher.card, c3, dayFromToday(-20), dayFromToday(-2)],
		]);

		// the loans grid: search, overdue only
		await page.goto("/circulation/loans");
		await waitForHydration(page);
		await expect(page.getByTestId("desk-tab-loans")).toHaveAttribute("aria-current", "page");
		// nothing until a filter or 3 characters (9.13, round 15)
		await expect(page.getByTestId("loans-start")).toContainText("libri in prestito");
		await expect(page.getByTestId("data-grid")).toHaveCount(0);
		await page.getByLabel("Cerca").fill("so");
		await expect(page.getByTestId("data-grid")).toHaveCount(0);
		await page.getByLabel("Cerca").fill(`sollecito`);
		const grid = page.getByTestId("data-grid");
		await expect(grid.getByText(`Sollecito${t} Anna`)).toBeVisible();
		await page.getByLabel("Cerca").fill(`sollecitodoc${t}`.toLowerCase());
		await expect(grid.locator(".wx-row")).toHaveCount(2);
		await expect(page.getByTestId("loans-count")).toHaveText("2 prestiti trovati");
		await page.getByTestId("overdue-only").check();
		await expect(grid.locator(".wx-row")).toHaveCount(2);
		await expect(grid.getByText("20 gg")).toBeVisible();
		await expectAxeClean(page);
		// renew the teacher's two loans from the selection
		const rows = grid.locator(".wx-row");
		await rows.nth(0).click({ modifiers: ["Control"] });
		await rows.nth(1).click({ modifiers: ["Control"] });
		await page.getByTestId("renew-selected").click();
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			"Rinnovati 2 prestiti su 2.",
		);
		await expect(grid.locator(".wx-row")).toHaveCount(0);

		// the overdues page: the student's loan in class 4 B, the teacher's none left
		const fourB = `g${seededClassId(4, "B")}`;
		await page.goto("/circulation/overdues");
		await waitForHydration(page);
		const classGroup = page.locator(`[data-testid="overdue-group"][data-group="${fourB}"]`);
		await expect(classGroup.getByText(`Anna Sollecito${t}`)).toBeVisible();
		await expect(classGroup.getByText(`Anna Sollecito${t}`).locator("..")).toContainText(
			`Libro in ritardo ${t}`,
		);
		await expectAxeClean(page);

		// the printed notices: heading, three columns, the student's row
		const notices = await page.request.get(`/print/overdues?minDays=5&groups=${fourB}`);
		expect(notices.status()).toBe(200);
		const html = await notices.text();
		expect(html).toContain(`<h2>4 B - Solleciti biblioteca del ${printedToday()}</h2>`);
		expect(html).toContain("<th>Nome</th><th>Titolo</th><th>Giorni ritardo</th>");
		expect(html).toContain(
			`<td>Anna Sollecito${t}</td><td>Libro in ritardo ${t}</td><td>10</td>`,
		);
		expect(html).not.toContain("Docente - Solleciti");
		const broken = await (
			await page.request.get(`/print/overdues?groups=${fourB}&pageBreak=1`)
		).text();
		expect(broken).toContain("page-break");
		expect(broken).toContain(".block.page-break { break-after: page;");
		// a minimum delay above the student's 10 days leaves the loan out
		const later = await page.request.get(`/print/overdues?minDays=11&groups=${fourB}`);
		expect(await later.text()).not.toContain(`Anna Sollecito${t}`);
		expect(
			(await page.request.get(`/print/overdues?groups=${fourB}&minDays=365`)).status(),
		).toBe(422);
		await expect(page.getByTestId("print-notices")).toHaveAttribute(
			"href",
			"/print/overdues?minDays=5&pageBreak=0",
		);

		// "Segna solleciti stampati" only for class 4 B: the other groups are left out
		for (const box of await page.getByTestId(/^group-/).all()) {
			if ((await box.getAttribute("data-testid")) !== `group-${fourB}`) {
				await box.uncheck();
			}
		}
		await expect(page.getByTestId("print-notices")).toHaveAttribute(
			"href",
			new RegExp(`groups=${fourB}$`),
		);
		await page.getByTestId("mark-notices").click();
		await page.getByTestId("confirm-button").click();
		await expect(
			page.getByRole("status").getByText(/solleciti? segnat[oi] come stampat[oi]/),
		).toBeVisible();
		await expect(classGroup.getByText(/ultimo sollecito/).first()).toBeVisible();

		// the per-patron reminder from the patron page
		await page.goto(`/patrons/${student.id}`);
		await waitForHydration(page);
		await expect(page.getByTestId("print-reminder")).toHaveAttribute(
			"href",
			`/print/overdues?patron=${student.id}`,
		);
		const reminder = await (
			await page.request.get(`/print/overdues?patron=${student.id}`)
		).text();
		expect(reminder).toContain(
			`<h2>Anna Sollecito${t} (4 B) - Libri da restituire alla biblioteca</h2>`,
		);
		expect(reminder).toContain(`<td>Libro in ritardo ${t}</td><td>${c1}</td>`);
		expect((await page.request.get(`/print/overdues?patron=${teacher.id}`)).status()).toBe(422);
	});

	test("the notice layout matches the library's printout", async ({ page, isMobile }) => {
		test.skip(isMobile, "one baseline is enough for a print layout");
		await page.setViewportSize({ width: 900, height: 1200 });
		await page.goto("/print/overdues?sample=1&date=2026-09-19");
		await expect(page.locator("h2").first()).toHaveText(
			"1 D - Solleciti biblioteca del 19/09/2026",
		);
		await expect(page.locator(".sheet")).toHaveScreenshot("overdues-sample.png", {
			maxDiffPixelRatio: 0.02,
		});
	});
});
