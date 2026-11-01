// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import { closeDb, getDb } from "#lib/server/db/index.js";
import { biblio, patron, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { logoPath } from "#lib/server/services/branding.js";
import { WIZARD_ACCOUNTS } from "#lib/server/services/setup.js";
import { buildPublicDemo, DEMO_DIR_MARKER, NotADemoFolderError } from "./build.js";

let root = "";
let configDir = "";
let dataDir = "";
const saved = {
	CONFIG_DIR: process.env.CONFIG_DIR,
	DATA_DIR: process.env.DATA_DIR,
	DATABASE_PATH: process.env.DATABASE_PATH,
};
const now = new Date("2026-10-17T08:00:00Z");

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "bv-demo-build-"));
	configDir = join(root, "config");
	dataDir = join(root, "data");
	process.env.CONFIG_DIR = configDir;
	process.env.DATA_DIR = dataDir;
	delete process.env.DATABASE_PATH;
	resetEnvCache();
	resetConfigCache();
});

afterAll(() => {
	closeDb();
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	resetEnvCache();
	resetConfigCache();
	rmSync(root, { recursive: true, force: true });
});

const counts = (): { patrons: number; biblios: number; staff: string[] } => ({
	patrons: getDb().select().from(patron).all().length,
	biblios: getDb().select().from(biblio).all().length,
	staff: getDb()
		.select({ username: staffUser.username })
		.from(staffUser)
		.all()
		.map((u) => u.username)
		.sort(),
});

describe("the public demo built at every start", () => {
	it("fills empty folders as the wizard would, with the demo data and the logo", async () => {
		const built = await buildPublicDemo({ configDir, dataDir }, now);
		expect(built.patrons).toBeGreaterThan(50);
		expect(built.biblios).toBeGreaterThan(50);
		expect(getConfig().library.name).toBe("Demo");
		expect(getConfig().ui.locale).toBe("it");
		expect(existsSync(logoPath(configDir))).toBe(true);
		expect(existsSync(join(configDir, DEMO_DIR_MARKER))).toBe(true);
		expect(existsSync(join(dataDir, DEMO_DIR_MARKER))).toBe(true);
		const c = counts();
		expect(c.patrons).toBe(built.patrons);
		expect(c.staff).toEqual([...WIZARD_ACCOUNTS].sort());
	}, 120_000);

	it("throws away what visitors left and builds the same demo again", async () => {
		const before = counts();
		getDb().update(biblio).set({ title: "Rovinato" }).run();
		writeFileSync(join(dataDir, "left-by-a-visitor.txt"), "x");
		mkdirSync(join(configDir, "templates", "cards", "copy"), { recursive: true });
		await buildPublicDemo({ configDir, dataDir }, now);
		expect(counts()).toEqual(before);
		expect(getDb().select({ title: biblio.title }).from(biblio).all()).not.toContainEqual({
			title: "Rovinato",
		});
		expect(existsSync(join(dataDir, "left-by-a-visitor.txt"))).toBe(false);
		expect(existsSync(join(configDir, "templates", "cards", "copy"))).toBe(false);
	}, 120_000);

	it("never empties a folder that is not the demo's", async () => {
		const school = mkdtempSync(join(tmpdir(), "bv-school-"));
		writeFileSync(join(school, "config.json"), "{}");
		const empty = mkdtempSync(join(tmpdir(), "bv-empty-"));
		try {
			await expect(
				buildPublicDemo({ configDir: school, dataDir: empty }, now),
			).rejects.toBeInstanceOf(NotADemoFolderError);
			expect(readdirSync(school)).toEqual(["config.json"]);
			// nothing written in the other folder either
			expect(readdirSync(empty)).toEqual([]);
		} finally {
			rmSync(school, { recursive: true, force: true });
			rmSync(empty, { recursive: true, force: true });
		}
	});
});
