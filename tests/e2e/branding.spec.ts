// SPDX-License-Identifier: GPL-3.0-or-later
// Library logo and branding (step 4.10): the library's logo at the top left of every page (sidebar
// on desktop, top bar on phones), the BiblioViva logo only on the dashboard at twice the size of
// a page icon, a neutral icon when no logo is uploaded. One project only: the logo is shared
// configuration, and the phone layout is checked by resizing the window.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

test.describe.serial("library logo", () => {
	test("upload, shown top left everywhere, removed", async ({ page, isMobile }) => {
		test.skip(isMobile, "the logo is shared configuration: one project changes it");
		await page.goto("/admin/appearance");
		await waitForHydration(page);
		await expect(page.getByTestId("library-logo-placeholder").first()).toBeVisible();
		// a file that is not an image is refused with a readable message
		await page.getByTestId("logo-file").setInputFiles({
			name: "logo.png",
			mimeType: "image/png",
			buffer: Buffer.from("not an image at all"),
		});
		await expect(page.getByTestId("logo-error")).toHaveText("Il file non è un'immagine.");

		await page.getByTestId("logo-file").setInputFiles({
			name: "logo.jpg",
			mimeType: "image/jpeg",
			buffer: readFileSync("tests/fixtures/images/landscape.jpg"),
		});
		await expect(page.getByRole("status").getByText("Logo salvato.")).toBeVisible();
		await expect(page.getByTestId("logo-preview")).toBeVisible();
		await expectAxeClean(page);

		// top left on another page, and served as PNG
		await page.goto("/catalog");
		await waitForHydration(page);
		const logo = page.getByTestId("sidebar").getByTestId("library-logo");
		await expect(logo).toBeVisible();
		const src = (await logo.getAttribute("src")) ?? "";
		expect(src).toMatch(/^\/media\/branding\/logo\?v=\d+$/);
		const served = await page.request.get(src);
		expect(served.headers()["content-type"]).toBe("image/png");
		await expect(page.getByTestId("page-logo")).toHaveCount(0);

		// the dashboard: the BiblioViva logo in the header, 48 px; the help and the account stay
		// on the title's row as on every page (a long title wraps beside them), and on a window
		// where the title fits the top band is as high as another page's (the about page)
		const middle = async (testid: string): Promise<number> => {
			const box = await page.getByTestId(testid).boundingBox();
			return (box?.y ?? 0) + (box?.height ?? 0) / 2;
		};
		const bar = async (path: string): Promise<{ band?: number; offset: number }> => {
			await page.goto(path);
			await waitForHydration(page);
			return {
				band: (await page.getByTestId("app-bar").boundingBox())?.height,
				offset: (await middle("help-link")) - (await middle("page-header-bar")),
			};
		};
		expect(Math.abs((await bar("/")).offset)).toBeLessThan(2);
		const mark = page.getByTestId("page-logo");
		await expect(mark).toBeVisible();
		expect((await mark.boundingBox())?.width).toBe(48);
		await expect(page.getByTestId("page-brand")).toHaveText("BiblioViva");
		await page.setViewportSize({ width: 1920, height: 1080 });
		expect((await bar("/")).band).toBe((await bar("/about")).band);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto("/");
		await waitForHydration(page);

		// phone-sized window: the library's logo and name in the top bar
		await page.setViewportSize({ width: 412, height: 915 });
		await expect(page.getByTestId("brand-mobile").getByTestId("library-logo")).toBeVisible();
		await expect(page.getByTestId("brand-mobile-library")).toBeVisible();
		// on a phone the header keeps the logo too, smaller (owner request), like the page icons
		await expect(page.getByTestId("page-logo")).toBeVisible();
		expect((await page.getByTestId("page-logo").boundingBox())?.width).toBe(48);
		await page.setViewportSize({ width: 1280, height: 800 });

		// removed: the neutral icon comes back
		await page.goto("/admin/appearance");
		await waitForHydration(page);
		await page.getByTestId("logo-remove").click();
		await expect(page.getByRole("status").getByText("Logo rimosso.")).toBeVisible();
		await expect(
			page.getByTestId("sidebar").getByTestId("library-logo-placeholder"),
		).toBeVisible();
		expect((await page.request.get(src)).status()).toBe(404);
	});
});
