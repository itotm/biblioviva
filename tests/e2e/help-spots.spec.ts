// SPDX-License-Identifier: GPL-3.0-or-later
// The small help icons of the trickier parts of a page (9.5b): each sits beside its heading, names
// its topic, opens the section of the documentation in a new tab, stays 24 px wide and gets a 44 px
// touch area on a phone without growing.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

const DOCS = "https://docs.biblioviva.org/it/";

function spot(page: Page, key: string): Locator {
	return page.locator(`[data-testid="help-spot"][data-spot="${key}"]`);
}

async function expectSpot(page: Page, key: string, name: string, href: string): Promise<Locator> {
	const link = spot(page, key);
	await expect(link).toBeVisible();
	await expect(link).toHaveAccessibleName(name);
	await expect(link).toHaveAttribute("title", name);
	await expect(link).toHaveAttribute("href", `${DOCS}${href}`);
	await expect(link).toHaveAttribute("target", "_blank");
	await expect(link).toHaveAttribute("rel", "external noopener");
	return link;
}

test.describe("help icons of the trickier parts", () => {
	test("Nuovo libro: the code and the search stages, small, with a touch area on a phone", async ({
		page,
		isMobile,
	}) => {
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		const code = await expectSpot(
			page,
			"fastAddCode",
			"Guida: Leggi il codice a barre",
			"manual/new-book/#passo-codice",
		);
		await expectAxeClean(page);
		const box = await code.boundingBox();
		expect(box?.width).toBe(24);
		expect(box?.height).toBe(24);
		const area = await code.evaluate((el) => {
			const after = getComputedStyle(el, "::after");
			return { width: after.width, content: after.content };
		});
		if (isMobile) {
			expect(area.width).toBe("44px");
		} else {
			expect(area.content).not.toBe('""');
		}
		await page.getByTestId("no-code").click();
		await expectSpot(
			page,
			"fastAddSearch",
			"Guida: Cerca per titolo e autore",
			"manual/new-book/#ricerca-per-titolo-e-autore",
		);
	});

	test("the import wizard: the guide of the step in sight", async ({ page }) => {
		await page.goto("/admin/imports/students");
		await waitForHydration(page);
		await expectSpot(
			page,
			"import.students.upload",
			"Guida: Importa studenti: File",
			"admin/guides/import-students/#preparare-il-file",
		);
		await page.goto("/admin/imports/catalog");
		await waitForHydration(page);
		await expect(spot(page, "import.catalog.upload")).toHaveAttribute(
			"href",
			`${DOCS}admin/guides/import-the-catalogue/#preparare-il-file`,
		);
		await page.goto("/admin/imports/photos");
		await waitForHydration(page);
		await expect(spot(page, "photosZip")).toHaveAttribute(
			"href",
			`${DOCS}admin/guides/import-photos/#caricare-larchivio`,
		);
		await expect(spot(page, "photosFolder")).toBeVisible();
		await expectAxeClean(page);
	});

	test("Backup: what a copy holds, the parts, the off-site copy and the restore", async ({
		page,
	}) => {
		await page.goto("/admin/backups");
		await waitForHydration(page);
		await expectAxeClean(page);
		await expectSpot(
			page,
			"backupContents",
			"Guida: Cosa contiene il backup",
			"admin/screens/backups/#cosa-contiene-il-backup",
		);
		for (const [key, anchor] of [
			["backupParts", "backup-o-esportazione-di-alcune-parti"],
			["backupOffsite", "copia-esterna"],
			["backupRestore", "ripristino"],
		]) {
			await expect(spot(page, key ?? "")).toHaveAttribute(
				"href",
				`${DOCS}admin/screens/backups/#${anchor}`,
			);
		}
	});

	test("labels sheets and language packs in the settings", async ({ page }) => {
		await page.goto("/admin/config/labels");
		await waitForHydration(page);
		await expect(spot(page, "labelStocks")).toHaveAttribute(
			"href",
			`${DOCS}admin/guides/add-a-label-stock/#inserire-il-foglio`,
		);
		await page.goto("/admin/config/ui");
		await waitForHydration(page);
		await expect(spot(page, "languagePacks")).toHaveAttribute(
			"href",
			`${DOCS}admin/guides/add-a-language/#caricare-il-pacchetto`,
		);
		await page.goto("/admin/appearance");
		await waitForHydration(page);
		await expect(spot(page, "languageInstall")).toHaveAttribute(
			"href",
			`${DOCS}admin/guides/add-a-language/#installare-una-lingua-dallelenco`,
		);
	});

	test("the label printing dialog", async ({ page }) => {
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("tile-pending-labels").click();
		await expect(page.getByTestId("label-print-dialog")).toBeVisible();
		await expect(spot(page, "labelsPrint")).toHaveAttribute(
			"href",
			`${DOCS}guide/print-book-labels/#procedura`,
		);
	});

	test("the form of Nuovo libro and the cover camera", async ({ page }) => {
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		await page.getByTestId("manual-entry").click();
		await expectSpot(
			page,
			"fastAddForm",
			"Guida: Controllo della scheda e aggiunta delle copie",
			"manual/new-book/#passo-scheda-e-copie",
		);
		await page.getByTestId("form-cover-photo").click();
		await expect(page.getByTestId("cover-panel")).toBeVisible();
		await expect(spot(page, "coverCapture")).toHaveAttribute(
			"href",
			`${DOCS}guide/add-a-cover/#fotografare-o-caricare-la-copertina`,
		);
	});
});
