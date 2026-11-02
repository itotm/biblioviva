// SPDX-License-Identifier: GPL-3.0-or-later
// "Nuovo libro" fast-add flow (step 3.6) with the mock metadata provider: scan → the most complete
// record (9.14) with its original title (9.23) → save two copies with their barcodes; the duplicate path adds copies to the
// existing record; the manual path without a code, with a series; a failing provider is explained
// next to the results; a DVD EAN skips the lookup. Each project uses its own ISBNs because the database is shared for the run.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

const isMobile = (page: Page): boolean => page.viewportSize()?.width === 412;
/** Mock records (src/lib/server/metadata/mock.ts). */
const ISBN = {
	desktop: {
		pick: "9788804668237",
		candidates: 2,
		title: "1984",
		original: "Nineteen eighty-four",
		nonfiction: "9788806049980",
	},
	mobile: {
		pick: "9788807580017",
		candidates: 1,
		title: "Il piccolo principe",
		original: "Le petit prince",
		nonfiction: "",
	},
};
const FAILING_ISBN = "9788800000024";
const DVD_EAN = "4006381333931";

async function scan(page: Page, code: string): Promise<void> {
	const input = page.getByLabel("ISBN o EAN");
	await input.fill(code);
	await input.press("Enter");
}

test.describe.serial("fast add", () => {
	test("scan → pick a candidate → save two copies with their barcodes", async ({ page }) => {
		const data = isMobile(page) ? ISBN.mobile : ISBN.desktop;
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nuovo libro");
		await expect(page.getByTestId("stage-code")).toBeVisible();
		await expectAxeClean(page);

		// an ISBN opens the form with the most complete record at once (9.14, Q85)
		await scan(page, data.pick);
		await expect(page.getByTestId("stage-form")).toBeVisible();
		if (data.candidates > 1) {
			await expect(page.getByTestId("best-of")).toContainText(
				`tra le ${data.candidates} trovate`,
			);
			// "Altre schede" shows them all, the most complete first; Enter picks it again
			await page.getByTestId("other-records").click();
			await expect(page.getByTestId("stage-lookup")).toBeVisible();
			await expect(page.getByTestId("candidate")).toHaveCount(data.candidates);
			await expect(page.getByTestId("provider-mock")).toContainText(
				`${data.candidates} schede`,
			);
			await expect(page.getByTestId("candidate").first()).toContainText(data.title);
			await expect(page.getByTestId("candidate-original").first()).toContainText(
				data.original,
			);
			await expect(page.getByTestId("candidate-best")).toHaveCount(1);
			await expect(page.getByTestId("candidate-source").first()).toHaveText("Mock");
			await expectAxeClean(page);
			await expect(page.getByTestId("pick-candidate").first()).toBeFocused();
			await page.keyboard.press("Enter");
			await expect(page.getByTestId("stage-form")).toBeVisible();
		} else {
			await expect(page.getByTestId("best-of")).toHaveCount(0);
		}
		await expect(page.getByLabel("Titolo", { exact: true })).toHaveValue(data.title);
		// the original title of a translation comes with the record (9.23)
		await expect(page.getByRole("textbox", { name: /^Titolo originale/ })).toHaveValue(
			data.original,
		);
		await expect(page.getByLabel("ISBN", { exact: true })).toHaveValue(data.pick);
		await expect(page.getByTestId("biblio-form-note")).toContainText("Scheda da Mock");

		await page.getByTestId("genre-A").click();
		await page.getByTestId("reading-level-3").click();
		await page.getByTestId("fast-copies").fill("2");
		// the call number ("Segnatura") and the acquisition date are prefilled (owner review)
		await expect(page.getByTestId("fast-call-number")).toHaveValue(/^A 3 [A-Z]{3}$/);
		await expect(page.getByTestId("fast-acquisition-date")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
		// changing the class updates the suggestion; a typed value is kept
		await page.getByTestId("reading-level-2").click();
		await expect(page.getByTestId("fast-call-number")).toHaveValue(/^A 2 [A-Z]{3}$/);
		await page.getByTestId("fast-call-number").fill("X 9 ABC");
		await page.getByTestId("reading-level-3").click();
		await expect(page.getByTestId("fast-call-number")).toHaveValue("X 9 ABC");
		await page.getByTestId("fast-call-number").fill("");
		await page.getByTestId("reading-level-1").click();
		await expect(page.getByTestId("fast-call-number")).toHaveValue(/^A 1 [A-Z]{3}$/);
		await page.getByTestId("reading-level-3").click();
		await expectAxeClean(page);
		await page.getByTestId("biblio-submit").click();

		await expect(page.getByTestId("stage-done")).toBeVisible();
		await expect(page.getByTestId("done-summary")).toContainText(`«${data.title}» con 2 copie`);
		const barcodes = await page.getByTestId("done-barcodes").locator("li").allTextContents();
		expect(barcodes).toHaveLength(2);
		for (const b of barcodes) {
			expect(b).toMatch(/^\d{4}-[A-Z]\d{4}$/);
		}
		// consecutive numbers, each with its own check letter
		expect(Number(barcodes[1]?.slice(6))).toBe(Number(barcodes[0]?.slice(6)) + 1);
		// the print dialog (step 3.8) links the pair sheet of the two new copies
		await page.getByTestId("done-print").click();
		await expect(page.getByTestId("label-estimate")).toContainText("2 copie");
		await expect(page.getByTestId("label-print")).toHaveAttribute(
			"href",
			/\/print\/labels\/pair\?ids=\d+,\d+&stock=a4-70x48$/,
		);
		await page.getByTestId("label-close").click();
		await expectAxeClean(page);
	});

	test("the same ISBN again offers to add a copy to the existing record", async ({ page }) => {
		const data = isMobile(page) ? ISBN.mobile : ISBN.desktop;
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		await scan(page, data.pick);
		await expect(page.getByTestId("stage-duplicate")).toBeVisible();
		await expect(page.getByTestId("duplicate-title")).toHaveText(data.title);
		await expect(page.getByTestId("duplicate-copies")).toHaveText("2 copie");
		await expectAxeClean(page);
		await page.getByTestId("duplicate-add").click();
		await expect(page.getByTestId("stage-done")).toBeVisible();
		await expect(page.getByTestId("done-summary")).toHaveText(
			`1 copia aggiunta a «${data.title}»`,
		);
		await expect(page.getByTestId("done-barcodes").locator("li")).toHaveCount(1);
		// "Aggiungi un altro" returns to the scanner
		await page.getByTestId("done-another").click();
		await expect(page.getByTestId("stage-code")).toBeVisible();
	});

	test("without a code: search by title, then enter by hand", async ({ page }) => {
		const title = `Fiabe senza codice ${isMobile(page) ? "Mob" : "Desk"}`;
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		await page.getByTestId("no-code").click();
		await expect(page.getByTestId("stage-search")).toBeVisible();
		await page.getByTestId("search-submit").click();
		await expect(page.getByRole("alert")).toContainText("almeno il titolo");
		await page.getByTestId("search-title").fill("principe");
		await page.getByTestId("search-submit").click();
		await expect(page.getByTestId("candidate")).toHaveCount(1);
		await expect(page.getByTestId("candidate").first()).toContainText("Il piccolo principe");

		await page.getByTestId("lookup-manual").click();
		await expect(page.getByTestId("stage-form")).toBeVisible();
		await expect(page.getByTestId("biblio-form-note")).toContainText("compilata a mano");
		await expect(page.getByLabel("Titolo", { exact: true })).toHaveValue("principe");
		await page.getByLabel("Titolo", { exact: true }).fill(title);
		// the series of the catalogue are suggested; a new one is typed with its number (9.14)
		await expect(
			page.locator('datalist option[value="Le avventure di Pepe Lampo"]'),
		).toHaveCount(1);
		await page
			.getByTestId("biblio-series")
			.fill(`Serie e2e ${isMobile(page) ? "Mob" : "Desk"}`);
		await page.getByTestId("biblio-series-number").fill("3");
		await page.getByTestId("quick-author-Anonimo").click();
		await page.getByTestId("quick-publisher").click();
		await page.getByTestId("genre-G").click();
		await page.getByTestId("biblio-submit").click();
		await expect(page.getByTestId("stage-done")).toBeVisible();
		await expect(page.getByTestId("done-summary")).toContainText(`«${title}» con 1 copia`);
		await page.getByTestId("done-open").click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
		// the series on the record page leads to its books
		const series = `Serie e2e ${isMobile(page) ? "Mob" : "Desk"}`;
		await expect(page.getByTestId("series-badge")).toHaveText(`${series} · 3`);
		await page.getByTestId("series-badge").click();
		await expect(page).toHaveURL(/\/catalog\?series=/);
		await expect(page.getByTestId("biblio-count")).toContainText("1 titolo");
		await expect(page.getByTestId("filter-series")).toHaveValue(series);
	});

	test("a failing provider is explained; a DVD EAN skips the lookup", async ({ page }) => {
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		await scan(page, FAILING_ISBN);
		await expect(page.getByTestId("provider-mock")).toContainText("Errore");
		await expect(page.getByRole("alert")).toContainText("non ha risposto in tempo");
		await expect(page.getByTestId("lookup-retry")).toBeVisible();
		await expectAxeClean(page);
		await page.getByTestId("lookup-back").click();

		await page.getByTestId("material-dvd").click();
		await scan(page, DVD_EAN);
		await expect(page.getByTestId("stage-form")).toBeVisible();
		await expect(page.getByLabel("EAN (non ISBN)", { exact: true })).toHaveValue(DVD_EAN);
		await expect(page.getByTestId("biblio-item-type")).toHaveValue("dvd");

		// a code that is neither is refused
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		await scan(page, "1234567890123");
		await expect(page.getByTestId("code-message")).toContainText("non è un ISBN né un EAN");
	});
});

test.describe("fast add with the camera (9.13, round 5)", () => {
	test("the camera keeps scanning past codes it does not want and takes the ISBN", async ({
		page,
	}) => {
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		// the material comes after the code field now
		const code = page.getByTestId("barcode-input");
		const material = page.getByTestId("material");
		const codeBox = await code.boundingBox();
		const materialBox = await material.boundingBox();
		expect(materialBox?.y ?? 0).toBeGreaterThan(codeBox?.y ?? 0);
		await page.getByRole("button", { name: "Fotocamera", exact: true }).click();
		await expect(page.getByTestId("barcode-camera")).toBeVisible();
		// the fake feed shows a card and a copy label too: neither stops the scan, the ISBN does
		await expect(
			page.locator('[data-testid="stage-lookup"], [data-testid="stage-duplicate"]'),
		).toBeVisible({ timeout: 20_000 });
		await expect(page.getByTestId("scanner-overlay")).toHaveCount(0);
		await expect(page.getByTestId("code-message")).toHaveCount(0);
	});
});
