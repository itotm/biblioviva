// SPDX-License-Identifier: GPL-3.0-or-later
// A language pack from the first-run wizard (step 9.48, Q142): on a fresh server, the first screen
// installs a pack of the release (served on a local port, as GitHub would serve it), the wizard
// goes on in that language and the installation keeps it. A file that is not a pack is refused.
import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { startFreshServer } from "./helpers/fresh-server.js";
import { waitForHydration } from "./helpers/hydration.js";

let server: ChildProcess | undefined;
let release: Server | undefined;
let runDir = "";
let base = "";

/** A Swedish pack made from the English dictionaries, its wizard title translated. */
function swedishPack(): Uint8Array {
	const files: Record<string, Uint8Array> = {};
	for (const name of readdirSync("src/lib/i18n/en")) {
		let text = readFileSync(join("src/lib/i18n/en", name), "utf8");
		if (name === "setup.json") {
			const setup = JSON.parse(text) as { title: string };
			setup.title = "Första konfigurationen";
			text = JSON.stringify(setup);
		}
		files[`sv/${name}`] = strToU8(text);
	}
	files["sv/pack.json"] = strToU8(JSON.stringify({ name: "Swedish", nativeName: "Svenska" }));
	return zipSync(files);
}

test.describe.serial("a language pack from the first-run wizard", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test.beforeAll(async () => {
		runDir = mkdtempSync(join(tmpdir(), "bv-wizard-language-"));
		const zip = Buffer.from(swedishPack());
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
		release = createServer((req, res) => {
			const body = files[req.url ?? ""];
			res.statusCode = body ? 200 : 404;
			res.end(body);
		});
		const port = await new Promise<number>((done) =>
			release?.listen(0, "127.0.0.1", () => {
				const address = release?.address();
				done(typeof address === "object" && address ? address.port : 0);
			}),
		);
		({ server, base } = await startFreshServer(runDir, {
			LANGUAGE_PACKS_BASE_URL: `http://127.0.0.1:${port}`,
		}));
	});

	test.afterAll(async () => {
		server?.kill();
		await new Promise((done) => release?.close(done));
		rmSync(runDir, { recursive: true, force: true });
	});

	test("installs a pack on the first screen and finishes the wizard in that language", async ({
		page,
	}) => {
		test.setTimeout(180_000);
		await page.goto(`${base}/`);
		await expect(page).toHaveURL(/\/setup/);
		await waitForHydration(page);
		await expect(page.getByRole("radio")).toHaveText(["English", "Italiano"]);
		await page.getByTestId("setup-language-add").click();
		const add = page.getByTestId("language-add");
		await expect(add.getByTestId("release-select")).toBeVisible();
		await expectAxeClean(page);

		// a file that is not a pack is refused, with the reason
		await add.getByTestId("pack-input").setInputFiles({
			name: "pack.zip",
			mimeType: "application/zip",
			buffer: Buffer.from("not a zip"),
		});
		await expect(add.getByTestId("pack-error")).toBeVisible();

		await add.getByTestId("release-select").selectOption("sv");
		await add.getByTestId("release-install").click();
		// installed: the wizard speaks it and has it chosen
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Första konfigurationen");
		await expect(page.getByRole("radio", { name: "Svenska" })).toHaveAttribute(
			"aria-checked",
			"true",
		);

		// the other steps with their defaults (the pack's texts are the English ones)
		await page.getByTestId("setup-next").click();
		await expect(page.getByTestId("setup-step-theme")).toBeVisible();
		await page.getByTestId("setup-next").click();
		await page.getByLabel("Library name").fill("Biblioteket");
		for (const next of ["school", "codes", "demo", "passwords", "summary"]) {
			await page.getByTestId("setup-next").click();
			await expect(page.getByTestId(`setup-step-${next}`)).toBeVisible();
		}
		await expect(page.getByTestId("setup-step-summary")).toContainText("Svenska");
		await page.getByTestId("setup-finish").click();
		await expect(page.getByTestId("setup-done")).toBeVisible({ timeout: 120_000 });
		const written = JSON.parse(readFileSync(join(runDir, "config", "config.json"), "utf8")) as {
			ui: { locale: string };
		};
		expect(written.ui.locale).toBe("sv");
	});
});
