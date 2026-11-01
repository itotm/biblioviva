// SPDX-License-Identifier: GPL-3.0-or-later
// Configurazione (step 11.2): the sections with the file each is written to, a setting saved from
// the generated form into its file, checked on the way (inline and by the schema), the section as
// JSON, the history with "Ripristina", "Torna al predefinito", and a change refused because it
// would take away an item type still in use. The configuration is shared: only the desktop
// project changes it, and every change is undone.
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

test.describe.serial("configuration area", () => {
	test("saves a setting in its file, checks the JSON, restores it from the history", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "the configuration is shared: one project changes it");
		await page.goto("/admin");
		await waitForHydration(page);
		// one entry per place (9.13, round 25): appearance and language, the classes and the print
		// templates are in the configuration, the closures in its calendar section
		for (const moved of ["appearance", "templates", "calendar", "classes"]) {
			await expect(page.getByTestId(`admin-section-${moved}`)).toHaveCount(0);
		}
		await page.getByTestId("admin-section-config").click();
		await expect(page).toHaveURL(/\/admin\/config$/);
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Configurazione");
		await expect(page.getByTestId("config-appearance")).toHaveAttribute(
			"href",
			"/admin/appearance",
		);
		await expect(page.getByTestId("config-classes")).toHaveAttribute("href", "/admin/classes");
		await expect(page.getByTestId("config-templates")).toBeVisible();
		await expect(page.getByTestId("config-section-privacy")).toContainText("config.json");
		await expect(page.getByTestId("config-section-classification")).toContainText(
			"classification.json",
		);
		await expectAxeClean(page);

		await page.getByTestId("config-section-privacy").click();
		await expect(page).toHaveURL(/\/admin\/config\/privacy$/);
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
		const months = page.getByTestId("setting-privacy.auditRetentionMonths");
		await expect(months).toHaveValue("24");
		await months.fill("0");
		await expect(page.getByTestId("field-error-privacy.auditRetentionMonths")).toHaveText(
			"Almeno 1.",
		);
		await expect(page.getByTestId("section-save")).toBeDisabled();
		await months.fill("30");
		await expect(page.getByTestId("section-dirty")).toBeVisible();
		await expectAxeClean(page);
		await page.getByTestId("section-save").click();
		await expect(page.getByRole("status").getByText("Impostazioni salvate")).toBeVisible();
		await page.reload();
		await waitForHydration(page);
		await expect(page.getByTestId("setting-privacy.auditRetentionMonths")).toHaveValue("30");

		// the JSON of the section, checked while typing
		await page.getByTestId("section-tab-json").click();
		const text = page.getByTestId("section-json-text");
		await expect(text).toHaveValue(/"auditRetentionMonths": 30/);
		await text.fill("{ nope");
		await expect(page.getByTestId("section-json-parse-error")).toBeVisible();
		await text.fill('{ "auditRetentionMonths": 0 }');
		await expect(page.getByTestId("section-json-issues")).toContainText(
			"privacy.auditRetentionMonths",
		);
		await expect(page.getByTestId("section-json-save")).toBeDisabled();
		await page.getByTestId("section-json-discard").click();

		// the history puts the previous version back
		await page.goto("/admin/config/history");
		await waitForHydration(page);
		const change = page
			.getByTestId("history-row")
			.filter({ hasText: "Sezione «Privacy»" })
			.first();
		await expect(change).toContainText("config.json");
		await change.getByTestId("history-revert").click();
		await page.getByTestId("confirm-button").click();
		await expect(
			page.getByRole("status").getByText("Versione precedente ripristinata"),
		).toBeVisible();
		await expect(
			page
				.getByTestId("history-row")
				.filter({ hasText: "Ripristino della modifica" })
				.first(),
		).toBeVisible();
		await page.goto("/admin/config/privacy");
		await waitForHydration(page);
		await expect(page.getByTestId("setting-privacy.auditRetentionMonths")).toHaveValue("24");

		// at the default, nothing to go back to; "Torna al predefinito" takes the key out of the file
		await expect(page.getByTestId("reset-privacy.auditRetentionMonths")).toHaveCount(0);
		await page.getByTestId("setting-privacy.auditRetentionMonths").fill("36");
		await page.getByTestId("section-save").click();
		await expect(
			page.getByRole("status").getByText("Impostazioni salvate").first(),
		).toBeVisible();
		await page.getByTestId("reset-privacy.auditRetentionMonths").click();
		await page.getByTestId("section-save").click();
		await expect(page.getByTestId("setting-privacy.auditRetentionMonths")).toHaveValue("24");
		await expect(page.getByTestId("reset-privacy.auditRetentionMonths")).toHaveCount(0);
		await expect(page.getByTestId("section-dirty")).toHaveCount(0);
	});

	test("refuses to take away an item type still in use", async ({ page, isMobile }) => {
		test.skip(isMobile, "the configuration is shared: one project changes it");
		await page.goto("/admin/config/library");
		await waitForHydration(page);
		await expect(page.getByTestId("block-itemTypes")).toBeVisible();
		await page.getByTestId("section-tab-json").click();
		const text = page.getByTestId("section-json-text");
		await expect(text).toHaveValue(/"itemTypes"/);
		const raw = JSON.parse(await text.inputValue()) as { itemTypes: { code: string }[] };
		raw.itemTypes = raw.itemTypes.filter((t) => t.code !== "libro");
		await text.fill(JSON.stringify(raw, null, "\t"));
		await expect(page.getByTestId("section-json-valid")).toBeVisible();
		await page.getByTestId("section-json-save").click();
		await expect(page.getByTestId("config-in-use")).toContainText("tipo di copia libro");
		await page.getByTestId("section-json-discard").click();
		await page.getByTestId("section-tab-form").click();
		await expect(page.getByTestId("setting-library.name")).toHaveValue(/.+/);
	});

	test("the generated form works on every window size and asks before leaving", async ({
		page,
	}) => {
		await page.goto("/admin/config/circulation");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prestiti");
		const receipts = page.getByTestId("setting-circulation.receipts");
		const checked = await receipts.isChecked();
		await receipts.setChecked(!checked);
		await expect(page.getByTestId("section-dirty")).toBeVisible();
		await page.getByTestId("page-back").click();
		await expect(page.getByTestId("confirm-dialog")).toContainText("Uscire senza salvare?");
		await page.getByTestId("confirm-dialog").getByRole("button", { name: "Annulla" }).click();
		await page.getByTestId("section-discard").click();
		await expect(receipts).toBeChecked({ checked });
		await page.getByTestId("page-back").click();
		await expect(page).toHaveURL(/\/admin\/config$/);
	});

	test("is for administrators only", async ({ page }) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("prestiti", "prestiti-test-pw");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		for (const path of ["/admin/config", "/admin/config/privacy", "/admin/config/history"]) {
			await page.goto(path);
			await expect(page.getByRole("heading", { level: 1 })).toHaveText(
				/non è disponibile per l'account in uso/,
			);
		}
	});
});
