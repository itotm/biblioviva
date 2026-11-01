// SPDX-License-Identifier: GPL-3.0-or-later
// Appearance page (step 2.3b): pick a colour set, save it, see it applied on the next full load.
// The colour set is shared configuration: only the desktop project changes it (the specs of the
// two projects run at the same time).
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { strToU8, unzipSync, zipSync } from "fflate";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

test.describe.serial("admin appearance", () => {
	test("changes the colour set for the whole installation", async ({ page, isMobile }) => {
		test.skip(isMobile, "the colour set is shared configuration: one project changes it");
		await page.goto("/admin/appearance");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aspetto e lingua");
		await expect(page.getByTestId("theme-ocean")).toHaveAttribute("aria-checked", "true");
		await expectAxeClean(page);

		await page.getByTestId("theme-sunset").click();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "sunset");
		await page.getByTestId("save-theme").click();
		await expect(page.getByRole("status").getByText("Colori salvati")).toBeVisible();
		await expect(page.getByTestId("current-theme")).toContainText("Tramonto");

		await page.goto("/patrons");
		await expect(page.locator("html")).toHaveAttribute("data-theme", "sunset");
		await page.goto("/admin/audit");
		await waitForHydration(page);
		await page.getByTestId("audit-action").selectOption("config.theme");
		await expect(page.getByTestId("data-grid").getByText("config.theme").first()).toBeVisible();

		// back to the default so the other specs see the fixture value
		await page.goto("/admin/appearance");
		await waitForHydration(page);
		await page.getByTestId("theme-ocean").click();
		await page.getByTestId("save-theme").click();
		await expect(page.getByRole("status").getByText("Colori salvati")).toBeVisible();
	});

	test("adds a language where the language is chosen", async ({ page, isMobile }, info) => {
		test.skip(isMobile, "the packs are shared configuration: one project changes them");
		await page.goto("/admin/appearance");
		await waitForHydration(page);
		const add = page.getByTestId("language-add");
		// the tests never reach GitHub: the list is unavailable, the upload still works
		await expect(add.getByTestId("release-unavailable")).toBeVisible();
		await expectAxeClean(page);

		const example = await page.request.get("/admin/config/languages/en");
		const english = unzipSync(new Uint8Array(await example.body()));
		const dutch: Record<string, Uint8Array> = {};
		for (const [name, bytes] of Object.entries(english)) {
			dutch[name.replace(/^en\//, "nl/")] = name.endsWith("pack.json")
				? strToU8(JSON.stringify({ name: "Dutch", nativeName: "Nederlands" }))
				: bytes;
		}
		const upload = async (files: Record<string, Uint8Array>, name: string): Promise<void> => {
			const path = info.outputPath(name);
			writeFileSync(path, zipSync(files));
			await add.getByTestId("pack-input").setInputFiles(path);
		};
		await upload({ ...dutch, "nl/common.json": strToU8("{") }, "broken.zip");
		await expect(add.getByTestId("pack-error")).toContainText("ha errori");

		await upload(dutch, "nl.zip");
		await expect(
			page.getByRole("status").getByText("Lingua installata: Nederlands"),
		).toBeVisible();
		// the new language is in the list and already chosen, waiting for "Cambia lingua"
		await expect(page.getByTestId("locale-select")).toHaveValue("nl");
		await expect(page.getByTestId("save-locale")).toBeEnabled();

		// clean up: the pack is removed where the packs are managed
		await page.goto("/admin/config/ui");
		await waitForHydration(page);
		const block = page.getByTestId("block-languagePacks");
		await block.getByTestId("pack-nl").getByTestId("pack-remove").click();
		await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
		await expect(block.getByTestId("pack-nl")).toHaveCount(0);
	});

	test("adds a language from the list of the release", async ({ page, isMobile }) => {
		test.skip(isMobile, "the packs are shared configuration: one project changes them");
		// a release on a local port, made from the English example, as GitHub would serve it
		const example = await page.request.get("/admin/config/languages/en");
		const english = unzipSync(new Uint8Array(await example.body()));
		const swedish: Record<string, Uint8Array> = {};
		for (const [name, bytes] of Object.entries(english)) {
			swedish[name.replace(/^en\//, "sv/")] = name.endsWith("pack.json")
				? strToU8(JSON.stringify({ name: "Swedish", nativeName: "Svenska" }))
				: bytes;
		}
		const zip = Buffer.from(zipSync(swedish));
		const files: Record<string, Buffer> = {
			"/biblioviva-i18n-sv-0.1.0.zip": zip,
			"/biblioviva-i18n-index.json": Buffer.from(
				JSON.stringify({
					packs: [
						{
							code: "sv",
							name: "Swedish",
							nativeName: "Svenska",
							translation: "machine",
							translated: 100,
							total: 100,
							file: "biblioviva-i18n-sv-0.1.0.zip",
							bytes: zip.length,
							sha256: createHash("sha256").update(zip).digest("hex"),
						},
					],
				}),
			),
		};
		const release = createServer((req, res) => {
			const body = files[req.url ?? ""];
			res.statusCode = body ? 200 : 404;
			res.end(body);
		});
		await new Promise<void>((done) => release.listen(4599, "127.0.0.1", done));
		try {
			await page.goto("/admin/appearance");
			await waitForHydration(page);
			const add = page.getByTestId("language-add");
			await expect(add.getByTestId("release-select")).toBeVisible();
			await expectAxeClean(page);
			await add.getByTestId("release-select").selectOption("sv");
			await expect(add).toContainText("Traduzione automatica");
			await add.getByTestId("release-install").click();
			await expect(
				page.getByRole("status").getByText("Lingua installata: Svenska"),
			).toBeVisible();
			// installed: no longer offered, already chosen in the list of languages
			await expect(page.getByTestId("locale-select")).toHaveValue("sv");
			await expect(add.getByTestId("release-all-installed")).toBeVisible();

			await page.goto("/admin/config/ui");
			await waitForHydration(page);
			const block = page.getByTestId("block-languagePacks");
			await block.getByTestId("pack-sv").getByTestId("pack-remove").click();
			await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
			await expect(block.getByTestId("pack-sv")).toHaveCount(0);
		} finally {
			await new Promise((done) => release.close(done));
		}
	});

	test("is not reachable without the admin permission", async ({ page }) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("prestiti", "prestiti-test-pw");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		await page.goto("/admin/appearance");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			/non è disponibile per l'account in uso/,
		);
	});
});
