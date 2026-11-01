// SPDX-License-Identifier: GPL-3.0-or-later
// A colour for every area in the top bar (step 9.16): each area page carries its area and the
// bar takes its colour (the default style, tinted), the dashboard stays neutral. The styles of the
// Appearance page are tried in area-colors.final.spec.ts, once the other specs are done.
import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";

const AREAS = [
	["/circulation/checkout", "circulation"],
	["/catalog", "catalog"],
	["/census", "patrons"],
	["/print-lists", "printing"],
	["/notes", "notes"],
	["/reports", "reports"],
	["/admin", "admin"],
] as const;

/** The resolved value of a custom property on the shell. */
async function token(page: Page, name: string): Promise<string> {
	return page
		.locator("[data-area-style]")
		.first()
		.evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name);
}

const toRgb = (hex: string): string => {
	const n = Number.parseInt(hex.slice(1), 16);
	return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

test.describe.serial("area colours", () => {
	test("every area colours the bar, the dashboard stays neutral", async ({ page }) => {
		await page.goto("/");
		await waitForHydration(page);
		const shell = page.locator("[data-area-style]").first();
		await expect(shell).not.toHaveAttribute("data-area", /.+/);
		for (const [path, area] of AREAS) {
			await page.goto(path);
			await waitForHydration(page);
			await expect(shell).toHaveAttribute("data-area", area);
			const tint = toRgb(await token(page, `--bv-area-${area}-tint`));
			await expect(page.locator(".bv-topbar")).toHaveCSS("background-color", tint);
			// the page icon in the area's colour, with its name next to it (never colour alone)
			const strong = toRgb(await token(page, `--bv-area-${area}-strong`));
			await expect(page.getByTestId("page-icon")).toHaveCSS("background-color", strong);
			await expect(page.getByTestId("page-title")).not.toBeEmpty();
		}
	});
});
