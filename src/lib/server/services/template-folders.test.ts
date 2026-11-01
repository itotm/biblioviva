// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import { ConfigError } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import { staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { revertConfigChange, setUiTheme } from "../../../../tests/helpers/config.js";
import { saveConfigKeys } from "./config-sections.js";
import {
	addCardBackground,
	cardBackgroundFile,
	cardBackgrounds,
	deleteTemplate,
	deleteTemplateAsset,
	duplicateTemplate,
	renameTemplate,
	TemplateFolderError,
	templateFolders,
	uploadTemplateAsset,
} from "./template-folders.js";
import { missingTemplates, templateReferences } from "./template-refs.js";

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-template-folders-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
	setUiTheme(dir, "ocean"); // config.json and the shipped template folders
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

function database(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const folder = (kind: string, name: string): string => join(dir, kind, "templates", name);

describe("template references", () => {
	it("lists the settings naming a template and those naming one that does not exist", () => {
		const config = getConfig();
		expect(templateReferences(config).map((r) => r.key)).toEqual([
			"cards.defaultTemplate",
			"labels.pair.template",
			"labels.barcode.template",
			"labels.spine.template",
			"circulation.overdueNotice.template",
		]);
		expect(templateReferences(config).map((r) => r.labelKind ?? null)).toEqual([
			null,
			"pair",
			"barcode",
			"spine",
			null,
		]);
		expect(missingTemplates(config, dir)).toEqual([]);
		const { db, actor } = database();
		expect(() =>
			saveConfigKeys(db, dir, "cards", { "cards.defaultTemplate": "nope" }, actor),
		).toThrow(ConfigError);
		expect(getConfig().cards.defaultTemplate).toBe("default");
	});
});

describe("template folders", () => {
	it("lists every folder with its source, the settings naming it and its assets", () => {
		const list = templateFolders(getConfig(), dir);
		const card = list.find((t) => t.kind === "cards" && t.name === "default");
		expect(card).toMatchObject({
			source: "config",
			overridesBuiltin: true,
			usedBy: ["cards.defaultTemplate"],
			error: null,
		});
		expect(card?.files).toContain("template.json");
		expect(card?.assets.find((a) => a.file === "logo.png")?.usedIn).not.toEqual([]);
		expect(list.find((t) => t.name === "pair-default")?.labelKind).toBe("pair");
	});

	it("duplicates, renames with the settings following, and deletes a template", () => {
		const { db, actor } = database();
		duplicateTemplate(db, dir, "cards", "default", "docenti", actor);
		expect(
			JSON.parse(readFileSync(join(folder("cards", "docenti"), "template.json"), "utf8"))
				.name,
		).toBe("docenti");
		expect(existsSync(join(folder("cards", "docenti"), "assets", "background-d4.webp"))).toBe(
			true,
		);
		expect(() => duplicateTemplate(db, dir, "cards", "default", "docenti", actor)).toThrow(
			TemplateFolderError,
		);
		expect(() => duplicateTemplate(db, dir, "cards", "default", "Bad Name", actor)).toThrow(
			TemplateFolderError,
		);

		saveConfigKeys(
			db,
			dir,
			"cards",
			{ "cards.templateByPatronType": { teacher: "docenti" } },
			actor,
		);
		renameTemplate(db, dir, "cards", "docenti", "insegnanti", actor);
		expect(existsSync(folder("cards", "docenti"))).toBe(false);
		expect(getConfig().cards.templateByPatronType).toEqual({ teacher: "insegnanti" });

		// in use and not a built-in: refused; not used any more: removed with its folder
		expect(() => deleteTemplate(db, dir, "cards", "insegnanti", actor)).toThrow(
			TemplateFolderError,
		);
		saveConfigKeys(db, dir, "cards", { "cards.templateByPatronType": {} }, actor);
		const removed = deleteTemplate(db, dir, "cards", "insegnanti", actor);
		expect(existsSync(folder("cards", "insegnanti"))).toBe(false);
		// and back from the history
		revertConfigChange(dir, removed.id);
		expect(existsSync(join(folder("cards", "insegnanti"), "front.html"))).toBe(true);
	});

	it("a copy of a built-in template may go while in use: the original takes its place", () => {
		const { db, actor } = database();
		deleteTemplate(db, dir, "cards", "default", actor);
		expect(existsSync(folder("cards", "default"))).toBe(false);
		const card = templateFolders(getConfig(), dir).find((t) => t.name === "default");
		expect(card?.source).toBe("builtin");
		expect(() => deleteTemplate(db, dir, "cards", "default", actor)).toThrow(
			TemplateFolderError,
		);
		expect(() => renameTemplate(db, dir, "cards", "default", "x", actor)).toThrow(
			TemplateFolderError,
		);
		// customising it again: a copy with the same name
		duplicateTemplate(db, dir, "cards", "default", "default", actor);
		expect(templateFolders(getConfig(), dir).find((t) => t.name === "default")?.source).toBe(
			"config",
		);
	});

	it("uploads and removes assets, refusing unknown types, fake images and files in use", () => {
		const { db, actor } = database();
		uploadTemplateAsset(db, dir, "cards", "default", "stemma.png", PNG, actor);
		expect(existsSync(join(folder("cards", "default"), "assets", "stemma.png"))).toBe(true);
		const bad =
			(file: string, bytes: Uint8Array): (() => unknown) =>
			() =>
				uploadTemplateAsset(db, dir, "cards", "default", file, bytes, actor);
		expect(bad("x.exe", PNG)).toThrow(TemplateFolderError);
		expect(bad("../x.png", PNG)).toThrow(TemplateFolderError);
		expect(bad("fake.png", new TextEncoder().encode("hello"))).toThrow(TemplateFolderError);
		expect(bad("evil.svg", new TextEncoder().encode("<svg><script>1</script></svg>"))).toThrow(
			TemplateFolderError,
		);
		expect(() => deleteTemplateAsset(db, dir, "cards", "default", "logo.png", actor)).toThrow(
			TemplateFolderError,
		);
		deleteTemplateAsset(db, dir, "cards", "default", "stemma.png", actor);
		expect(existsSync(join(folder("cards", "default"), "assets", "stemma.png"))).toBe(false);
	});

	it("reports a broken folder without breaking the others", () => {
		mkdirSync(folder("slips", "rotto"), { recursive: true });
		writeFileSync(join(folder("slips", "rotto"), "template.json"), "{");
		const list = templateFolders(getConfig(), dir);
		expect(list.find((t) => t.name === "rotto")?.error).toMatch(/template\.json/);
		expect(list.find((t) => t.name === "overdue-by-class")?.error).toBeNull();
	});
});

describe("shipped card backgrounds (step 11.17)", () => {
	it("lists them with their orientation and copies one into a template's assets", () => {
		const list = cardBackgrounds();
		expect(list.length).toBeGreaterThanOrEqual(3);
		expect(list.find((b) => b.name === "d4")).toEqual({ name: "d4", orientation: "landscape" });
		expect(list.find((b) => b.name === "h5")).toEqual({ name: "h5", orientation: "portrait" });
		expect(cardBackgroundFile("../config")).toBeNull();
		expect(cardBackgroundFile("zz")).toBeNull();

		const { db, actor } = database();
		duplicateTemplate(db, dir, "cards", "default", "classi", actor);
		expect(addCardBackground(db, dir, "classi", "c8", actor)).toBe("background-c8.webp");
		const copied = readFileSync(
			join(folder("cards", "classi"), "assets", "background-c8.webp"),
		);
		expect(Buffer.compare(copied, Buffer.from(cardBackgroundFile("c8") ?? []))).toBe(0);
		expect(() => addCardBackground(db, dir, "classi", "nope", actor)).toThrow(
			TemplateFolderError,
		);
	});
});
