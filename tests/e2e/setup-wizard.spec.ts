// SPDX-License-Identifier: GPL-3.0-or-later
// First-run wizard (step 1.11) against its own server started on a fresh data directory.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const srv = createServer();
		srv.listen(0, "127.0.0.1", () => {
			const address = srv.address();
			srv.close(() =>
				typeof address === "object" && address
					? resolve(address.port)
					: reject(new Error("no address")),
			);
		});
	});
}

/** A server of its own on a fresh folder: the wizard runs once per installation. */
async function startServer(dir: string): Promise<{ server: ChildProcess; base: string }> {
	const port = await freePort();
	const url = `http://127.0.0.1:${port}`;
	const child = spawn("bun", ["./build"], {
		env: {
			...process.env,
			PORT: String(port),
			HOST: "127.0.0.1",
			PROTOCOL_HEADER: "x-forwarded-proto",
			DATA_DIR: join(dir, "data"),
			BACKUP_DIR: join(dir, "backups"),
			CONFIG_DIR: join(dir, "config"),
			METADATA_PROVIDER: "mock",
			DEMO: "",
			ALLOW_LANG_OVERRIDE: "",
			DEV_UI: "",
		},
		stdio: "ignore",
	});
	for (let i = 0; i < 100; i++) {
		try {
			const res = await fetch(`${url}/healthz`, {
				headers: { "x-forwarded-proto": "http" },
			});
			if (res.ok) {
				return { server: child, base: url };
			}
		} catch {
			/* not ready yet */
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	child.kill();
	throw new Error("wizard server did not start");
}

let server: ChildProcess | undefined;
let runDir = "";
let base = "";

test.describe.serial("first-run wizard", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test.beforeAll(async () => {
		runDir = mkdtempSync(join(tmpdir(), "bv-wizard-"));
		// language packs (step 1.14): a valid German pack cloned from English with a few strings
		// translated, and an invalid one (a namespace file missing) that must not be offered
		const de = join(runDir, "config", "i18n", "de");
		mkdirSync(de, { recursive: true });
		cpSync("src/lib/i18n/en", de, { recursive: true });
		const setup = JSON.parse(readFileSync(join(de, "setup.json"), "utf8")) as {
			title: string;
			language: { title: string };
		};
		setup.title = "Ersteinrichtung";
		setup.language.title = "Welche Sprache soll BiblioViva sprechen?";
		writeFileSync(join(de, "setup.json"), JSON.stringify(setup));
		writeFileSync(
			join(de, "pack.json"),
			JSON.stringify({ name: "German", nativeName: "Deutsch", appVersion: "0.1.0" }),
		);
		const broken = join(runDir, "config", "i18n", "xx");
		mkdirSync(broken, { recursive: true });
		cpSync("src/lib/i18n/en", broken, { recursive: true });
		rmSync(join(broken, "nav.json"));
		writeFileSync(
			join(broken, "pack.json"),
			JSON.stringify({ name: "Broken", nativeName: "Xx" }),
		);
		({ server, base } = await startServer(runDir));
	});

	test.afterAll(() => {
		server?.kill();
		rmSync(runDir, { recursive: true, force: true });
	});

	test("fresh data directory → wizard → demo data → login → badge; rerun returns 404", async ({
		page,
	}) => {
		test.setTimeout(180_000);
		await page.goto(`${base}/`);
		await expect(page).toHaveURL(/\/setup/);
		await waitForHydration(page);
		// English is the first choice and the default of a fresh installation (owner decision)
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("First-time setup");
		await expect(page.getByRole("radio").first()).toHaveAccessibleName("English");
		await expectAxeClean(page);

		// step 1: the language switch is live, in both directions; the valid pack is offered
		// (after the built-in languages), the broken one is not
		await expect(page.getByRole("radio")).toHaveText(["English", "Italiano", "Deutsch"]);
		await page.getByRole("radio", { name: "Italiano" }).click();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prima configurazione");
		await page.getByRole("radio", { name: "Deutsch" }).click();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ersteinrichtung");
		// untranslated keys fall back to English
		await expect(page.getByTestId("setup-next")).toHaveText("Next");
		await page.getByRole("radio", { name: "English" }).click();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("First-time setup");
		await page.getByTestId("setup-next").click();

		// step 2: colours
		await expect(page.getByTestId("setup-step-theme")).toBeVisible();
		await page.getByTestId("theme-sunset").click();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "sunset");
		await page.getByTestId("setup-next").click();

		// step 3: library
		await expect(page.getByTestId("setup-next")).toBeDisabled();
		await page.getByLabel("Library name").fill("Rodari library");
		// patron photos and book covers (9.38): both on unless the school does without them
		await expect(page.getByTestId("setup-photos")).toBeChecked();
		await expect(page.getByTestId("setup-covers")).toBeChecked();
		await page.getByTestId("setup-next").click();

		// step 4: the school (12.8) — an istituto comprensivo, two classes per year in the media
		await expect(page.getByTestId("setup-step-school")).toBeVisible();
		// the generic type in the language chosen at step 1, not the first one shown (9.41)
		await page.getByLabel("School type").selectOption("generic");
		await expect(page.getByTestId("setup-teacher-group")).toHaveValue("Teachers");
		await expect(page.getByTestId("setup-school-year-start")).toHaveValue("09-01");
		await page.getByLabel("School type").selectOption("it-comprensivo");
		const classes = page.getByTestId("setup-classes");
		await expect(classes).toContainText("Infanzia A");
		await expect(classes).toContainText("3ª D");
		await page.getByTestId("setup-stage-secondaria-I").fill("A-B");
		await expect(classes).toContainText("2ª media B");
		await expect(classes).not.toContainText("2ª media C");
		await expect(classes).toContainText("28 classes to make");
		await page.getByTestId("setup-stage-secondaria-I").fill("1-50");
		await expect(page.getByTestId("setup-next")).toBeDisabled();
		await page.getByTestId("setup-stage-secondaria-I").fill("A, B");
		await expect(page.getByTestId("setup-teacher-group")).toHaveValue("Docenti");
		await expect(page.getByTestId("setup-reading-levels")).toBeChecked();
		await expectAxeClean(page);
		await page.getByTestId("setup-next").click();

		// step 5: the codes (12.8) — copies and cards with a check letter, never alike
		await expect(page.getByTestId("setup-step-codes")).toBeVisible();
		await expect(page.getByTestId("setup-example-item")).toHaveText(/^\d{4}-[A-Z]\d{4}$/);
		await expect(page.getByTestId("setup-example-card")).toHaveText(/^[A-Z]\d{6}$/);
		await page.getByTestId("setup-code-check").selectOption("luhn");
		await expect(page.getByTestId("setup-example-card")).toHaveText(/^\d{7}$/);
		await page.getByTestId("setup-code-check").selectOption("mod23");
		await expect(page.getByTestId("setup-code-verdict")).toContainText("never be confused");
		// the scanners' keyboard follows the language until it is picked by hand
		const layout = page.getByTestId("setup-code-layout");
		await expect(layout).toHaveValue("uk");
		const walk = async (by: "setup-back" | "setup-next"): Promise<void> => {
			for (let i = 0; i < 4; i++) {
				await page.getByTestId(by).click();
			}
		};
		await walk("setup-back");
		await page.getByRole("radio", { name: "Italiano" }).click();
		await walk("setup-next");
		await expect(layout).toHaveValue("it");
		await layout.selectOption("us");
		await walk("setup-back");
		await page.getByRole("radio", { name: "English" }).click();
		await walk("setup-next");
		await expect(layout).toHaveValue("us");
		await layout.selectOption("uk");
		await page.getByTestId("setup-next").click();

		// step 6: demo data, left off for now
		await expect(page.getByTestId("setup-step-demo")).toBeVisible();
		await page.getByTestId("setup-next").click();

		// step 7: passwords, generated for every account (the report account too); regenerate one
		await expect(page.getByTestId("setup-step-passwords")).toBeVisible();
		await expect(page.getByLabel("Reports (report)")).toHaveValue(/.{8,}/);
		const adminField = page.getByLabel("Administration (admin)");
		const before = await adminField.inputValue();
		await page.getByRole("button", { name: "Regenerate" }).first().click();
		expect(await adminField.inputValue()).not.toBe(before);
		await adminField.fill("short");
		await expect(page.getByTestId("setup-next")).toBeDisabled();

		// back to the demo step: with the demo data every account gets the same easy password
		await page.getByTestId("setup-back").click();
		await page.getByTestId("demo-checkbox").check();
		await page.getByTestId("setup-next").click();
		await expect(page.getByTestId("demo-passwords")).toContainText("biblioviva");
		await expect(adminField).toHaveValue("biblioviva");
		await expect(adminField).toHaveAttribute("readonly", "");
		await expect(page.getByLabel("Reports (report)")).toHaveValue("biblioviva");
		await page.getByTestId("setup-next").click();

		// step 8: summary → finish
		await expect(page.getByTestId("setup-step-summary")).toContainText("Rodari library");
		await expect(page.getByTestId("setup-summary-classes")).toContainText("28 classes");
		await expect(page.getByTestId("setup-summary-photos")).toHaveText("Yes");
		await expect(page.getByTestId("setup-summary-covers")).toHaveText("Yes");
		await expect(page.getByTestId("setup-step-summary")).toContainText("biblioviva");
		await page.getByTestId("setup-finish").click();
		await expect(page.getByTestId("setup-done")).toBeVisible({ timeout: 120_000 });
		await expect(page.getByTestId("pw-admin")).toHaveText("biblioviva");
		await expect(page.getByTestId("setup-demo-summary")).toContainText("300 patrons");

		// the written configuration validates
		const check = execFileSync(
			"bun",
			["run", "scripts/config-check.ts", join(runDir, "config", "config.json")],
			{
				encoding: "utf8",
			},
		);
		expect(check).toContain("OK:");
		const written = JSON.parse(readFileSync(join(runDir, "config", "config.json"), "utf8")) as {
			school: { preset: string; levels: { code: string }[] };
			barcodes: { item: { format: { pattern: string; check: string } } };
		};
		expect(written.school.preset).toBe("it-comprensivo");
		expect(written.school.levels.map((l) => l.code)).toHaveLength(11);
		expect(written.barcodes.item.format).toEqual({ pattern: "YYYY-CNNNN", check: "mod23" });
		// the folder layout of §3.6: the default fragments are in place next to the wizard's config.json
		expect(existsSync(join(runDir, "config", "classification.json"))).toBe(true);
		expect(existsSync(join(runDir, "config", "labels", "stocks", "a4-70x48.json"))).toBe(true);
		expect(check).toContain("classification.json");

		// login with the new admin password → dashboard in English with the demo warning and counts
		await page.getByTestId("go-login").click();
		await expect(page).toHaveURL(/\/login/);
		await waitForHydration(page);
		await page.getByRole("textbox", { name: "Username" }).fill("admin");
		await page.getByRole("textbox", { name: "Password" }).fill("biblioviva");
		await page.getByRole("button", { name: "Log in" }).click();
		await expect(page).toHaveURL(
			new RegExp(`${base.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/$`),
		);
		await expect(page.locator("html")).toHaveAttribute("data-theme", "sunset");
		await expect(page.getByTestId("demo-counts")).toContainText("300 patrons");
		// the demo data follow the school and the codes chosen (12.8)
		await page.goto(`${base}/admin/classes`);
		await waitForHydration(page);
		await expect(page.getByTestId("classes-stage-infanzia")).toContainText("Infanzia A");
		await expect(page.getByTestId("classes-stage-secondaria-I")).toContainText("2ª media B");
		await expect(page.getByTestId("classes-stage-secondaria-I")).not.toContainText(
			"2ª media C",
		);
		const patronsCsv = (
			await (await page.request.get(`${base}/export/patrons?format=csv`)).body()
		).toString("utf8");
		expect(patronsCsv).toMatch(/;4 anni Infanzia A;[A-Z]\d{6};/);
		expect(patronsCsv).toMatch(/;3ª B;[A-Z]\d{6};/);

		// the wizard cannot run again
		const rerun = await page.request.get(`${base}/setup`);
		expect(rerun.status()).toBe(404);

		// the language can be changed later from Administration (own server: the shared one stays Italian)
		await page.goto(`${base}/admin/appearance`);
		await waitForHydration(page);
		await expect(page.getByTestId("locale-select")).toHaveValue("en");
		await expect(page.getByTestId("save-locale")).toBeDisabled();
		await expect(page.getByTestId("locale-select").locator("option")).toHaveText([
			"English",
			"Italiano",
			"Deutsch",
		]);
		// the built-in languages were written as example packs to clone
		expect(existsSync(join(runDir, "config", "i18n", "it", "pack.json"))).toBe(true);
		await page.getByTestId("locale-select").selectOption("de");
		await page.getByTestId("save-locale").click();
		await expect(page.locator("html")).toHaveAttribute("lang", "de");
		await waitForHydration(page);
		await page.getByTestId("locale-select").selectOption("it");
		await page.getByTestId("save-locale").click();
		await expect(page.locator("html")).toHaveAttribute("lang", "it");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aspetto e lingua");
		await page.getByTestId("locale-select").selectOption("en");
		await page.getByTestId("save-locale").click();
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Appearance and language");

		// clearing the demo data resets the database and signs everyone out
		await page.goto(`${base}/admin`);
		await waitForHydration(page);
		await page.getByTestId("clear-demo").click();
		await page.getByTestId("confirm-button").click();
		await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
		// the accounts keep the demo password until it is changed, and the message says so
		await expect(page.getByText("The accounts still have the demo password")).toBeVisible();
		await waitForHydration(page);
		await page.getByRole("textbox", { name: "Username" }).fill("admin");
		await page.getByRole("textbox", { name: "Password" }).fill("biblioviva");
		await page.getByRole("button", { name: "Log in" }).click();
		await expect(page).not.toHaveURL(/\/login/);
		await expect(page.getByTestId("demo-counts")).toHaveCount(0);
		// the classes chosen in the wizard are school configuration: they stay (9.42)
		await page.goto(`${base}/admin/classes`);
		await waitForHydration(page);
		await expect(page.getByTestId("classes-stage-infanzia")).toContainText("Infanzia A");
		await expect(page.getByTestId("classes-stage-secondaria-I")).toContainText("2ª media B");
		await expect(page.getByTestId("classes-teachers")).toBeVisible();
	});
});

