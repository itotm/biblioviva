// SPDX-License-Identifier: GPL-3.0-or-later
// The wishlist (step 9.15): reached from the desk tabs, the catalogue and the list checked while a
// wish is typed, the same book counted as a new request, a wish edited and counted again from the
// selection, "Cataloga" through "Nuovo libro" removes it; a cataloguer without the desk reaches it
// from the catalogue tabs and never sees who asked.
import { expect, test, type Page } from "@playwright/test";
import { LoginPage } from "./pages/login.page.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): string => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

async function addWish(page: Page, title: string, author: string): Promise<void> {
	await page.getByTestId("wish-title").fill(title);
	await page.getByTestId("wish-author").fill(author);
	await page.getByTestId("wish-save").click();
}

test.describe.serial("wishlist", () => {
	test("add, count again, edit and catalogue a wish", async ({ page }) => {
		const tag = tagOf(page);
		const title = `Desiderio ${tag}`;
		await page.goto("/circulation/checkout");
		await waitForHydration(page);
		await page.getByTestId("desk-tab-wishlist").click();
		await expect(page).toHaveURL(/\/wishlist$/);
		await waitForHydration(page);

		// an empty form is refused
		await page.getByTestId("wish-save").click();
		await expect(page.getByTestId("wish-problem")).toContainText("almeno il titolo");

		// the series of the demo data: the catalogue has its books, the list one wish already
		await page.getByTestId("wish-series").fill("Le avventure di Pepe Lampo");
		await expect(page.getByTestId("wish-similar-catalog").locator("li").first()).toBeVisible();
		await expect(page.getByTestId("wish-similar-wishes")).toContainText("Pepe Lampo · 12");
		await page.getByTestId("wish-series").fill("");

		await addWish(page, title, "Autore, Prova");
		await expect(page.getByRole("status").getByText("Desiderio aggiunto")).toBeVisible();
		await page.getByLabel("Cerca").fill(title.toLowerCase());
		const grid = page.getByTestId("wish-grid");
		await expect(grid.locator(".wx-row")).toHaveCount(1);
		// the same book typed again: one more request
		await addWish(page, title.toUpperCase(), "autore, prova");
		await expect(
			page.getByRole("status").getByText("Era già in lista: aggiunta una richiesta"),
		).toBeVisible();
		await expect(grid.locator(".wx-row")).toHaveCount(1);
		await expect(grid.locator(".wx-row").first()).toContainText("2");

		// +1 from the selection
		await grid
			.locator(".wx-row")
			.first()
			.click({ modifiers: ["Control"] });
		await page.getByTestId("wish-add-request").click();
		await expect(page.getByRole("status").getByText("1 richiesta aggiunta")).toBeVisible();
		await expect(grid.locator(".wx-row").first()).toContainText("3");

		// a click edits it (and leaves it selected for "Cataloga"); the selection is emptied first
		await grid
			.locator(".wx-row")
			.first()
			.click({ modifiers: ["Control"] });
		await grid.locator(".wx-row").first().click();
		await expect(page.getByTestId("wish-title")).toHaveValue(title);
		await page.getByTestId("wish-note").fill("Chiesto dalla 4 B");
		await page.getByTestId("wish-save").click();
		// (the phone shows three toasts at a time: the form going back to "new" is the sign)
		await expect(page.getByRole("heading", { name: "Nuovo desiderio" })).toBeVisible();
		await expect(grid.locator(".wx-row").first()).toContainText("Chiesto dalla 4 B");
		await page.getByTestId("wish-catalogue").click();
		await expect(page).toHaveURL(/\/cataloging\/new\?wish=\d+$/);
		await waitForHydration(page);
		await expect(page.getByTestId("from-wish")).toContainText(title);
		await page.getByTestId("no-code").click();
		await expect(page.getByTestId("search-title")).toHaveValue(title);
		await page.getByTestId("search-submit").click();
		await page.getByTestId("lookup-manual").click();
		await expect(page.getByLabel("Titolo", { exact: true })).toHaveValue(title);
		await expect(page.getByLabel("Autore", { exact: true })).toHaveValue("Autore, Prova");
		await page.getByTestId("quick-publisher").click();
		await page.getByTestId("genre-G").click();
		await page.getByTestId("biblio-submit").click();
		await expect(page.getByTestId("stage-done")).toBeVisible();
		// the wish leaves the list: the address loses `?wish=` and the banner goes (the toast may queue on a phone)
		await expect(page).toHaveURL(/\/cataloging\/new$/);
		await expect(page.getByTestId("from-wish")).toHaveCount(0);

		await page.goto("/wishlist");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(title.toLowerCase());
		await expect(page.getByTestId("wish-grid")).toHaveCount(0);
	});

	test("a cataloguer finds it in the catalogue tabs, without who asked", async ({ page }) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("catalogo", "catalogo-test-pw");
		await expect(page).toHaveURL(/\/$/);
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByTestId("area-catalog-tab-wishlist").click();
		await expect(page).toHaveURL(/\/wishlist$/);
		await waitForHydration(page);
		await expect(page.getByTestId("area-catalog-tab-wishlist")).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(page.getByTestId("wish-grid")).toBeVisible();
		await expect(
			page.getByTestId("wish-grid").getByText("Chiesto da", { exact: true }),
		).toHaveCount(0);
		await expect(page.getByTestId("wish-requester-picker")).toHaveCount(0);
	});
});
