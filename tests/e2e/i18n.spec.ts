// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from "@playwright/test";

test.describe("localization", () => {
	test("renders the configured language (Italian) with the right html lang", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("html")).toHaveAttribute("lang", "it");
		// the dashboard title is "BiblioViva – <library name>"; the nav is the localized part
		await expect(page.getByTestId("page-title")).toContainText("Biblioteca dell'Istituto");
		await expect(page.getByTestId("page-brand")).toHaveText("BiblioViva");
		await expect(page.getByTestId("brand-library")).toHaveText("Biblioteca dell'Istituto");
		await expect(
			page.getByTestId("sidebar").or(page.getByTestId("bottom-nav")).first(),
		).toContainText("Utenti");
	});

	test("the test-only ?lang override switches the whole page to English", async ({ page }) => {
		await page.goto("/?lang=en");
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await expect(
			page.getByTestId("sidebar").or(page.getByTestId("bottom-nav")).first(),
		).toContainText("Patrons");
	});

	test("error pages are localized", async ({ page }) => {
		await page.goto("/this-page-does-not-exist");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pagina non trovata");
		await page.goto("/this-page-does-not-exist?lang=en");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
	});
});