// step 12.8: a second installation with a foreign school — French classes (`CP A`, `CE1 B`) and
// codes with a letter in front and a Damm check digit, followed by the demo data
test.describe.serial("first-run wizard for a foreign school", () => {
	test.use({ storageState: { cookies: [], origins: [] } });
	let foreign: ChildProcess | undefined;
	let foreignDir = "";
	let url = "";

	test.beforeAll(async () => {
		foreignDir = mkdtempSync(join(tmpdir(), "bv-wizard-fr-"));
		({ server: foreign, base: url } = await startServer(foreignDir));
	});

	test.afterAll(() => {
		foreign?.kill();
		rmSync(foreignDir, { recursive: true, force: true });
	});

	test("French classes and codes with a letter in front", async ({ page, isMobile }) => {
		test.skip(isMobile, "one installation is enough: the wizard itself is tested on both");
		test.setTimeout(180_000);
		await page.goto(`${url}/`);
		await expect(page).toHaveURL(/\/setup/);
		await waitForHydration(page);
		await page.getByTestId("setup-next").click();
		await page.getByTestId("setup-next").click();
		await page.getByLabel("Library name").fill("École Jules Verne");
		await page.getByTestId("setup-next").click();

		await page.getByLabel("School type").selectOption("fr-elementaire");
		const classes = page.getByTestId("setup-classes");
		await expect(classes).toContainText("CP A");
		await expect(classes).toContainText("CM2 B");
		await page.getByTestId("setup-next").click();

		// copies and cards each take their own ready-made format, the recommended one proposed
		await expect(page.getByTestId("setup-code-item")).toHaveValue("standard");
		await expect(page.getByTestId("setup-code-card")).toHaveValue("standard");
		await page.getByTestId("setup-code-item").selectOption("prefix");
		await page.getByTestId("setup-code-check").selectOption("damm");
		await expect(page.getByTestId("setup-example-item")).toHaveText(/^L-\d{7}$/);
		await expect(page.getByTestId("setup-example-card")).toHaveText(/^\d{7}$/);
		await page.getByTestId("setup-code-card").selectOption("prefix");
		await expect(page.getByTestId("setup-example-card")).toHaveText(/^T\d{7}$/);
		await page.getByTestId("setup-next").click();

		await page.getByTestId("demo-checkbox").check();
		await page.getByTestId("setup-next").click();
		await page.getByTestId("setup-next").click();
		await page.getByTestId("setup-finish").click();
		await expect(page.getByTestId("setup-done")).toBeVisible({ timeout: 120_000 });

		await page.getByTestId("go-login").click();
		await waitForHydration(page);
		await page.getByRole("textbox", { name: "Username" }).fill("admin");
		await page.getByRole("textbox", { name: "Password" }).fill("biblioviva");
		await page.getByRole("button", { name: "Log in" }).click();
		// the warning of the demo data: the dashboard's panel only, nothing in the top bar (9.13,
		// round 24)
		await expect(page.getByTestId("demo-counts")).toBeVisible();
		await expect(page.getByTestId("app-bar")).not.toContainText(
			/Sample data|Dati dimostrativi/,
		);
		await page.goto(`${url}/admin/classes`);
		await waitForHydration(page);
		await expect(page.getByTestId("classes-stage-elementaire")).toContainText("CE1 B");
		const csv = (
			await (await page.request.get(`${url}/export/patrons?format=csv`)).body()
		).toString("utf8");
		expect(csv).toMatch(/;CE1 B;T\d{7};/);
	});
});
