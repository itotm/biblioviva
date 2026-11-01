// SPDX-License-Identifier: GPL-3.0-or-later
// The wait overlay (owner request): a slow page change covers the page's part of the window (the
// menu, the top bar and the bottom bar stay in sight) with a veil and "Caricamento…" in its centre
// until the page is there, without moving the bar or taking the focus; a slow login covers the
// whole window; a fast one shows nothing. The slow request is held by the test (it waits for a
// release), so the check does not depend on how fast the machine is.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

/** Holds the data request of `pathname` until the returned function is called. */
async function holdData(page: Page, pathname: string): Promise<() => void> {
	const { promise: held, resolve: release } = Promise.withResolvers<undefined>();
	await page.route(
		(url) => url.pathname === `${pathname}/__data.json`,
		async (route) => {
			await held;
			await route.continue();
		},
	);
	return () => {
		release(undefined);
	};
}

test.describe("wait overlay", () => {
	test("a slow page shows it until the page is there", async ({ page, isMobile }) => {
		await page.goto("/");
		await waitForHydration(page);
		const nav = page.getByTestId(isMobile ? "bottom-nav" : "sidebar");
		const indicator = page.getByTestId("wait-overlay");
		const veil = indicator.getByTestId("wait-veil");
		const pill = indicator.getByTestId("wait-card");
		await expect(indicator).toHaveAttribute("aria-live", "polite");
		await expect(pill).toHaveCount(0);
		const barBefore = await page.getByTestId("app-bar").boundingBox();

		const release = await holdData(page, "/catalog");
		await nav.getByRole("link", { name: "Catalogo" }).click();
		await expect(pill).toBeVisible();
		await expect(pill).toHaveText("Caricamento…");
		// over the page only: the bar keeps its size, the veil starts under it and beside the menu
		// (above the bottom bar on a phone), the wait is in its centre, and the focus stays
		// where it was
		const bar = await page.getByTestId("app-bar").boundingBox();
		expect(bar).toEqual(barBefore);
		const viewport = page.viewportSize() ?? { width: 0, height: 0 };
		const area = (await veil.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
		const menu = (await nav.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
		expect(Math.abs(area.y - ((bar?.y ?? 0) + (bar?.height ?? 0)))).toBeLessThan(1);
		if (isMobile) {
			expect(area.x).toBe(0);
			expect(area.width).toBe(viewport.width);
			expect(Math.abs(area.y + area.height - menu.y)).toBeLessThan(1);
		} else {
			expect(Math.abs(area.x - (menu.x + menu.width))).toBeLessThan(1);
			expect(Math.abs(area.x + area.width - viewport.width)).toBeLessThan(1);
			expect(Math.abs(area.y + area.height - viewport.height)).toBeLessThan(1);
		}
		const box = (await pill.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
		expect(Math.abs(box.x + box.width / 2 - (area.x + area.width / 2))).toBeLessThan(2);
		expect(Math.abs(box.y + box.height / 2 - (area.y + area.height / 2))).toBeLessThan(2);
		expect(
			await page.evaluate(() =>
				Boolean(document.activeElement?.closest('[data-testid="wait-overlay"]')),
			),
		).toBe(false);
		await expect(pill.locator("a, button, input, [tabindex]")).toHaveCount(0);
		await expectAxeClean(page);

		release();
		await expect(page).toHaveURL(/\/catalog$/);
		await expect(page.getByRole("searchbox", { name: "Cerca", exact: true })).toBeVisible();
		// it fades out, then it is gone
		await expect(pill).toHaveCount(0);
	});

	test("a fast page shows nothing once it is there", async ({ page, isMobile }) => {
		await page.goto("/catalog");
		await waitForHydration(page);
		const nav = page.getByTestId(isMobile ? "bottom-nav" : "sidebar");
		await nav.getByRole("link", { name: "Utenti" }).click();
		await expect(page).toHaveURL(/\/patrons$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Utenti");
		await expect(page.getByTestId("wait-overlay").getByTestId("wait-card")).toHaveCount(0);
	});

	test("a slow login shows it until the dashboard is there", async ({ browser }) => {
		// a session of its own: the shared one is already logged in
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		const page = await context.newPage();
		// the page itself must not fail while it waits (an effect that held the wait ran again
		// without end)
		const errors: string[] = [];
		page.on("pageerror", (e) => errors.push(e.message));
		try {
			await page.goto("/login");
			await waitForHydration(page);
			await page.waitForLoadState("networkidle");
			const { promise: held, resolve: release } = Promise.withResolvers<undefined>();
			await page.route(
				(url) => url.pathname.startsWith("/_app/remote/"),
				async (route) => {
					await held;
					await route.continue();
				},
			);
			await new LoginPage(page).loginAs("admin", "admin-test-pw");
			const card = page.getByTestId("wait-overlay").getByTestId("wait-card");
			await expect(card).toBeVisible();
			await expect(card).toHaveText("Caricamento…");
			// no app shell yet: the whole window
			const viewport = page.viewportSize() ?? { width: 0, height: 0 };
			expect(await page.getByTestId("wait-veil").boundingBox()).toEqual({
				x: 0,
				y: 0,
				width: viewport.width,
				height: viewport.height,
			});
			release(undefined);
			await expect(page).toHaveURL(/\/$/);
			await expect(card).toHaveCount(0);
			expect(errors).toEqual([]);
		} finally {
			await context.close();
		}
	});

	test("the turning icon stands still when the system asks for less motion", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/dev/ui");
		const icon = page.getByTestId("ui-waits").locator("svg.text-primary-500").last();
		// an endless animation shortened to nothing would flicker: it runs once
		await expect(icon).toHaveCSS("animation-iteration-count", "1");
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await expect(icon).toHaveCSS("animation-iteration-count", "infinite");
		await expect(icon).toHaveCSS("animation-duration", "1.8s");
	});
});
