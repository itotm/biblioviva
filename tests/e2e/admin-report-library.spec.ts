// SPDX-License-Identifier: GPL-3.0-or-later
// Reports library (step 11.9): a built-in definition downloaded, uploaded again under a new id,
// tried with its page, a definition with a wrong column refused before it is installed, the added
// one deleted. The configuration is shared: only the desktop project changes it, and it ends as it
// started.
import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { savedDownload } from "./helpers/download.js";

test("reports library: download, upload, try, refuse, delete", async ({ page, isMobile }, info) => {
	await page.goto("/admin/config");
	await waitForHydration(page);
	await page.getByTestId("config-reports").click();
	await expect(page).toHaveURL(/\/admin\/config\/reports$/);
	await waitForHydration(page);
	const builtin = page.getByTestId("report-acquisitions-by-year");
	await expect(builtin.getByTestId("report-origin")).toHaveText("Fornito con BiblioViva");
	await expectAxeClean(page);
	test.skip(isMobile, "the configuration is shared: one project changes it");

	const [download] = await Promise.all([
		page.waitForEvent("download"),
		builtin.getByRole("link", { name: "Scarica" }).click(),
	]);
	const definition = JSON.parse(readFileSync(await savedDownload(download), "utf8")) as Record<
		string,
		unknown
	>;
	const upload = async (value: unknown, name: string): Promise<void> => {
		const path = info.outputPath(name);
		writeFileSync(path, JSON.stringify(value));
		await page.getByTestId("report-input").setInputFiles(path);
	};

	await upload(
		{ ...definition, id: "e2e-rotto", sql: "SELECT nope AS year, 1 AS copies FROM item" },
		"rotto.json",
	);
	await expect(page.getByTestId("report-upload-error")).toContainText("La query non funziona");
	await expect(page.getByTestId("report-e2e-rotto")).toHaveCount(0);

	await upload(
		{ ...definition, id: "e2e-copie", title: { it: "Copie (prova)", en: "Copies (test)" } },
		"copie.json",
	);
	await expect(page.getByRole("status").getByText("Report e2e-copie installato")).toBeVisible();
	const added = page.getByTestId("report-e2e-copie");
	await expect(added.getByTestId("report-origin")).toHaveText("Aggiunto");

	await added.getByRole("link", { name: "Prova" }).click();
	await expect(page).toHaveURL(/\/reports\/e2e-copie/);
	await waitForHydration(page);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("Copie (prova)");
	await expect(page.getByTestId("report-count")).toBeVisible();

	await page.goto("/admin/config/reports");
	await waitForHydration(page);
	await page.getByTestId("report-e2e-copie").getByTestId("report-remove").click();
	await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
	await expect(page.getByTestId("report-e2e-copie")).toHaveCount(0);
});
