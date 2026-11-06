// SPDX-License-Identifier: GPL-3.0-or-later
// About page (step 1.12): application data, and the way to the libraries in use, a technical page of
// the documentation (step 9.53).
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

test("shows the version and links the list of the libraries", async ({ page }) => {
	const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
	await page.goto("/about");
	await waitForHydration(page);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("Informazioni");
	await expect(page.getByTestId("about-version")).toHaveText(pkg.version);
	await expect(
		page
			.getByTestId("about-libraries")
			.getByRole("link", { name: "Apri l'elenco delle librerie" }),
	).toHaveAttribute("href", "https://docs.biblioviva.org/it/tech/libraries/");
	await expectAxeClean(page);
	await page.goto("/patrons");
	await waitForHydration(page);
	await page.getByTestId("user-menu").click();
	await page.getByRole("menuitem", { name: "Informazioni" }).click();
	await expect(page).toHaveURL(/\/about$/);
});
