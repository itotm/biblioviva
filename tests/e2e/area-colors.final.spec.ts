// SPDX-License-Identifier: GPL-3.0-or-later
// The styles of the area colours (step 9.16), run once after the other specs (project `final`):
// the style is shared configuration. Filled, accents and "Nessun colore" change the bar; the
// default (tinted) is restored at the end.
import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";

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

async function chooseStyle(page: Page, style: string): Promise<void> {
	await page.goto("/admin/appearance");
	await waitForHydration(page);
	await page.getByTestId(`area-style-${style}`).click();
	await expect(page.getByTestId(`area-style-${style}`)).toHaveAttribute("aria-checked", "true");
}

test.describe.serial("area colour styles", () => {
	test("the style chosen on the Appearance page changes the bar", async ({ page }) => {
		await chooseStyle(page, "filled");
		await page.goto("/catalog");
		await waitForHydration(page);
		const deep = toRgb(await token(page, "--bv-area-catalog-deep"));
		await expect(page.locator(".bv-topbar")).toHaveCSS("background-color", deep);
		await expect(page.getByTestId("page-title")).toHaveCSS("color", "rgb(255, 255, 255)");

		await chooseStyle(page, "accents");
		await page.goto("/catalog");
		await waitForHydration(page);
		const bar = page.locator(".bv-topbar");
		await expect(bar).not.toHaveCSS("background-color", deep);
		expect(await bar.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("6px 0px 0px");

		await chooseStyle(page, "none");
		await page.goto("/catalog");
		await waitForHydration(page);
		await expect(page.locator("[data-area-style]").first()).not.toHaveAttribute(
			"data-area",
			/.+/,
		);

		await chooseStyle(page, "tinted");
		await page.goto("/catalog");
		await waitForHydration(page);
		await expect(page.locator("[data-area-style]").first()).toHaveAttribute(
			"data-area",
			"catalog",
		);
	});
});
