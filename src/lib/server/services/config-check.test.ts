// SPDX-License-Identifier: GPL-3.0-or-later
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCache } from "#lib/server/config/index.js";
import { loadConfig } from "#lib/server/config/load.js";
import { checkFolder } from "./config-check.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import { configOverview } from "./config-sections.js";

let dir = "";
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-config-check-"));
	setUiTheme(dir, "ocean");
});
afterEach(() => {
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

describe("the check of a configuration folder", () => {
	it("passes a valid folder", async () => {
		const check = await checkFolder(dir);
		expect(check.ok).toBe(true);
		expect(check.loaded?.config.ui.theme).toBe("ocean");
		expect(check.issues.filter((i) => i.level === "error")).toEqual([]);
	});

	it("refuses what the import refuses, beyond the schema: a broken report, a missing template", async () => {
		mkdirSync(join(dir, "reports"), { recursive: true });
		writeFileSync(join(dir, "reports", "broken.json"), "{ not json");
		const check = await checkFolder(dir);
		expect(check.ok).toBe(false);
		expect(check.issues).toContainEqual(
			expect.objectContaining({ level: "error", file: "reports/broken.json" }),
		);
		// the overview of Configurazione shows the same verdict for the folder on disk
		const overview = await configOverview(loadConfig(dir), dir);
		expect(overview.disk.ok).toBe(false);
	});

	it("reports a schema error with its file, and checks a base document given apart", async () => {
		const valid = loadConfig(dir).config;
		writeFileSync(join(dir, "ui.json"), JSON.stringify({ theme: "no-such-theme" }));
		const check = await checkFolder(dir);
		expect(check.ok).toBe(false);
		expect(check.loaded).toBeNull();
		expect(check.issues[0]).toMatchObject({ path: "ui.theme", file: "ui.json" });
		const other = mkdtempSync(join(tmpdir(), "bv-config-check-"));
		try {
			writeFileSync(join(other, "base.json"), JSON.stringify(valid));
			const apart = await checkFolder(other, { base: join(other, "base.json") });
			expect(apart.loaded?.path).toBe(join(other, "base.json"));
		} finally {
			rmSync(other, { recursive: true, force: true });
		}
	});

	it("refuses a broken language pack, or warns of it as the server does when asked", async () => {
		const pack = join(dir, "i18n", "xx");
		mkdirSync(pack, { recursive: true });
		cpSync("src/lib/i18n/en", pack, { recursive: true });
		rmSync(join(pack, "nav.json"));
		writeFileSync(
			join(pack, "pack.json"),
			JSON.stringify({ name: "Broken", nativeName: "Xx" }),
		);
		const strict = await checkFolder(dir);
		expect(strict.ok).toBe(false);
		expect(strict.issues).toContainEqual(
			expect.objectContaining({ level: "error", path: "i18n.xx", file: "i18n/xx/nav.json" }),
		);
		// `config:check`: the server skips such a pack and starts
		const tolerant = await checkFolder(dir, { packsAsWarnings: true });
		expect(tolerant.ok).toBe(true);
		expect(tolerant.issues).toContainEqual(
			expect.objectContaining({ level: "warning", path: "i18n.xx" }),
		);
	});
});
