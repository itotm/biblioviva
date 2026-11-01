// SPDX-License-Identifier: GPL-3.0-or-later
// Configuration archive (step 11.3) and granular backups, restores, exports and imports (step
// 11.12), all in the one archive format (§3.6), run once every other spec is done (project
// `final`), because importing puts back parts of the configuration as they were at export time;
// one after the other (they change the same folder): export (the configuration under `config/`),
// change a value, import the exported archive after the check, the value is back; a file that is
// not an archive is refused with a readable message; only the card templates exported, a template
// and a setting changed, the archive imported with only the templates chosen — the template is
// back, the setting is not; a backup of the catalogue alone created and restored from the list,
// part by part; a backup given to "Importa configurazione" (its configuration taken, a backup of
// data alone refused) and the configuration archive given to "Ripristina" (only its configuration
// parts offered); and the completeness round trip of step 11.11:
// one value changed in every kind of editor, the archive exported, the previous configuration put
// back, the archive imported — every value is back (the folder exported again is the same); the
// library's name and a dashboard section changed from the Appearance page (steps 11.13, 11.15).
import { readFileSync, writeFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { savedDownload } from "./helpers/download.js";

async function open(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await waitForHydration(page);
}

test.describe.serial("configuration archive and granular backups", () => {
	test("export, change a value, import the archive: the value is back", async ({ page }) => {
		await page.goto("/admin/config");
		await waitForHydration(page);
		const panel = page.getByTestId("config-archive");
		await expect(panel).toBeVisible();
		const downloading = page.waitForEvent("download");
		await panel.getByTestId("config-export").click();
		const download = await downloading;
		expect(download.suggestedFilename()).toMatch(
			/^biblioviva-configurazione-\d{8}-\d{4}\.zip$/,
		);
		const archive = await savedDownload(download);
		// the one archive format: a manifest and the configuration under config/, no data
		const entries = unzipSync(new Uint8Array(readFileSync(archive)));
		const names = Object.keys(entries);
		expect(names).toContain("config/config.json");
		expect(names.every((n) => n === "manifest.json" || n.startsWith("config/"))).toBe(true);
		const manifest = JSON.parse(strFromU8(entries["manifest.json"]!)) as {
			app: string;
			parts: string[];
		};
		expect(manifest.app).toBe("BiblioViva");
		expect(manifest.parts).toContain("section:privacy");
		expect(manifest.parts.some((p) => p.startsWith("data:"))).toBe(false);

		// a value changes after the export
		await page.goto("/admin/config/privacy");
		await waitForHydration(page);
		const months = page.getByTestId("setting-privacy.auditRetentionMonths");
		const before = await months.inputValue();
		await months.fill("33");
		await page.getByTestId("section-save").click();
		await expect(page.getByRole("status").getByText("Impostazioni salvate")).toBeVisible();

		// not an archive: refused before anything is checked
		await page.goto("/admin/config");
		await waitForHydration(page);
		await page.getByTestId("config-import-file").setInputFiles({
			name: "config.zip",
			mimeType: "application/zip",
			buffer: Buffer.from("not a zip"),
		});
		await expect(page.getByTestId("config-import-error")).toHaveText(
			"Il file non è un archivio ZIP valido.",
		);

		// the exported archive: checked, then imported
		await page.getByTestId("config-import-file").setInputFiles(archive);
		const check = page.getByTestId("config-import-check");
		await expect(check).toBeVisible();
		await expect(check.getByTestId("config-import-sections")).toContainText("Privacy");
		await expect(check.getByTestId("config-import-files")).toContainText("1 modificato");
		// the staff accounts are not taken by default; ticking them asks first
		await expect(check.getByTestId("part-section:security")).not.toBeChecked();
		await expect(check.getByTestId("part-section:privacy")).toBeChecked();
		await check.getByTestId("part-section:security").click();
		const warning = page.getByTestId("confirm-dialog");
		await expect(warning).toContainText("sostituiscono quelli attuali");
		await warning.getByRole("button", { name: "Annulla" }).click();
		await expect(warning).toHaveCount(0);
		await expect(check.getByTestId("part-section:security")).not.toBeChecked();
		await expect(check.getByTestId("config-import-apply")).toBeEnabled();
		await expectAxeClean(page);
		await check.getByTestId("config-import-apply").click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Configurazione importata")).toBeVisible();
		await expect(page.getByTestId("config-import-check")).toHaveCount(0);

		await page.goto("/admin/config/privacy");
		await waitForHydration(page);
		await expect(page.getByTestId("setting-privacy.auditRetentionMonths")).toHaveValue(before);
		await page.goto("/admin/config/history");
		await waitForHydration(page);
		await expect(page.getByTestId("history-row").first()).toContainText("config.import");
	});

	test("only the templates exported and imported back, the settings left alone", async ({
		page,
	}) => {
		await page.goto("/admin/config");
		await waitForHydration(page);
		const panel = page.getByTestId("config-archive");
		await panel.getByTestId("config-export-parts").locator("summary").click();
		await panel.getByTestId("parts-settings-none").click();
		await panel.getByTestId("parts-config-none").click();
		await panel.getByTestId("part-config:cardTemplates").check();
		await expect(panel.getByTestId("config-export")).toHaveAttribute(
			"href",
			/parts=config%3AcardTemplates$/,
		);
		const [download] = await Promise.all([
			page.waitForEvent("download"),
			panel.getByTestId("config-export").click(),
		]);
		const archive = await savedDownload(download);

		// a template and a setting change afterwards
		await page.goto("/admin/config/templates/cards/default");
		await waitForHydration(page);
		await page.getByTestId("designer-tab-code").click();
		await page.getByTestId("designer-file-front.html").click();
		const code = page.getByTestId("designer-code");
		const original = await code.inputValue();
		await code.fill(`${original}\n<!-- cambiato -->`);
		await Promise.all([
			page.waitForResponse((r) => r.url().includes("saveTemplateDraft")),
			page.getByTestId("designer-save").click(),
		]);
		await page.goto("/admin/config/privacy");
		await waitForHydration(page);
		const months = page.getByTestId("setting-privacy.auditRetentionMonths");
		const before = await months.inputValue();
		await months.fill("35");
		await page.getByTestId("section-save").click();
		await expect(page.getByRole("status").getByText("Impostazioni salvate")).toBeVisible();

		await page.goto("/admin/config");
		await waitForHydration(page);
		await page.getByTestId("config-import-file").setInputFiles(archive);
		const check = page.getByTestId("config-import-check");
		await expect(check.getByTestId("part-config:cardTemplates")).toBeChecked();
		await expect(check.getByTestId("part-section:privacy")).toHaveCount(0);
		await expect(check.getByTestId("config-import-files")).toContainText("1 modificato");
		await expectAxeClean(page);
		await check.getByTestId("config-import-apply").click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Configurazione importata")).toBeVisible();

		await page.goto("/admin/config/templates/cards/default");
		await waitForHydration(page);
		await page.getByTestId("designer-tab-code").click();
		await page.getByTestId("designer-file-front.html").click();
		await expect(page.getByTestId("designer-code")).toHaveValue(original);
		await page.goto("/admin/config/privacy");
		await waitForHydration(page);
		await expect(page.getByTestId("setting-privacy.auditRetentionMonths")).toHaveValue("35");
		await page.getByTestId("setting-privacy.auditRetentionMonths").fill(before);
		await page.getByTestId("section-save").click();
		await expect(page.getByRole("status").getByText("Impostazioni salvate")).toBeVisible();
	});

	test("a backup of the catalogue alone, restored from the list", async ({ page }) => {
		await page.goto("/admin/backups");
		await waitForHydration(page);
		const card = page.getByTestId("backup-parts");
		for (const group of ["data", "settings", "config"]) {
			await card.getByTestId(`parts-${group}-none`).click();
		}
		await card.getByTestId("part-data:catalog").check();
		await expect(card.getByTestId("export-parts")).toHaveAttribute(
			"href",
			/parts=data%3Acatalog$/,
		);
		await card.getByTestId("archive-backup").click();
		await expect(
			page.getByRole("status").getByText(/Backup creato: biblioviva-.*\.zip/),
		).toBeVisible();

		const row = page.getByTestId("backup-row").filter({ hasText: ".zip" }).first();
		await row.getByTestId("backup-restore").click();
		const restore = page.getByTestId("restore-check");
		await expect(restore.getByTestId("part-data:catalog")).toBeChecked();
		await expect(restore.getByTestId("part-data:patrons")).toHaveCount(0);
		await expect(restore.getByTestId("restore-counts")).toContainText("Catalogo e copie: ora");
		await expectAxeClean(page);
		await restore.getByTestId("restore-apply").click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Ripristino completato")).toBeVisible();
		await expect(page.getByTestId("restore-check")).toHaveCount(0);
	});

	test("a backup given to Importa configurazione, the configuration archive to Ripristina", async ({
		page,
	}, info) => {
		const download = async (name: string): Promise<string> => {
			const row = page.getByTestId("backup-row").filter({ hasText: name });
			const href = await row.getByRole("link", { name: "Scarica" }).getAttribute("href");
			const res = await page.request.get(href!);
			expect(res.status()).toBe(200);
			const path = info.outputPath(name);
			writeFileSync(path, await res.body());
			return path;
		};
		const backupOf = async (parts: string[]): Promise<string> => {
			await open(page, "/admin/backups");
			const card = page.getByTestId("backup-parts");
			for (const group of ["data", "settings", "config"]) {
				await card.getByTestId(`parts-${group}-none`).click();
			}
			for (const part of parts) {
				await card.getByTestId(`part-${part}`).check();
			}
			await card.getByTestId("archive-backup").click();
			const created = page.getByRole("status").getByText(/Backup creato: biblioviva-.*\.zip/);
			await expect(created).toBeVisible();
			const name = /biblioviva-[\d-]+\.zip/.exec((await created.textContent()) ?? "")?.[0];
			return download(name!);
		};

		// a backup with data and configuration: only its configuration is offered
		const mixed = await backupOf(["data:catalog", "section:privacy"]);
		await open(page, "/admin/config");
		await page.getByTestId("config-import-file").setInputFiles(mixed);
		const check = page.getByTestId("config-import-check");
		await expect(check.getByTestId("part-section:privacy")).toBeChecked();
		await expect(check.getByTestId("part-data:catalog")).toHaveCount(0);
		await expect(check.getByTestId("config-import-sections")).toHaveText(
			"Le impostazioni restano le stesse.",
		);
		await expect(check.getByTestId("config-import-apply")).toBeEnabled();
		await check.getByRole("button", { name: "Annulla" }).click();
		await expect(check).toHaveCount(0);

		// a backup of the data alone: refused with a readable message
		const dataOnly = await backupOf(["data:catalog"]);
		await open(page, "/admin/config");
		await page.getByTestId("config-import-file").setInputFiles(dataOnly);
		await expect(page.getByTestId("config-import-error")).toContainText(
			"L'archivio non contiene la configurazione",
		);
		await expect(page.getByTestId("config-import-check")).toHaveCount(0);

		// the configuration archive given to Ripristina: its configuration parts only
		const res = await page.request.get("/admin/config/export");
		const configOnly = info.outputPath("configurazione.zip");
		writeFileSync(configOnly, await res.body());
		await open(page, "/admin/backups");
		await page.getByTestId("restore-upload").setInputFiles(configOnly);
		const restore = page.getByTestId("restore-check");
		await expect(restore.getByTestId("part-section:privacy")).toBeChecked();
		await expect(restore.locator('[data-testid^="part-data:"]')).toHaveCount(0);
		await expect(restore.getByTestId("restore-apply")).toBeEnabled();
		await restore.getByRole("button", { name: "Annulla" }).click();
		await expect(restore).toHaveCount(0);
	});

	test("the library's name from the Appearance page", async ({ page }) => {
		await open(page, "/admin/appearance");
		const field = page.getByTestId("library-name");
		await expect(field).toHaveValue("Biblioteca dell'Istituto");
		await field.fill("Biblioteca Rinominata");
		await page.getByTestId("save-library-name").click();
		await expect(
			page.getByRole("status").getByText("Nome della biblioteca salvato"),
		).toBeVisible();
		await expect(page.getByTestId("brand-library")).toHaveText("Biblioteca Rinominata");
		await open(page, "/");
		await expect(page.getByTestId("page-title")).toContainText("Biblioteca Rinominata");
		const manifest = (await (await page.request.get("/manifest.webmanifest")).json()) as {
			name: string;
			theme_color: string;
		};
		expect(manifest.name).toContain("Biblioteca Rinominata");

		// back as the other tests expect
		await open(page, "/admin/appearance");
		await page.getByTestId("library-name").fill("Biblioteca dell'Istituto");
		await page.getByTestId("save-library-name").click();
		await expect(page.getByTestId("brand-library")).toHaveText("Biblioteca dell'Istituto");
	});

	test("the dashboard sections switched off and on (step 11.15)", async ({ page }) => {
		await open(page, "/admin/appearance");
		const card = page.getByTestId("dashboard-section");
		await expect(card.getByTestId("dashboard-tiles")).toBeChecked();
		await card.getByTestId("dashboard-tiles").uncheck();
		await card.getByTestId("dashboard-dueThisWeek").uncheck();
		await card.getByTestId("save-dashboard").click();
		await expect(page.getByRole("status").getByText("Dashboard salvata")).toBeVisible();
		await expectAxeClean(page);

		await open(page, "/");
		await expect(page.getByTestId("quick-actions")).toBeVisible();
		await expect(page.getByTestId("dashboard-tiles")).toHaveCount(0);
		await expect(page.getByTestId("due-this-week")).toHaveCount(0);
		await expect(page.getByTestId("today-activity")).toBeVisible();

		await open(page, "/admin/appearance");
		await card.getByTestId("dashboard-tiles").check();
		await card.getByTestId("dashboard-dueThisWeek").check();
		await card.getByTestId("save-dashboard").click();
		await expect(page.getByRole("status").getByText("Dashboard salvata")).toBeVisible();
		await open(page, "/");
		await expect(page.getByTestId("dashboard-tiles")).toBeVisible();
		await expect(page.getByTestId("due-this-week")).toBeVisible();
	});

	test("photos not required: no reminder that photos are missing (9.13, round 3)", async ({
		page,
	}) => {
		const setRequired = async (on: boolean): Promise<void> => {
			await open(page, "/admin/config/photos");
			await page.getByTestId("setting-photos.required").setChecked(on);
			await page.getByTestId("section-save").click();
			await expect(page.getByRole("status").getByText("Impostazioni salvate")).toBeVisible();
		};
		await open(page, "/");
		await expect(page.getByTestId("tile-without-photo")).toBeVisible();
		await setRequired(false);

		await open(page, "/");
		await expect(page.getByTestId("tile-without-photo")).toHaveCount(0);
		await expect(page.getByTestId("tile-without-card")).toBeVisible();
		await open(page, "/patrons");
		await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption("1");
		await expect(page.getByTestId("data-grid").locator(".wx-row").first()).toBeVisible();
		await expect(page.getByTestId("status-no-photo")).toHaveCount(0);
		// photos are still managed: the census is there
		await open(page, "/census");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Censimento foto");

		await setRequired(true);
		await open(page, "/patrons");
		await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption("1");
		await expect(page.getByTestId("status-no-photo").first()).toBeVisible();
	});

	test("every editor changed, exported, the old configuration back, imported: all back", async ({
		page,
	}, info) => {
		test.setTimeout(180_000);
		const exportAll = async (name: string): Promise<string> => {
			const res = await page.request.get("/admin/config/export");
			expect(res.status()).toBe(200);
			const path = info.outputPath(name);
			writeFileSync(path, await res.body());
			return path;
		};
		const importAll = async (path: string): Promise<void> => {
			await open(page, "/admin/config");
			await page.getByTestId("config-import-file").setInputFiles(path);
			const check = page.getByTestId("config-import-check");
			await expect(check.getByTestId("config-import-apply")).toBeEnabled();
			await check.getByTestId("config-import-apply").click();
			await page.getByTestId("confirm-button").click();
			await expect(
				page.getByRole("status").getByText("Configurazione importata"),
			).toBeVisible();
		};
		const saveAnd = async (url: string, click: () => Promise<void>): Promise<void> => {
			await Promise.all([page.waitForResponse((r) => r.url().includes(url)), click()]);
		};
		const before = await exportAll("before.zip");

		// a generated settings form
		await open(page, "/admin/config/privacy");
		await page.getByTestId("setting-privacy.auditRetentionMonths").fill("31");
		await page.getByTestId("section-save").click();
		await expect(page.getByRole("status").getByText("Impostazioni salvate")).toBeVisible();
		// item types, loan rules per item type
		await open(page, "/admin/config/library");
		const types = page.getByTestId("block-itemTypes");
		await types
			.locator('[data-testid="code-row"][data-code="rivista"]')
			.getByTestId("label-input")
			.fill("Periodico");
		await saveAnd("saveItemTypesChange", () =>
			types.getByTestId("block-itemTypes-save").click(),
		);
		await open(page, "/admin/config/circulation");
		const rules = page.getByTestId("block-itemTypeRules");
		await rules
			.locator('[data-testid="rule-row"][data-code="testo"]')
			.getByTestId("rule-maxRenewals")
			.fill("2");
		await saveAnd("saveItemTypeRules", () => rules.getByTestId("rules-save").click());
		// calendar
		await open(page, "/admin/config/calendar");
		const cal = page.getByTestId("block-calendar");
		await cal.getByTestId("range-add").click();
		await cal
			.getByTestId("range-row")
			.last()
			.getByTestId("range-reason")
			.fill("Chiusura di prova");
		await saveAnd("saveCalendarChange", () => cal.getByTestId("calendar-save").click());
		// cards and stocks
		await open(page, "/admin/config/cards");
		await page
			.getByTestId("block-cardTemplates")
			.getByTestId("card-template-teacher")
			.selectOption("default");
		await saveAnd("saveCardTemplateSettings", () =>
			page.getByTestId("card-templates-save").click(),
		);
		await open(page, "/admin/config/labels");
		const stocks = page.getByTestId("block-stocks");
		await stocks.getByTestId("stock-a4-70x24").click();
		await stocks.getByTestId("stock-name").fill("Mezze etichette");
		await saveAnd("saveLabelStocks", () => stocks.getByTestId("stocks-save").click());
		// template folders and the template editor
		await open(page, "/admin/config/templates/slips/overdue-patron");
		const code = page.getByTestId("designer-code");
		await code.fill(`${await code.inputValue()}\n<!-- prova -->`);
		await saveAnd("saveTemplateDraft", () => page.getByTestId("designer-save").click());
		// integrations
		await open(page, "/admin/config/z3950");
		await page.getByTestId("target-sbn").getByTestId("target-name").fill("OPAC SBN (prova)");
		await saveAnd("saveZ3950Targets", () => page.getByTestId("targets-save").click());
		await open(page, "/admin/config/covers");
		await page.getByTestId("provider-openlibrary").getByTestId("provider-up").click();
		await saveAnd("saveCoverProviders", () => page.getByTestId("providers-save").click());
		// accounts and roles
		await open(page, "/admin/users");
		await page.getByTestId("account-tessere").getByTestId("account-edit").click();
		await page.getByTestId("account-display-name").fill("Tessere (prova)");
		await saveAnd("saveStaffAccount", () => page.getByTestId("account-save").click());
		// reports library
		await open(page, "/admin/config/reports");
		const report = JSON.parse(
			await (
				await page.request.get("/admin/config/reports/acquisitions-by-year/file.json")
			).text(),
		) as Record<string, unknown>;
		const reportFile = info.outputPath("report.json");
		writeFileSync(reportFile, JSON.stringify({ ...report, id: "prova-completezza" }));
		await page.getByTestId("report-input").setInputFiles(reportFile);
		await expect(page.getByTestId("report-prova-completezza")).toBeVisible();
		// appearance
		await open(page, "/admin/appearance");
		await page.getByTestId("theme-sunset").click();
		await page.getByTestId("save-theme").click();
		await expect(page.getByRole("status").getByText("Colori salvati")).toBeVisible();
		await page.getByTestId("dashboard-section").getByTestId("dashboard-installHint").uncheck();
		await page.getByTestId("save-dashboard").click();
		await expect(page.getByRole("status").getByText("Dashboard salvata")).toBeVisible();
		await page.getByTestId("library-name").fill("Biblioteca (prova)");
		await page.getByTestId("save-library-name").click();
		await expect(
			page.getByRole("status").getByText("Nome della biblioteca salvato"),
		).toBeVisible();

		const changed = await exportAll("changed.zip");
		await importAll(before);
		await open(page, "/admin/config/privacy");
		await expect(page.getByTestId("setting-privacy.auditRetentionMonths")).not.toHaveValue(
			"31",
		);
		await importAll(changed);
		const again = await exportAll("again.zip");

		// JSON documents compared by value (a merge may write keys in another order)
		const files = (path: string): Record<string, unknown> => {
			const entries = unzipSync(new Uint8Array(readFileSync(path)));
			return Object.fromEntries(
				Object.entries(entries)
					.filter(([name]) => name !== "manifest.json")
					.map(([name, bytes]) => [
						name,
						name.endsWith(".json")
							? (JSON.parse(strFromU8(bytes)) as unknown)
							: strFromU8(bytes),
					]),
			);
		};
		expect(files(again)).toEqual(files(changed));

		// the configuration of the other specs back
		await importAll(before);
	});
});
