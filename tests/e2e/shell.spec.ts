// SPDX-License-Identifier: GPL-3.0-or-later
// App shell (step 1.5): navigation on both viewports, keyboard access, permission gating, logout.
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

test.describe("app shell", () => {
	test("navigation shows every area to the admin and reaches each page", async ({
		page,
		isMobile,
	}) => {
		await page.goto("/");
		await waitForHydration(page);
		const nav = page.getByTestId(isMobile ? "bottom-nav" : "sidebar");
		await expect(nav).toBeVisible();
		await expect(page.getByTestId(isMobile ? "sidebar" : "bottom-nav")).toBeHidden();
		await expectAxeClean(page);

		await nav.getByRole("link", { name: "Catalogo" }).click();
		await expect(page).toHaveURL(/\/catalog$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catalogo");
		await expect(nav.getByRole("link", { name: "Catalogo" })).toHaveAttribute(
			"aria-current",
			"page",
		);

		if (isMobile) {
			await page.getByTestId("more-menu").click();
			await page.getByRole("menuitem", { name: "Report" }).click();
		} else {
			await nav.getByRole("link", { name: "Report" }).click();
		}
		await expect(page).toHaveURL(/\/reports$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Report");
		await expectAxeClean(page);
	});

	test("a tap anywhere on an entry of the phone's menu opens its page", async ({
		page,
		isMobile,
	}) => {
		test.skip(!isMobile, "the menu of the bottom bar");
		await page.goto("/");
		await waitForHydration(page);
		for (const [name, path] of [
			["Stampe", /\/print-lists$/],
			["Report", /\/reports$/],
		] as const) {
			await page.getByTestId("more-menu").tap();
			const entry = page.getByRole("menuitem", { name });
			const box = await entry.boundingBox();
			// the far end of the row, past the words and near its edge: a finger lands anywhere
			await entry.tap({
				position: { x: (box?.width ?? 0) - 6, y: (box?.height ?? 0) - 3 },
			});
			await expect(page).toHaveURL(path);
		}
	});

	test("pages use the width of a large window (step 9.0)", async ({ page, isMobile }) => {
		test.skip(isMobile, "desktop windows only");
		const widthOf = async (): Promise<number> =>
			(await page.locator("main").last().boundingBox())?.width ?? 0;
		await page.goto("/catalog");
		await waitForHydration(page);
		const reference = await widthOf();
		await page.setViewportSize({ width: 1920, height: 1080 });
		const wide = await widthOf();
		expect(wide).toBeGreaterThan(reference + 300);
		// never wider than the window without the sidebar: no horizontal scroll
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			1920,
		);
		await page.setViewportSize({ width: 1280, height: 800 });
		expect(await widthOf()).toBe(reference);
	});

	test("the top bar is one row of the same height and never widens the page", async ({
		page,
		isMobile,
	}) => {
		// 9.13, round 24: a long title or subtitle is cut short in the bar (a subtitle that did not
		// fit pushed the page wider than the window, its buttons out of reach); the views and the
		// actions are in the page's toolbar under the bar
		const heights = new Set<number | undefined>();
		for (const path of ["/", "/admin/exports", "/calendar", "/catalog/1"]) {
			await page.goto(path);
			await waitForHydration(page);
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
				path,
			).toBeLessThanOrEqual(0);
			if (!isMobile) {
				heights.add((await page.getByTestId("app-bar").boundingBox())?.height);
				await expect(page.getByTestId("app-bar").getByTestId("page-actions")).toHaveCount(
					0,
				);
			}
		}
		if (!isMobile) {
			expect(heights.size).toBe(1);
		}
		await page.goto("/calendar");
		await waitForHydration(page);
		const toolbar = page.getByTestId("page-toolbar");
		await expect(toolbar.getByTestId("desk-tabs")).toBeVisible();
		await expect(toolbar.getByTestId("calendar-new")).toBeVisible();
		// the views first; the actions on their right when the buttons fit there (the catalogue's
		// three pages), under them when not (the desk's six, a phone) (9.13, round 26)
		const tabs = await toolbar.getByTestId("desk-tabs").boundingBox();
		const action = await toolbar.getByTestId("calendar-new").boundingBox();
		expect(action?.y).toBeGreaterThanOrEqual((tabs?.y ?? 0) + (tabs?.height ?? 0));
		if (!isMobile) {
			await page.goto("/catalog");
			await waitForHydration(page);
			const views = await page.getByTestId("area-catalog-tabs").boundingBox();
			const add = await page.getByTestId("new-biblio").boundingBox();
			expect(add?.x).toBeGreaterThanOrEqual((views?.x ?? 0) + (views?.width ?? 0));
			expect(add?.y).toBeLessThan((views?.y ?? 0) + (views?.height ?? 0));
		}
	});

	test("bottom bar targets are at least 44 px tall on the phone", async ({ page, isMobile }) => {
		test.skip(!isMobile, "mobile only");
		await page.goto("/");
		await waitForHydration(page);
		for (const link of await page.getByTestId("bottom-nav").getByRole("link").all()) {
			const box = await link.boundingBox();
			expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
		}
	});

	test("the sidebar is keyboard navigable", async ({ page, isMobile }) => {
		test.skip(isMobile, "desktop only");
		await page.goto("/");
		await waitForHydration(page);
		const sidebar = page.getByTestId("sidebar");
		await sidebar.getByTestId("brand").focus();
		await page.keyboard.press("Tab");
		await expect(sidebar.getByRole("link", { name: "Prestiti" })).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
	});

	test("the user menu logs out", async ({ page }) => {
		// Own session: logging out the shared storage-state session would break the other tests.
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("admin", "admin-test-pw");
		await expect(page).toHaveURL(/\/$/);
		await page.getByTestId("user-menu").click();
		await page.getByRole("menuitem", { name: "Esci" }).click();
		await expect(page).toHaveURL(/\/login/);
		await page.goto("/");
		await waitForHydration(page);
		await expect(page).toHaveURL(/\/login/);
	});

	test("the help button opens the page of the screen in sight", async ({ page, isMobile }) => {
		await page.goto("/catalog");
		await waitForHydration(page);
		// the computer: "Guida" with its icon in the top bar; the phone: a round button of 44 px
		// right after the page title (9.47, Q140)
		const help = page.getByTestId(isMobile ? "help-link-mobile" : "help-link");
		await expect(help).toBeVisible();
		await expect(page.getByTestId(isMobile ? "help-link" : "help-link-mobile")).toBeHidden();
		await expect(help).toHaveAccessibleName("Guida");
		const box = await help.boundingBox();
		if (isMobile) {
			expect(box?.width).toBe(44);
			expect(box?.height).toBe(44);
			const title = await page.getByTestId("page-title").boundingBox();
			expect(Math.abs((box?.x ?? 0) - ((title?.x ?? 0) + (title?.width ?? 0)))).toBeLessThan(
				20,
			);
		} else {
			await expect(help).toHaveText("Guida");
			expect(box?.height).toBe(40);
		}
		await expect(help).toHaveAttribute("target", "_blank");
		await expect(help).toHaveAttribute(
			"href",
			/^https:\/\/docs\.biblioviva\.org\/it\/manual\/catalog\/$/,
		);
		await page.goto("/");
		await waitForHydration(page);
		await expect(page.getByTestId("help-link")).toHaveAttribute(
			"href",
			/\/it\/manual\/dashboard\/$/,
		);
		// each screen its own page, or its section of a larger one (9.67)
		const pages: [string, RegExp][] = [
			["/circulation/checkin", /\/it\/manual\/checkin\/$/],
			["/cataloging/new", /\/it\/manual\/new-book\/$/],
			["/patrons/1/edit", /\/it\/manual\/patron-record\/#modifica-utente$/],
			["/admin/config/circulation", /\/it\/admin\/screens\/configuration\/#prestiti$/],
		];
		for (const [url, href] of pages) {
			await page.goto(url);
			await waitForHydration(page);
			await expect(
				page.getByTestId(isMobile ? "help-link-mobile" : "help-link"),
			).toHaveAttribute("href", href);
		}
	});

	test("areas beyond the permissions are hidden", async ({ page, isMobile }) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("prestiti", "prestiti-test-pw");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		const nav = page.getByTestId(isMobile ? "bottom-nav" : "sidebar");
		await expect(nav.getByRole("link", { name: "Prestiti" })).toBeVisible();
		await expect(nav.getByRole("link", { name: "Amministrazione" })).toHaveCount(0);
		// Stampe needs `patrons` or `catalog` (9.13, round 16): a desk-only account has nothing there
		await expect(nav.getByRole("link", { name: "Stampe" })).toHaveCount(0);
		// Segnalazioni is for every account (9.18): in the sidebar, under "Altro" on a phone
		if (isMobile) {
			await expect(page.getByTestId("more-menu")).toBeVisible();
		} else {
			await expect(nav.getByRole("link", { name: "Segnalazioni" })).toBeVisible();
		}
		await expect(page.getByTestId("print-basket")).toHaveCount(0);
		await page.goto("/print-lists");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			/non è disponibile per l'account in uso/,
		);
	});

	test("the cards' account sees neither the catalogue nor the lists of books", async ({
		page,
		isMobile,
	}) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("tessere", "tessere-test-pw");
		await expect(page).toHaveURL(/\/$/);
		await waitForHydration(page);
		const nav = page.getByTestId(isMobile ? "bottom-nav" : "sidebar");
		await expect(nav.getByRole("link", { name: "Utenti" })).toBeVisible();
		await expect(nav.getByRole("link", { name: "Catalogo" })).toHaveCount(0);
		await page.goto("/catalog");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			/non è disponibile per l'account in uso/,
		);
		// Stampe: the lists of patrons and the classes, nothing of books
		await page.goto("/print-lists");
		await waitForHydration(page);
		await expect(page.getByTestId("new-patron-list")).toBeVisible();
		await expect(page.getByTestId("new-item-list")).toHaveCount(0);
		await expect(page.getByTestId("kind-filter")).toHaveCount(0);
		await expect(page.getByTestId("print-classes")).toBeVisible();
	});
});
