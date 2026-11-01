// SPDX-License-Identifier: GPL-3.0-or-later
// Catalogue import and migration from Koha (steps 3.9, 9.19): a Koha-shaped file with legacy
// barcodes and call numbers cannot be imported while a row has an error, imports after "usa i
// valori speciali", the titles appear in the catalogue; a file without keys and classification
// says what happens and imports with generated barcodes, labels offered, books to classify; copies
// in different classes raise the class-per-copy question ("no" turns them into errors: the "yes"
// path changes the configuration for the whole run, so it is covered by the unit tests); the open
// loans of the switch are imported by the admin, without dates too.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { seededClassId } from "./helpers/data.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");
const HEADER = [
	"biblio_key",
	"title",
	"author",
	"publisher",
	"publication_year",
	"classification",
	"reading_level",
	"barcode",
	"call_number",
	"item_type",
	"acquisition_date",
];

function tsv(
	name: string,
	rows: string[][],
): { name: string; mimeType: string; buffer: Buffer<ArrayBuffer> } {
	const body = [HEADER, ...rows].map((r) => r.join("\t")).join("\n");
	return { name, mimeType: "text/tab-separated-values", buffer: Buffer.from(body, "utf8") };
}

/** A Koha-shaped export: legacy barcodes of this project, Koha call numbers, one publisher missing. */
function kohaFile(page: Page): ReturnType<typeof tsv> {
	const t = tagOf(page);
	const code = t === "Mob" ? "81" : "82";
	return tsv(`koha-${t}.tsv`, [
		[
			`${code}01`,
			`Migrato ${t} uno`,
			"Delitto, Anna",
			"Einaudi",
			"2018",
			"B",
			"4",
			`${code}01`,
			"B 4 DEL",
			"libro",
			"2018-10-01",
		],
		[
			`${code}01`,
			`Migrato ${t} uno`,
			"Delitto, Anna",
			"Einaudi",
			"2018",
			"B",
			"4",
			`${code}02`,
			"B 4 DEL",
			"libro",
			"2018-10-01",
		],
		[
			`${code}02`,
			`Migrato ${t} animali`,
			"Rossi, Anna",
			"",
			"2020",
			"590",
			"S",
			`20${code}-0001`,
			"590 ROS",
			"libro",
			"15/03/2020",
		],
	]);
}

