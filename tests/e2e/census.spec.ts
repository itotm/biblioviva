// SPDX-License-Identifier: GPL-3.0-or-later
// Photo census (step 2.4): pick a class, photograph three patrons in a row with the fake camera,
// the flow advances by itself; quick-add a patron and photograph them too.
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { seededClassId } from "./helpers/data.js";

test.describe.serial("photo census", () => {
	test("enrols three patrons in sequence and quick-adds a fourth", async ({ page, isMobile }) => {
		// desktop and mobile run in parallel on the same database: each project owns one class
		const section = isMobile ? "B" : "A";
		test.setTimeout(120_000);
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByTestId("area-patrons-tab-census").click();
		await expect(page).toHaveURL(/\/census$/);
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Censimento foto");
		await expectAxeClean(page);

		// pick class 1 A / 1 B (seeded)
		const group = page.getByTestId(`census-group-1${section}`);
		await expect(group).toContainText(/\d+ di \d+ con foto/);
		// the seed gives about half of the patrons a photo: start from the class's own count
		const before = Number(/(\d+) di \d+ con foto/.exec(await group.innerText())?.[1]);
		await group.click();
		await expect(page.getByTestId("census-progress")).toContainText(`${before} di`);

		// open the first patron without a photo; afterwards the flow advances by itself
		await page
			.locator('[data-testid^="census-patron-"][data-has-photo="false"]')
			.first()
			.click();
		for (let i = 0; i < 3; i++) {
			const heading = (await page.getByTestId("census-current").innerText()).trim();
			const name = heading.replace(/^Foto di /, "");
			await page.getByTestId("photo-snapshot").click();
			await page.getByTestId("photo-use").click();
			await expect(page.getByRole("status").getByText(`Foto salvata: ${name}`)).toBeVisible();
			await expect(page.getByTestId("census-progress")).toContainText(`${before + i + 1} di`);
			// the flow moved on to another patron without a photo
			await expect(page.getByTestId("census-current")).not.toContainText(name);
		}

		// quick add: created in the same class, camera opens on them
		await page.getByTestId("census-done").click();
		await page.getByTestId("census-quick-add").click();
		await page.getByTestId("quick-last").fill(`Censimento${section}`);
		await page.getByTestId("quick-first").fill("Nuovo");
		await page.getByTestId("quick-create").click();
		await expect(page.getByTestId("census-current")).toContainText(
			`Censimento${section} Nuovo`,
		);
		await page.getByTestId("photo-snapshot").click();
		await page.getByTestId("photo-use").click();
		await expect(
			page.getByRole("status").getByText(`Foto salvata: Censimento${section} Nuovo`),
		).toBeVisible();
		await expect(page.getByTestId("census-progress")).toContainText(`${before + 4} di`);

		// the stage (full-screen on phones) is still open on the next patron: close it first
		if (await page.getByTestId("census-done").isVisible()) {
			await page.getByTestId("census-done").click();
		}
		// the class is in the address: the back button returns to the classes (9.13, round 16)
		await expect(page).toHaveURL(new RegExp(`/census\\?group=${seededClassId(1, section)}$`));
		await page.getByTestId("page-back").click();
		await expect(page.getByTestId(`census-group-1${section}`)).toContainText(
			`${before + 4} di`,
		);
	});
});
