// SPDX-License-Identifier: GPL-3.0-or-later
// The section Norme as one PDF per language (step 9.63, ADR-059): the print page of each language
// (`/<lang>/compliance/print/`, written by `scripts/site-build.ts`) printed on A4 with page numbers into
// `site/dist/<lang>/compliance/<name>.pdf`, the name the page carries in `<meta name="bv-pdf">`.
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";

const DIST = resolve("site", "dist");

for (const lang of ["it", "en"]) {
	test(`prints the section Norme in ${lang}`, async ({ page }) => {
		const url = `/${lang}/compliance/print/`;
		test.skip(!existsSync(join(DIST, url, "index.html")), `no print page in ${lang}`);
		await page.goto(url);
		await page.evaluate(() => document.fonts.ready);
		const name = await page.locator('meta[name="bv-pdf"]').getAttribute("content");
		expect(name).toMatch(/^[a-z-]+\.pdf$/);
		// every page of the section is a chapter of the file
		expect(await page.locator("section.chapter").count()).toBeGreaterThan(1);
		const out = join(DIST, lang, "compliance", name!);
		await page.pdf({
			path: out,
			format: "A4",
			printBackground: true,
			preferCSSPageSize: true,
			displayHeaderFooter: true,
			headerTemplate: "<span></span>",
			footerTemplate:
				'<div style="width:100%;font:8pt sans-serif;color:#6b7280;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
		});
		expect(statSync(out).size).toBeGreaterThan(10_000);
	});
}
