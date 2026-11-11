// SPDX-License-Identifier: GPL-3.0-or-later
// MARC and the whole catalogue (step 9.65, Q156): «Mostra tutti i libri» lists the catalogue
// without a filter, page after page; its Esporta gives MARC; a MARC file of another system
// (MARC 21 in MARCXML, its copies in Koha's 952) goes through the catalogue import with a
// question — two copies of one title with different materials — and lands in the catalogue.
import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

/** A MARCXML file as Koha writes it: one title, two copies of different materials. */
function kohaFile(title: string, code: string): { name: string; mimeType: string; buffer: Buffer } {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim">
  <record>
    <leader>00000nam a2200000 i 4500</leader>
    <controlfield tag="001">${code}</controlfield>
    <datafield tag="100" ind1="1" ind2=" "><subfield code="a">Neri, Paola</subfield></datafield>
    <datafield tag="245" ind1="1" ind2="0"><subfield code="a">${title}</subfield></datafield>
    <datafield tag="264" ind1=" " ind2="1">
      <subfield code="a">Roma :</subfield><subfield code="b">Edizioni Prova,</subfield><subfield code="c">2021.</subfield>
    </datafield>
    <datafield tag="952" ind1=" " ind2=" ">
      <subfield code="8">B</subfield><subfield code="p">20${code}-0001</subfield><subfield code="y">libro</subfield>
    </datafield>
    <datafield tag="952" ind1=" " ind2=" ">
      <subfield code="8">B</subfield><subfield code="p">20${code}-0002</subfield><subfield code="y">dvd</subfield>
    </datafield>
  </record>
</collection>
`;
	return {
		name: `koha-${code}.xml`,
		mimeType: "application/xml",
		buffer: Buffer.from(xml, "utf8"),
	};
}

test.describe.serial("MARC and the whole catalogue", () => {
	test("shows the whole catalogue and exports it in MARC", async ({ page }) => {
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByTestId("show-all").click();
		await expect(page.getByTestId("biblio-count")).toContainText("nel catalogo");
		await expect(page.getByTestId("data-grid")).toBeVisible();
		// more titles than a page: the next ones on the server
		const pages = page.getByTestId("catalog-pages");
		if (await pages.isVisible()) {
			await expect(page.getByTestId("page-range")).toContainText(/^1–500 di /);
			await page.getByTestId("page-next").click();
			await expect(page.getByTestId("page-range")).toContainText(/^501–/);
			await page.getByTestId("page-previous").click();
		}
		await page.getByTestId("export-menu").click();
		const link = page.getByTestId("export-marc21-xml").getByRole("link");
		const href = (await link.getAttribute("href")) ?? "";
		expect(href).toContain("format=marc21-xml");
		const response = await page.request.get(href);
		expect(response.headers()["content-type"]).toContain("marcxml");
		const xml = await response.text();
		expect(xml).toContain('<collection xmlns="http://www.loc.gov/MARC21/slim">');
		expect(xml).toContain('<datafield tag="952"');
		await page.keyboard.press("Escape");
		// the filters cleared, the start page again
		await page.getByTestId("clear-filters").click();
		await expect(page.getByTestId("catalog-start")).toBeVisible();
	});

	test("imports a Koha MARC file once its question is answered", async ({ page }) => {
		const t = tagOf(page);
		const code = t === "Mob" ? "71" : "72";
		const title = `Marc ${t} ${String(Date.now()).slice(-6)}`;
		await page.goto("/admin/imports/catalog");
		await waitForHydration(page);
		await page.getByTestId("csv-file").setInputFiles(kohaFile(title, code));
		await page.getByTestId("upload-submit").click();
		await expect(page.getByTestId("mapping-step")).toBeVisible();
		await expect(page.getByTestId("upload-info")).toContainText("MARC 21 · MARCXML");
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("preview-step")).toBeVisible();
		await expect(page.getByTestId("commit")).toBeDisabled();
		await page.getByTestId("type-question-yes").click();
		await expect(page.getByTestId("commit")).toBeEnabled();
		await page.getByTestId("commit").click();
		await expect(page.getByTestId("done-step")).toBeVisible();

		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(title);
		await expect(page.getByTestId("data-grid").getByText(title)).toBeVisible();
		await page.getByLabel("Cerca").fill("");
	});
});
