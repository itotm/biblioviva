// SPDX-License-Identifier: GPL-3.0-or-later
// Restore from the first-run wizard (step 9.43): the "Esporta tutto" archive of the shared test
// library is restored on a fresh server of its own, from the first screen of the wizard, and the
// restored accounts log in. Refusals are readable; once restored the wizard no longer exists.
import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { expect, test } from "@playwright/test";
import { startFreshServer } from "./helpers/fresh-server.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

let server: ChildProcess | undefined;
let runDir = "";
let base = "";

const zip = (
	name: string,
	buffer: Uint8Array,
): { name: string; mimeType: string; buffer: Buffer } => ({
	name,
	mimeType: "application/zip",
	buffer: Buffer.from(buffer),
});

test.describe.serial("restore from the first-run wizard", () => {
	test.beforeAll(async () => {
		runDir = mkdtempSync(join(tmpdir(), "bv-wizard-restore-"));
		({ server, base } = await startFreshServer(runDir));
	});
	test.afterAll(() => {
		server?.kill();
		rmSync(runDir, { recursive: true, force: true });
	});

	test("restores the library's archive on a fresh server and logs in with its accounts", async ({
		page,
		browser,
	}) => {
		test.setTimeout(180_000);
		// "Esporta tutto" of the shared test library (the page's session is the administrator's)
		await page.goto("/admin/backups");
		await waitForHydration(page);
		const href = await page.getByTestId("export-all").getAttribute("href");
		const archive = new Uint8Array(await (await page.request.get(href!)).body());

		// the fresh server, with nobody logged in
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		const wizard = await context.newPage();
		await wizard.goto(`${base}/`);
		await expect(wizard).toHaveURL(/\/setup/);
		await waitForHydration(wizard);
		await expect(wizard.getByTestId("setup-restore-offer")).toContainText(
			"Restore from a backup",
		);

		// the two ways of the first screen: configure a new library, or restore
		await wizard.getByTestId("setup-restore-start").click();
		await expect(wizard.getByTestId("setup-restore")).toBeVisible();
		await expect(wizard.getByTestId("restore-apply")).toHaveCount(0);

		// a file that is not BiblioViva's: refused as such, nothing restored
		await wizard
			.getByTestId("restore-upload")
			.setInputFiles(zip("notes.zip", zipSync({ "notes.txt": strToU8("not ours") })));
		await expect(wizard.getByTestId("restore-error")).toContainText("not part of BiblioViva");
		await expect(wizard.getByTestId("restore-check")).toHaveCount(0);

		// an archive of a newer version: refused with the version named
		const files = unzipSync(archive);
		const manifest = JSON.parse(strFromU8(files["manifest.json"]!)) as Record<string, unknown>;
		manifest.version = "99.0.0";
		await wizard
			.getByTestId("restore-upload")
			.setInputFiles(
				zip(
					"newer.zip",
					zipSync({ ...files, "manifest.json": strToU8(JSON.stringify(manifest)) }),
				),
			);
		await expect(wizard.getByTestId("restore-error")).toContainText("newer version");
		await expect(wizard.getByTestId("restore-error")).toContainText("99.0.0");

		// a configuration-only archive: it lacks the data of the library
		const configOnly = Object.fromEntries(
			Object.entries(files).filter(
				([name]) => !name.startsWith("db/") && !name.startsWith("uploads/"),
			),
		);
		const configManifest = {
			...manifest,
			version: "0.1.0",
			parts: (manifest.parts as string[]).filter((p) => !p.startsWith("data:")),
		};
		await wizard.getByTestId("restore-upload").setInputFiles(
			zip(
				"config.zip",
				zipSync({
					...configOnly,
					"manifest.json": strToU8(JSON.stringify(configManifest)),
				}),
			),
		);
		await expect(wizard.getByTestId("restore-error")).toContainText("incomplete");

		// the right archive: checked first, what it holds and its accounts shown
		await wizard.getByTestId("restore-upload").setInputFiles(zip("export.zip", archive));
		await expect(wizard.getByTestId("restore-check")).toBeVisible({ timeout: 60_000 });
		await expect(wizard.getByTestId("restore-error")).toHaveCount(0);
		await expect(wizard.getByTestId("restore-check")).toContainText("Patrons");
		await expect(wizard.getByTestId("restore-accounts")).toContainText("admin");
		await wizard.getByTestId("restore-apply").click();

		// restored whole; the login page opens with the accounts of the archive
		await expect(wizard.getByTestId("restore-done")).toBeVisible({ timeout: 120_000 });
		await expect(wizard.getByTestId("restore-account-admin")).toBeVisible();
		await expect(wizard.getByTestId("restore-account-prestiti")).toBeVisible();
		await wizard.getByTestId("go-login").click();
		await expect(wizard).toHaveURL(/\/login/);
		await waitForHydration(wizard);
		const login = new LoginPage(wizard);
		await login.loginAs("admin", "admin-test-pw");
		await expect(wizard).toHaveURL(new RegExp(`${base.replace(/[.:/]/g, "\\$&")}/$`));

		// the library is there: the patrons of the archive, and the wizard is closed for good
		await wizard.goto(`${base}/patrons`);
		await waitForHydration(wizard);
		await expect(wizard.getByRole("heading", { level: 1 })).toBeVisible();
		expect((await wizard.request.get(`${base}/setup`)).status()).toBe(404);
		await context.close();
	});
});
