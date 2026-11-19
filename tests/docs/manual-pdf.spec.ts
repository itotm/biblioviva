// SPDX-License-Identifier: GPL-3.0-or-later
// The manual as one PDF per language (step 9.5): the print page of each language (`/<lang>/manual/print/`,
// written by `scripts/site-build.ts`: every guide and screen of `docs/<lang>/manual/`, numbered, one page
// each) printed on A4 with page numbers into `site/dist/manual.<lang>.pdf`.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { DIST, printPage } from "./pdf-print.ts";

for (const lang of ["it", "en"]) {
	test(`prints the manual in ${lang}`, async ({ page }) => {
		test.setTimeout(300_000);
		const url = `/${lang}/manual/print/`;
		test.skip(!existsSync(join(DIST, url, "index.html")), `no print page in ${lang}`);
		await printPage(page, url);
		// one H1 for each chapter, and a chapter for every guide and screen
		const chapters = await page.locator("section.chapter").count();
		expect(chapters).toBeGreaterThan(10);
		expect(await page.locator("section.chapter > h1").count()).toBe(chapters);
		expect(await page.locator("main h1").count()).toBe(chapters);
	});
}
