// SPDX-License-Identifier: GPL-3.0-or-later
// What the PDF runs of the documentation share (`pdf.spec.ts` for the section Norme, `manual-pdf.spec.ts` for
// the manual): a print page of the built site printed on A4 with page numbers to the file it names in
// `<meta name="bv-pdf">`, a path under `site/dist/`.
import { statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

export const DIST = resolve("site", "dist");

/** Prints the print page at `url` and returns the file it wrote. */
export async function printPage(page: Page, url: string): Promise<string> {
	await page.goto(url);
	await page.evaluate(() => document.fonts.ready);
	// every picture is loaded before the page is printed
	await page.evaluate(() =>
		Promise.all(
			[...document.images].map((img) =>
				img.complete
					? Promise.resolve()
					: new Promise<void>((done) => {
							img.onload = img.onerror = () => done();
						}),
			),
		),
	);
	const name = await page.locator('meta[name="bv-pdf"]').getAttribute("content");
	expect(name).toMatch(/^[a-z0-9/.-]+\.pdf$/);
	const out = join(DIST, name!);
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
	return out;
}
