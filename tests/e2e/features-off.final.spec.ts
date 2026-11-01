// SPDX-License-Identifier: GPL-3.0-or-later
// Patron photos and book covers switched off and on again (step 9.38, Q135), run once after the
// other specs (project `final`): the switches are shared configuration. Off, the census and the
// photo import leave the tabs and answer 404, the patron and record pages lose the photo and the
// cover, the media answer the placeholder, the cards print without the photo box; on again,
// everything is back.
import { expect, test, type Page } from "@playwright/test";
import { createBook, createPatron } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";

async function setSwitch(page: Page, section: "photos" | "covers", on: boolean): Promise<void> {
	await page.goto(`/admin/config/${section}`);
	await waitForHydration(page);
	const box = page.getByTestId(`setting-${section}.enabled`);
	await expect(box).toBeChecked({ checked: !on });
	await box.setChecked(on);
	await page.getByTestId("section-save").click();
	await expect(page.getByRole("status").first()).toBeVisible();
	await page.reload();
	await waitForHydration(page);
	await expect(page.getByTestId(`setting-${section}.enabled`)).toBeChecked({ checked: on });
}

test.describe.serial("photos and covers switched off", () => {
	test("everything about them goes, and comes back when switched on", async ({ page }) => {
		const patron = await createPatron(page, "Senzafoto");
		const book = await createBook(page, "Libro senza copertina", 1);

		await setSwitch(page, "photos", false);
		await setSwitch(page, "covers", false);

		// photos: no census tab, no census or photo import page, no photo on the patron's page
		await page.goto("/patrons");
		await waitForHydration(page);
		await expect(page.getByTestId("area-patrons-tab-patrons")).toHaveCount(0);
		await expect(page.getByTestId("area-patrons-tab-census")).toHaveCount(0);
		expect((await page.goto("/census"))?.status()).toBe(404);
		expect((await page.goto("/admin/imports/photos"))?.status()).toBe(404);
		await page.goto(`/patrons/${String(patron.id)}`);
		await waitForHydration(page);
		await expect(page.getByTestId("patron-card")).toBeVisible();
		await expect(page.getByTestId("photo-toggle")).toHaveCount(0);
		await expect(page.getByTestId("patron-photo-placeholder")).toHaveCount(0);
		await page.goto("/patrons/new");
		await waitForHydration(page);
		await expect(page.getByTestId("new-photo")).toHaveCount(0);
		const photo = await page.request.get(`/media/patrons/${String(patron.id)}/main`);
		expect(photo.headers()["content-type"]).toContain("image/svg+xml");
		// the card is the shipped one without the photo
		const cards = await (
			await page.request.get(`/print/cards?ids=${String(patron.id)}`)
		).text();
		expect(cards).toContain("Senzafoto");
		expect(cards).not.toContain("background-color:#dddddd");

		// covers: none on the record page, none looked up while cataloguing
		await page.goto(book.url);
		await waitForHydration(page);
		await expect(page.getByTestId("cover-open")).toHaveCount(0);
		await expect(page.getByTestId("cover-placeholder")).toHaveCount(0);
		await page.goto("/admin/config/covers");
		await waitForHydration(page);
		await expect(page.getByTestId("cover-providers-off")).toBeVisible();

		// on again: the census, the photo and the cover are back
		await setSwitch(page, "photos", true);
		await setSwitch(page, "covers", true);
		await page.goto("/patrons");
		await waitForHydration(page);
		await expect(page.getByTestId("area-patrons-tab-census")).toBeVisible();
		await page.goto(`/patrons/${String(patron.id)}`);
		await waitForHydration(page);
		await expect(page.getByTestId("photo-toggle")).toBeVisible();
		await page.goto(book.url);
		await waitForHydration(page);
		await expect(page.getByTestId("cover-open")).toBeVisible();
		const back = await (await page.request.get(`/print/cards?ids=${String(patron.id)}`)).text();
		expect(back).toContain("background-color:#dddddd");
	});
});
