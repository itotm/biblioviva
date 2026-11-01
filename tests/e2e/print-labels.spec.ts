// SPDX-License-Identifier: GPL-3.0-or-later
// Book labels (step 3.8): the print routes of the three kinds, the calibration page with units,
// visual baselines of the built-in templates (desktop only), an item print list built from the
// catalogue selection and a scanned barcode, printed from the list and marked as printed, the
// label actions of the record page.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { pageAction } from "./helpers/actions.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");
/** Each project owns a search word of the seeded catalogue so the selections never overlap. */
const wordOf = (page: Page): string => (tagOf(page) === "Mob" ? "adventures" : "diary");

test.describe("label printing", () => {
	test("routes: sheets per kind, sample pages, calibration with units, errors", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "print output does not depend on the viewport");
		const sample = await page.request.get("/print/labels/pair?sample=1");
		expect(sample.status()).toBe(200);
		expect(sample.headers()["x-labels-count"]).toBe("9");
		const html = await sample.text();
		expect(html).toContain("@page { size: A4 portrait; margin: 0; }");
		expect((html.match(/class="cell /g) ?? []).length).toBe(18);
		expect(html).not.toContain("<script");
		expect(
			(await page.request.get("/print/labels/barcode?sample=1")).headers()["x-labels-count"],
		).toBe("18");
		expect(
			(await page.request.get("/print/labels/spine?sample=1&stock=l7651")).headers()[
				"x-labels-count"
			],
		).toBe("65");

		// the seed leaves some copies without labels: the pending sheet has at least one page
		const pending = await page.request.get("/print/labels/pair?pending=1&preview=1");
		expect(pending.status()).toBe(200);
		expect(Number(pending.headers()["x-labels-pages"])).toBeGreaterThan(0);
		// two copies from position 9: the first fills page 1, the second starts page 2
		const two = await page.request.get("/print/labels/pair?ids=1,2&start=9&preview=1");
		expect(two.headers()["x-labels-pages"]).toBe("2");

		// calibration with the pair's units outlined
		const calibration = await page.request.get(
			"/print/labels/calibration?stock=a4-70x48&kind=pair",
		);
		expect(calibration.status()).toBe(200);
		expect((await calibration.text()).match(/class="unit"/g)).toHaveLength(9);

		// errors: unknown kind, bad ids, unknown list, unknown stock, unknown template, unit does not fit
		expect((await page.request.get("/print/labels/nope?ids=1")).status()).toBe(400);
		expect((await page.request.get("/print/labels/pair?ids=abc")).status()).toBe(400);
		expect((await page.request.get("/print/labels/pair?list=999999")).status()).toBe(404);
		expect((await page.request.get("/print/labels/pair?sample=1&stock=nope")).status()).toBe(
			404,
		);
		expect((await page.request.get("/print/labels/pair?sample=1&template=nope")).status()).toBe(
			422,
		);
		expect((await page.request.get("/print/labels/pair?sample=1&stock=l7651")).status()).toBe(
			422,
		);
		expect(
			(await page.request.get("/print/labels/pair?ids=1&start=10&preview=1")).status(),
		).toBe(422);
	});

	test("the built-in templates match their visual baselines", async ({ page, isMobile }) => {
		test.skip(isMobile, "print output does not depend on the viewport");
		await page.setViewportSize({ width: 1280, height: 1000 });
		await page.goto("/admin/cards/templates");
		await waitForHydration(page);
		await page.getByRole("tab", { name: "Etichette" }).click();
		for (const name of ["pair", "barcode", "spine"]) {
			await page.getByTestId(`template-labels-${name}-default`).click();
			const frame = page.getByTestId("label-preview-frame");
			await expect(page.getByTestId("label-preview-panel")).toContainText(`${name}-default`);
			await expect(frame).toBeVisible();
			await page.evaluate(() => document.fonts.ready);
			await expect(frame).toHaveScreenshot(`label-${name}.png`, { maxDiffPixelRatio: 0.02 });
		}
		// the compact variant of the spine band on the small stickers
		await page.getByTestId("label-preview-stock").selectOption("l7651");
		await expect(page.getByTestId("label-preview-panel")).toContainText("variante compact");
		await expect(page.getByTestId("label-sheet-link")).toHaveAttribute(
			"href",
			"/print/labels/spine?sample=1&template=spine-default&stock=l7651",
		);
		await expectAxeClean(page);

		// the pair sheet, to compare by eye with docs/reference/labels/koha-etichette.png
		await page.setViewportSize({ width: 900, height: 1300 });
		await page.goto("/print/labels/pair?sample=1");
		await page.evaluate(() => document.fonts.ready);
		await expect(page.locator(".page").first()).toHaveScreenshot("label-pair-sheet.png", {
			maxDiffPixelRatio: 0.02,
		});
	});

	test("an item list from the catalogue selection and a scanned copy, printed and marked", async ({
		page,
	}) => {
		const tag = tagOf(page);
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(wordOf(page));
		const rows = page.getByTestId("data-grid").locator(".wx-row");
		await expect(rows.nth(1)).toBeVisible();
		await rows.nth(0).click({ modifiers: ["Control"] });
		await rows.nth(1).click({ modifiers: ["Control"] });
		const copiesOf = async (i: number): Promise<number> =>
			Number(
				/^(\d+) di (\d+)/.exec(
					(await rows.nth(i).locator(".wx-cell").last().innerText()).trim(),
				)?.[2],
			);
		const expected = (await copiesOf(0)) + (await copiesOf(1));

		// the print dialog estimates the copies of the selection
		await page.getByTestId("print-selected-labels").click();
		await expect(page.getByTestId("label-estimate")).toContainText(`${expected} copie`);
		await expect(page.getByTestId("label-print")).toHaveAttribute(
			"href",
			/\/print\/labels\/pair\?biblios=\d+,\d+/,
		);
		await page.getByTestId("label-kind-spine").click();
		await expect(page.getByTestId("label-print")).toHaveAttribute(
			"href",
			/\/print\/labels\/spine\?/,
		);
		await page.getByTestId("label-close").click();

		// add every copy of the two records to a new item list
		await page.getByTestId("add-to-list").click();
		await page.getByTestId("add-to-list-dialog").getByRole("radio").last().check();
		await page.getByTestId("add-to-list-name").fill(`Etichette ${tag}`);
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText(`${expected} aggiunti`)).toBeVisible();

		await page.goto("/print-lists");
		await waitForHydration(page);
		await page.getByRole("link", { name: `Etichette ${tag}`, exact: true }).click();
		await expect(page).toHaveURL(/\/print-lists\/\d+$/);
		const listUrl = page.url();
		await waitForHydration(page);
		await expect(page.getByTestId("list-count")).toContainText(`${expected} copie`);
		await expectAxeClean(page);

		// scan a copy of another record (the third search hit), twice: the second is ignored
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(wordOf(page));
		await rows.nth(2).click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		const barcode = (
			await page.getByTestId("items-table").locator("tbody tr td").first().innerText()
		).trim();
		await page.goto(listUrl);
		await waitForHydration(page);
		const scan = page.getByRole("textbox", { name: "Codice a barre" });
		await scan.fill(barcode);
		await scan.press("Enter");
		await expect(page.getByTestId("scan-notice")).toContainText(`(${barcode}) aggiunta`);
		await scan.fill(barcode);
		await scan.press("Enter");
		await expect(page.getByTestId("scan-notice")).toContainText("già nella lista");
		await scan.fill("2099-0001");
		await scan.press("Enter");
		await expect(page.getByTestId("scan-notice")).toContainText("Nessuna copia");
		await expect(page.getByTestId("list-count")).toContainText(`${expected + 1} copie`);

		// quick filter: a date range nobody matches reports it without touching the list
		await page.getByTestId("quick-pending").selectOption("pair");
		await page.getByTestId("quick-from").fill("2099-01-01");
		await page.getByTestId("quick-add").click();
		await expect(page.getByRole("status").getByText("Nessuna copia corrisponde")).toBeVisible();
		await expect(page.getByTestId("list-count")).toContainText(`${expected + 1} copie`);

		// print the list: the sheet of pairs in list order, then mark as printed
		const listId = page.url().split("/").pop();
		await page.getByTestId("print-list-labels").click();
		await expect(page.getByTestId("label-print")).toHaveAttribute(
			"href",
			`/print/labels/pair?list=${listId}&stock=a4-70x48`,
		);
		await page.getByTestId("label-start").fill("3");
		await expect(page.getByTestId("label-print")).toHaveAttribute("href", /&start=3$/);
		await page.getByTestId("label-close").click();
		const sheet = await page.request.get(`/print/labels/pair?list=${listId}&start=3`);
		expect(sheet.status()).toBe(200);
		const count = Number(/\d+/.exec(await page.getByTestId("list-count").innerText())?.[0]);
		expect(sheet.headers()["x-labels-count"]).toBe(String(count));

		await page.getByTestId("mark-kind").selectOption("pair");
		await page.getByTestId("mark-printed").click();
		await expect(
			page.getByRole("status").getByText(`${count} copie segnate come stampate`),
		).toBeVisible();
		await expect(
			page.getByTestId("entry-labels").filter({ hasText: "da stampare" }),
		).toHaveCount(0);
		await expect(page.getByTestId("entry-labels").first()).toContainText("Etichette stampate");
	});

	test("the record page prints and marks the labels of its copies", async ({ page }) => {
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(wordOf(page));
		const rows = page.getByTestId("data-grid").locator(".wx-row");
		await rows.nth(3).click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		const firstRow = page.getByTestId("items-table").locator("tbody tr").first();
		const barcode = (await firstRow.locator("td").first().innerText()).trim();

		// one copy: the row's print button opens the dialog on that copy alone
		await page.getByTestId(`labels-item-${barcode}`).click();
		await expect(page.getByTestId("label-estimate")).toContainText("1 copia");
		await expect(page.getByTestId("label-print")).toHaveAttribute(
			"href",
			/\/print\/labels\/pair\?ids=\d+&stock=a4-70x48$/,
		);
		// after opening the print page, the dialog offers to mark the copies as printed
		const href = await page.getByTestId("label-print").getAttribute("href");
		expect((await page.request.get(`${href}&preview=1`)).status()).toBe(200);
		const popup = page.waitForEvent("popup");
		await page.getByTestId("label-print").click();
		await (await popup).close();
		// every button of the dialog stays inside the window, on a phone too
		const width = page.viewportSize()?.width ?? 0;
		for (const id of ["label-close", "label-mark-printed", "label-print"]) {
			const box = await page.getByTestId(id).boundingBox();
			expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
			expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
		}
		await page.getByTestId("label-mark-printed").click();
		await expect(
			page.getByRole("status").getByText("1 copia segnata come stampata"),
		).toBeVisible();
		await expect(page.getByTestId(`item-labels-${barcode}`)).toContainText(
			"Etichette stampate",
		);

		// every copy from the header (its "Altre azioni" menu)
		await (await pageAction(page, "print-labels")).click();
		const copies = await page.getByTestId("items-table").locator("tbody tr").count();
		await expect(page.getByTestId("label-estimate")).toContainText(
			new RegExp(`${copies} copi[ae]`),
		);
		await page.getByTestId("label-close").click();
	});
});
