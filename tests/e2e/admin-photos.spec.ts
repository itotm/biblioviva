// SPDX-License-Identifier: GPL-3.0-or-later
// Patron photos from Koha (step 3.9b): a ZIP archive with one photo of a seeded patron and one
// file without a patron, then the drop folder of the server; the summary lists what matched
// nobody. Desktop only: a one-off administration page.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { zipSync } from "fflate";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { seededClassId } from "./helpers/data.js";

async function cardsOf(
	request: APIRequestContext,
	level: number,
	section: "A" | "B" | "C" | "D",
): Promise<string[]> {
	const csv = await request.get(
		`/export/patrons?format=csv&groupId=${seededClassId(level, section)}`,
	);
	return (await csv.body())
		.subarray(3)
		.toString("utf8")
		.split("\r\n")
		.slice(1)
		.map((line) => line.split(";")[4] ?? "")
		.filter((card) => /^[A-Z0-9]+$/.test(card));
}

test.describe("patron photos from Koha", () => {
	test("imports a ZIP archive and the drop folder", async ({ page, isMobile }) => {
		test.skip(isMobile, "a one-off administration page");
		const [first, second] = await cardsOf(page.request, 4, "D");
		expect(first).toBeDefined();
		const photo = new Uint8Array(readFileSync("tests/fixtures/images/portrait-exif.jpg"));

		await page.goto("/admin");
		await waitForHydration(page);
		await page.getByTestId("admin-section-imports").click();
		await page.getByTestId("imports-photos").click();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			"Importa le foto degli utenti",
		);
		await expectAxeClean(page);

		const zip = zipSync({ [`${first}.jpg`]: photo, "0000000000.jpg": photo });
		await page.getByTestId("photos-zip-file").setInputFiles({
			name: "foto.zip",
			mimeType: "application/zip",
			buffer: Buffer.from(zip),
		});
		await page.getByTestId("photos-zip-submit").click();
		const text = page.getByTestId("photos-summary-text");
		await expect(text).toContainText("1 file senza utente");
		await expect(text).toContainText(/(1 foto importat[ae]|1 lasciat[ae])/);
		await expect(page.getByTestId("photos-unmatched")).toHaveAttribute(
			"download",
			"foto-senza-utente.csv",
		);

		// the drop folder of the server (DATA_DIR/imports/photos)
		const dir = join(process.env.BV_E2E_RUN_DIR ?? "", "data", "imports", "photos");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, `${second}.jpg`), photo);
		await page.reload();
		await waitForHydration(page);
		await expect(page.getByTestId("photos-folder")).toContainText("ora ce n'è 1");
		await page.getByTestId("photos-folder-submit").click();
		await expect(page.getByTestId("photos-summary-text")).toContainText("0 file senza utente");
	});
});
