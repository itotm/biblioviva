// SPDX-License-Identifier: GPL-3.0-or-later
// Integrations and languages in the Configurazione area (step 11.8): a Z39.50 catalogue tested
// (answered by the mock provider), added and removed; the cover sources reordered and put back;
// the next backups following the cron expression typed; a language pack made from the English
// example, uploaded, checked and removed, a broken one refused. The configuration is shared: only
// the desktop project changes it, and it ends as it started.
import { readFileSync, writeFileSync } from "node:fs";
import { strToU8, unzipSync, zipSync } from "fflate";
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { savedDownload } from "./helpers/download.js";

async function open(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await waitForHydration(page);
}

test.describe.serial("integrations and languages", () => {
	test("Z39.50 catalogues: test, add, remove", async ({ page, isMobile }) => {
		await open(page, "/admin/config/z3950");
		const block = page.getByTestId("block-z3950Targets");
		const sbn = block.getByTestId("target-sbn");
		await sbn.getByTestId("target-test").click();
		await expect(sbn.getByTestId("target-test-result")).toContainText("Il catalogo risponde");
		await expect(sbn.getByTestId("target-remove")).toBeDisabled();
		await expect(page.getByTestId("setting-z3950.defaultTarget")).toContainText("OPAC SBN");
		await expectAxeClean(page);
		test.skip(isMobile, "the configuration is shared: one project changes it");

		const save = async (): Promise<void> => {
			await Promise.all([
				page.waitForResponse((r) => r.url().includes("saveZ3950Targets")),
				block.getByTestId("targets-save").click(),
			]);
			await expect(block.getByTestId("targets-save")).toBeDisabled();
		};
		await block.getByTestId("target-add").click();
		const added = block.locator("section").last();
		await added.getByTestId("target-id").fill("e2e-opac");
		await added.getByTestId("target-name").fill("Catalogo di prova");
		await added.getByTestId("target-host").fill("z3950 non valido");
		await expect(block.getByTestId("targets-save")).toBeDisabled();
		await added.getByTestId("target-host").fill("opac.example.org");
		await added.getByTestId("target-database").fill("catalogo");
		await save();
		await expect(page.getByRole("status").getByText("Cataloghi salvati")).toBeVisible();
		await open(page, "/admin/config/z3950");
		const saved = block.getByTestId("target-e2e-opac");
		await expect(saved.getByTestId("target-host")).toHaveValue("opac.example.org");
		await saved.getByTestId("target-remove").click();
		await save();
		await open(page, "/admin/config/z3950");
		await expect(block.getByTestId("target-e2e-opac")).toHaveCount(0);
	});

	test("cover sources and next backups", async ({ page, isMobile }) => {
		await open(page, "/admin/config/backup");
		const next = page.getByTestId("block-backupSchedule");
		await expect(next.getByTestId("backup-next").locator("li")).toHaveCount(3);
		await page.getByTestId("setting-backup.cron").fill("0 25 * * *");
		await expect(next.getByTestId("backup-next-invalid")).toBeVisible();
		await page.getByTestId("setting-backup.cron").fill("30 22 * * 1-5");
		await expect(next.getByTestId("backup-next").locator("li").first()).toContainText("22:30");
		await page.getByTestId("section-discard").click();

		await open(page, "/admin/config/covers");
		const block = page.getByTestId("block-coverProviders");
		const order = (): Promise<string[]> =>
			block
				.locator("li")
				.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? ""));
		await expect
			.poll(order)
			.toEqual(["provider-amazon", "provider-openlibrary", "provider-googlebooks"]);
		await expectAxeClean(page);
		test.skip(isMobile, "the configuration is shared: one project changes it");

		const google = block.getByTestId("provider-googlebooks");
		await google.getByTestId("provider-enabled").check();
		await expect(block.getByTestId("google-key-missing")).toBeVisible();
		await google.getByTestId("provider-up").click();
		await google.getByTestId("provider-enabled").uncheck();
		await Promise.all([
			page.waitForResponse((r) => r.url().includes("saveCoverProviders")),
			block.getByTestId("providers-save").click(),
		]);
		await open(page, "/admin/config/covers");
		await expect
			.poll(order)
			.toEqual(["provider-amazon", "provider-googlebooks", "provider-openlibrary"]);
		await block.getByTestId("provider-googlebooks").getByTestId("provider-down").click();
		await Promise.all([
			page.waitForResponse((r) => r.url().includes("saveCoverProviders")),
			block.getByTestId("providers-save").click(),
		]);
		await open(page, "/admin/config/covers");
		await expect
			.poll(order)
			.toEqual(["provider-amazon", "provider-openlibrary", "provider-googlebooks"]);
	});

	test("language packs: the English example becomes German, a broken pack refused", async ({
		page,
		isMobile,
	}, info) => {
		await open(page, "/admin/config/ui");
		const block = page.getByTestId("block-languagePacks");
		await expect(block).toContainText("Esempi da scaricare");
		await expectAxeClean(page);
		test.skip(isMobile, "the configuration is shared: one project changes it");

		const [download] = await Promise.all([
			page.waitForEvent("download"),
			block.getByRole("link", { name: "en", exact: true }).click(),
		]);
		const english = unzipSync(new Uint8Array(readFileSync(await savedDownload(download))));
		const german: Record<string, Uint8Array> = {};
		for (const [name, bytes] of Object.entries(english)) {
			german[name.replace(/^en\//, "de/")] = name.endsWith("pack.json")
				? strToU8(JSON.stringify({ name: "German", nativeName: "Deutsch" }))
				: bytes;
		}
		const upload = async (files: Record<string, Uint8Array>, name: string): Promise<void> => {
			const path = info.outputPath(name);
			writeFileSync(path, zipSync(files));
			await block.getByTestId("pack-input").setInputFiles(path);
		};

		const broken = { ...german, "de/common.json": strToU8("{") };
		await upload(broken, "broken.zip");
		await expect(block.getByTestId("pack-error")).toContainText("ha errori");
		await upload(german, "de.zip");
		await expect(
			page.getByRole("status").getByText("Lingua installata: Deutsch"),
		).toBeVisible();
		const pack = block.getByTestId("pack-de");
		await expect(pack).toContainText("Valido");

		await pack.getByTestId("pack-remove").click();
		await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
		await expect(block.getByTestId("pack-de")).toHaveCount(0);
	});
});
