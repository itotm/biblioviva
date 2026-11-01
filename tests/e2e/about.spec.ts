// SPDX-License-Identifier: GPL-3.0-or-later
// About page (step 1.12): application data and the generated list of libraries.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

test("shows the version and the pinned libraries", async ({ page }) => {
	const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
		version: string;
		devDependencies: Record<string, string>;
		dependencies: Record<string, string>;
	};
	await page.goto("/about");
	await waitForHydration(page);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("Informazioni");
	await expect(page.getByTestId("about-version")).toHaveText(pkg.version);
	await expect(page.getByTestId("deps-runtime")).toContainText("papaparse");
	await expect(page.getByTestId("deps-runtime")).toContainText(pkg.dependencies.papaparse!);
	await page.getByRole("group").getByText("Solo per lo sviluppo").click();
	await expect(page.getByTestId("deps-development")).toContainText("@sveltejs/kit");
	await expect(page.getByTestId("deps-development")).toContainText(
		pkg.devDependencies["@sveltejs/kit"]!,
	);
	await expect(page.getByTestId("deps-system")).toContainText("YAZ");
	await expectAxeClean(page);
	await page.goto("/patrons");
	await waitForHydration(page);
	await page.getByTestId("user-menu").click();
	await page.getByRole("menuitem", { name: "Informazioni" }).click();
	await expect(page).toHaveURL(/\/about$/);
});
