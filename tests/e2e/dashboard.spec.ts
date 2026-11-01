// SPDX-License-Identifier: GPL-3.0-or-later
// Dashboard (step 4.9): the tiles of the account's areas, each a link to where it is dealt with,
// the quick actions by permission, the loans due this week and today's activity.
import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/login.page.js";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

test.describe("dashboard", () => {
	test("the administrator sees every tile and every quick action", async ({ page }) => {
		await page.goto("/");
		await waitForHydration(page);
		// in this order: today's loans and returns first (9.13, round 25)
		const tiles = [
			"tile-issued-today",
			"tile-returned-today",
			"tile-open",
			"tile-overdue",
			"tile-without-card",
			"tile-without-photo",
			"tile-pending-labels",
			"tile-open-notes",
		];
		for (const tile of tiles) {
			await expect(page.getByTestId(tile).getByTestId("tile-value")).toHaveText(/^\d+$/);
		}
		expect(
			await page
				.getByTestId("dashboard-tiles")
				.locator("[data-testid^='tile-']:not([data-testid='tile-value'])")
				.evaluateAll((els) => els.slice(0, 4).map((e) => e.getAttribute("data-testid"))),
		).toEqual(tiles.slice(0, 4));
		// each action is named as the tab or the button it opens (9.13, round 35)
		await expect(page.getByTestId("quick-actions").getByRole("link")).toHaveText([
			"Prestiti",
			"Restituzioni",
			"Nuovo libro",
			"Nuovo utente",
			"Censimento foto",
			"Stampe",
			"Inventario",
			"Report",
			"Amministrazione",
		]);
		// the quick actions come first, the pinned staff notes under them (9.13, round 25)
		const order = await page
			.locator("main section[data-testid]")
			.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
		expect(order.slice(0, 2)).toEqual(["quick-actions", "pinned-notes"]);
		expect(order.indexOf("dashboard-tiles")).toBeGreaterThan(0);
		await expect(page.getByTestId("due-this-week")).toBeVisible();
		await expect(page.getByTestId("today-activity")).toBeVisible();
		await expectAxeClean(page);
		const open = Number(
			await page.getByTestId("tile-open").getByTestId("tile-value").innerText(),
		);
		expect(open).toBeGreaterThan(0);
		// the labels tile opens the printing dialog (9.13); the tiles name patrons explicitly
		await expect(page.getByTestId("tile-without-card")).toContainText(
			"Utenti senza tessera stampata",
		);
		await expect(page.getByTestId("tile-without-photo")).toContainText("Utenti senza foto");
		await page.getByTestId("tile-pending-labels").click();
		await expect(page.getByTestId("label-print-dialog")).toBeVisible();
		// printed from here, the pending labels can be marked as printed like those of a list (9.42);
		// not pressed: the shared test database keeps its pending labels for the other specs
		await expect(page.getByTestId("label-mark-printed")).toHaveCount(0);
		const popup = page.waitForEvent("popup");
		await page.getByTestId("label-print").click();
		await (await popup).close();
		await expect(page.getByTestId("label-mark-printed")).toBeVisible();
		await page.getByTestId("label-close").click();
		await expect(page.getByTestId("label-print-dialog")).toHaveCount(0);
		await page.getByTestId("tile-overdue").click();
		await expect(page).toHaveURL(/\/circulation\/overdues$/);
	});

	test("a cataloguing account sees only its own tiles and actions", async ({ page }) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("catalogo", "catalogo-test-pw");
		await expect(page).toHaveURL(/\/$/);
		await waitForHydration(page);
		await expect(page.getByTestId("tile-pending-labels")).toBeVisible();
		await expect(page.getByTestId("tile-open")).toHaveCount(0);
		await expect(page.getByTestId("tile-without-card")).toHaveCount(0);
		await expect(page.getByTestId("due-this-week")).toHaveCount(0);
		// the labels are printed from Stampe too: its quick action needs `catalog` or `patrons`
		await expect(page.getByTestId("quick-actions").getByRole("link")).toHaveText([
			"Nuovo libro",
			"Stampe",
			"Inventario",
		]);
	});
});
