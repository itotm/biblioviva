// SPDX-License-Identifier: GPL-3.0-or-later
// The section Normativa as one PDF per language (step 9.63, ADR-059): the print page of each language
// (`/<lang>/compliance/print/`, written by `scripts/site-build.ts`) printed on A4 with page numbers into
// `site/dist/<lang>/compliance/<name>.pdf`, the name the page carries in `<meta name="bv-pdf">`.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { DIST, printPage } from "./pdf-print.ts";

for (const lang of ["it", "en"]) {
	test(`prints the section Normativa in ${lang}`, async ({ page }) => {
		const url = `/${lang}/compliance/print/`;
		test.skip(!existsSync(join(DIST, url, "index.html")), `no print page in ${lang}`);
		await printPage(page, url);
		// every page of the section is a chapter of the file
		expect(await page.locator("section.chapter").count()).toBeGreaterThan(1);
	});
}