test.describe.serial("catalogue import", () => {
	test("imports a Koha export once its errors are resolved", async ({ page }) => {
		const t = tagOf(page);
		// the imports live in Administration (9.13, round 13): no button in the catalogue any more
		await page.goto("/catalog");
		await waitForHydration(page);
		await expect(page.getByTestId("open-import")).toHaveCount(0);
		await page.goto("/admin");
		await waitForHydration(page);
		await page.getByTestId("admin-section-imports").click();
		await expect(page).toHaveURL(/\/admin\/imports$/);
		await page.getByTestId("imports-catalog").click();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Importa il catalogo");
		await expectAxeClean(page);

		await page.getByTestId("csv-file").setInputFiles(kohaFile(page));
		await page.getByTestId("upload-submit").click();
		await expect(page.getByTestId("mapping-step")).toBeVisible();
		await expect(page.getByTestId("upload-info")).toContainText("3 righe");
		await expect(page.getByTestId("map-column-0")).toHaveValue("biblioKey");
		await expect(page.getByTestId("map-column-5")).toHaveValue("classification");
		await expectAxeClean(page);

		// the missing publisher is an error: "Importa" stays disabled
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("preview-step")).toBeVisible();
		await expect(page.getByTestId("counts")).toContainText("1 errore");
		await expect(page.getByTestId("preview-verdict")).toContainText("Correggere gli errori");
		await expect(page.getByTestId("data-grid").getByText(/Manca l'editore/)).toBeVisible();
		await expect(page.getByTestId("commit")).toBeDisabled();

		// back to the columns: allow the special values and check again
		await page.getByRole("button", { name: "Torna alle colonne" }).click();
		await page.getByTestId("special-values").check();
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("counts")).toContainText("3 nuovi");
		await expect(page.getByTestId("titles-count")).toContainText("2 titoli nuovi");
		await expect(page.getByTestId("preview-verdict")).toContainText("Nessun errore");
		await expectAxeClean(page);
		await page.getByTestId("commit").click();
		await expect(page.getByTestId("done-step")).toBeVisible();
		await expect(page.getByTestId("done-summary")).toContainText(
			"2 titoli nuovi, 3 copie aggiunte",
		);
		// every copy had a barcode: no labels to print
		await expect(page.getByTestId("done-labels")).toHaveCount(0);

		await page.getByTestId("done-open").click();
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(`Migrato ${t} animali`);
		const row = page.getByTestId("data-grid").getByText(`Migrato ${t} animali`);
		await expect(row).toBeVisible();
		await row.click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(page.getByTestId("items-table")).toContainText("590 ROS");
	});

	test("copies of one title in different classes raise the class-per-copy question", async ({
		page,
	}) => {
		const t = tagOf(page);
		await page.goto("/admin/imports/catalog");
		await waitForHydration(page);
		await page.getByTestId("csv-file").setInputFiles(
			tsv(`classi-${t}.tsv`, [
				[
					"9001",
					`Classi ${t}`,
					"Verdi, Ugo",
					"Giunti",
					"2019",
					"D",
					"3",
					"",
					"",
					"libro",
					"",
				],
				[
					"9001",
					`Classi ${t}`,
					"Verdi, Ugo",
					"Giunti",
					"2019",
					"D",
					"4",
					"",
					"",
					"libro",
					"",
				],
			]),
		);
		await page.getByTestId("upload-submit").click();
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("class-question")).toContainText("In 1 titolo");
		await expect(page.getByTestId("commit")).toBeDisabled();
		await expectAxeClean(page);
		await page.getByTestId("class-question-no").click();
		await expect(
			page
				.getByTestId("data-grid")
				.getByText(/senza livello per copia/)
				.first(),
		).toBeVisible();
		await expect(page.getByTestId("commit")).toBeDisabled();
	});

	test("a file without keys or classification: barcodes generated, books to classify", async ({
		page,
	}) => {
		const t = tagOf(page);
		await page.goto("/admin/imports/catalog");
		await waitForHydration(page);
		// the template with the required columns and the ISBN
		await page.getByTestId("template-column-isbn").check();
		await expect(page.getByTestId("template-preview")).toHaveText(
			"title;author;publisher;isbn",
		);
		await page.getByTestId("csv-file").setInputFiles({
			name: `nuovi-${t}.csv`,
			mimeType: "text/csv",
			buffer: Buffer.from(
				[
					"title;author;publisher",
					`Senza chiavi ${t} uno;Bianchi, Ada;Giunti`,
					`Senza chiavi ${t} due;Neri, Bruno;Salani`,
				].join("\n"),
				"utf8",
			),
		});
		await page.getByTestId("upload-submit").click();
		for (const key of ["biblioKey", "barcode", "classification"]) {
			await expect(page.getByTestId(`missing-key-${key}`)).toBeVisible();
		}
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("generated-barcodes")).toContainText("2 copie senza codice");
		await expect(page.getByTestId("to-classify")).toContainText("2 titoli nuovi");
		await expectAxeClean(page);
		await page.getByTestId("commit").click();
		await expect(page.getByTestId("done-step")).toBeVisible();
		await page.goto("/catalog/to-classify");
		await waitForHydration(page);
		await expect(page.getByText(`Senza chiavi ${t} uno`, { exact: true })).toBeVisible();
	});

	test("the administrator imports the open loans of the switch", async ({ page, isMobile }) => {
		test.skip(isMobile, "one run is enough for a one-off migration page");
		// a card of the seed and a copy imported by the first test
		const csv = await page.request.get(
			`/export/patrons?format=csv&groupId=${seededClassId(1, "A")}`,
		);
		const card = (await csv.body())
			.subarray(3)
			.toString("utf8")
			.split("\r\n")[1]
			?.split(";")[4];
		expect(card).toMatch(/^[A-Z]\d{6}$/);
		await page.goto("/admin");
		await waitForHydration(page);
		await page.getByTestId("admin-section-imports").click();
		await page.getByTestId("imports-loans").click();
		await expect(page).toHaveURL(/\/admin\/imports\/loans$/);
		// the other imports are one tap away
		await expect(page.getByTestId("area-imports-tab-loans")).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			"Importa i prestiti in corso",
		);
		const body = [
			"card_number;barcode;issued_on;due_on",
			`${card};8201;2026-09-01;2099-10-01`,
			`${card};9999-9999;2026-09-01;2099-10-01`,
		].join("\n");
		await page.getByTestId("csv-file").setInputFiles({
			name: "loans.csv",
			mimeType: "text/csv",
			buffer: Buffer.from(body, "utf8"),
		});
		await page.getByTestId("upload-submit").click();
		await expect(page.getByTestId("map-column-0")).toHaveValue("cardNumber");
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("counts")).toContainText("1 errore");
		await expect(
			page.getByTestId("data-grid").getByText(/Nessuna copia con il codice 9999-9999/),
		).toBeVisible();
		await expect(page.getByTestId("commit")).toBeDisabled();
		await expectAxeClean(page);

		await page.getByRole("button", { name: "Torna alle colonne" }).click();
		await page.getByRole("button", { name: "Importa un altro file" }).click();
		// without dates: lent today, due as at the desk (9.19)
		await page.getByTestId("csv-file").setInputFiles({
			name: "loans.csv",
			mimeType: "text/csv",
			buffer: Buffer.from(`card_number;barcode\n${card};8201`, "utf8"),
		});
		await page.getByTestId("upload-submit").click();
		await expect(page.getByTestId("missing-issuedOn")).toBeVisible();
		await expect(page.getByTestId("missing-dueOn")).toBeVisible();
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("preview-verdict")).toContainText("Nessun errore");
		await page.getByTestId("commit").click();
		await expect(page.getByTestId("done-summary")).toContainText("1 prestito importato");
	});
});
