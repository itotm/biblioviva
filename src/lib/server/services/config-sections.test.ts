// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import { ConfigError, loadConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { listConfigChanges } from "./config-edit.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import { ConfigInUseError } from "./config-references.js";
import {
	checkSectionJson,
	configHistory,
	configOverview,
	NotASettingError,
	RevertRefusedError,
	revertChange,
	saveConfigKeys,
	saveSectionJson,
	saveSettingIfChanged,
	saveSettings,
	saveUiChoice,
	sectionView,
	UnknownSectionError,
} from "./config-sections.js";
import { createPatron, patronRules } from "./patrons.js";
import { classId, PATRON_RULES } from "../../../../tests/helpers/school.js";

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-config-sections-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
	setUiTheme(dir, "ocean"); // config.json from the example, plus the shipped fragments
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

describe("the colour set and the language", () => {
	it("are written where a ui.json fragment holds them, guarded and audited", () => {
		const { db, actor } = database();
		const config = JSON.parse(readFileSync(join(dir, "config.json"), "utf8")) as Record<
			string,
			unknown
		>;
		writeFileSync(join(dir, "ui.json"), JSON.stringify(config.ui));
		delete config.ui;
		writeFileSync(join(dir, "config.json"), JSON.stringify(config));
		expect(saveUiChoice(db, dir, "locale", "it", actor)?.action).toBe("config.locale");
		expect(saveUiChoice(db, dir, "theme", "grape", actor)?.action).toBe("config.theme");
		expect(saveUiChoice(db, dir, "theme", "grape", actor)).toBeNull();
		expect(loadConfig(dir).config.ui).toMatchObject({ locale: "it", theme: "grape" });
		expect(JSON.parse(readFileSync(join(dir, "ui.json"), "utf8"))).toMatchObject({
			locale: "it",
			theme: "grape",
		});
		expect(configJson().ui).toBeUndefined();
		const rows = db.select().from(auditLog).all();
		expect(rows.map((r) => [r.action, r.details])).toEqual([
			["config.locale", expect.objectContaining({ from: "en", to: "it" })],
			["config.theme", expect.objectContaining({ from: "ocean", to: "grape" })],
		]);
		expect(() => saveUiChoice(db, dir, "theme", "neon", actor)).toThrow(ConfigError);
	});
});

describe("one setting saved when it changes", () => {
	it("writes the library's name and the area style once, nothing for the same value", () => {
		const { db, actor } = database();
		expect(
			saveSettingIfChanged(db, dir, "library.name", "Biblioteca Rodari", actor),
		).not.toBeNull();
		expect(
			saveSettingIfChanged(db, dir, "library.name", "Biblioteca Rodari", actor),
		).toBeNull();
		const style = loadConfig(dir).config.ui.areaStyle;
		expect(saveSettingIfChanged(db, dir, "ui.areaStyle", style, actor)).toBeNull();
		expect(loadConfig(dir).config.library.name).toBe("Biblioteca Rodari");
		expect(
			db
				.select()
				.from(auditLog)
				.all()
				.map((r) => r.action),
		).toEqual(["config.library"]);
	});
});

const configJson = (): Record<string, Record<string, unknown>> =>
	JSON.parse(readFileSync(join(dir, "config.json"), "utf8")) as Record<
		string,
		Record<string, unknown>
	>;

describe("overview", () => {
	it("lists the sections with their files and tells when the files changed by hand", async () => {
		const running = loadConfig(dir);
		const overview = await configOverview(running, dir);
		expect(overview.source).toBe("file");
		expect(overview.files).toContain("config.json");
		expect(overview.files).toContain("classification.json");
		expect(overview.disk).toEqual({ ok: true, changed: false });
		const find = (s: string): (typeof overview.sections)[number] | undefined =>
			overview.sections.find((x) => x.section === s);
		expect(find("privacy")).toMatchObject({
			file: "config.json",
			alsoFrom: [],
			href: "/admin/config/privacy",
			pending: 0,
		});
		expect(find("classification")).toMatchObject({
			file: "classification.json",
			href: "/admin/config/classification",
		});
		expect(find("labels")?.alsoFrom).toContain("labels/stocks/a4-70x48.json");
		expect(find("library")?.pending).toBe(0);
		expect(find("circulation")?.pending).toBe(0);
		expect(find("security")?.pending).toBe(0);

		const doc = configJson();
		(doc.privacy ??= {}).auditRetentionMonths = 30;
		writeFileSync(join(dir, "config.json"), JSON.stringify(doc));
		expect((await configOverview(running, dir)).disk).toEqual({ ok: true, changed: true });
		writeFileSync(
			join(dir, "config.json"),
			JSON.stringify({ ...doc, privacy: { auditRetentionMonths: 0 } }),
		);
		const broken = (await configOverview(running, dir)).disk;
		expect(broken.ok).toBe(false);
		expect(!broken.ok && broken.issues[0]).toMatchObject({
			path: "privacy.auditRetentionMonths",
			file: "config.json",
		});
	});
});

describe("section view", () => {
	it("gives the settings with their value, file and default, and what is edited elsewhere", () => {
		const view = sectionView(loadConfig(dir), dir, "privacy");
		expect(view.fields).toEqual([
			expect.objectContaining({
				path: "privacy.auditRetentionMonths",
				kind: "integer",
				value: 24,
				defined: true,
				file: "config.json",
				default: 24,
			}),
		]);
		expect(view.raw).toEqual({ auditRetentionMonths: 24 });
		expect(view.elsewhere).toEqual([]);
		const library = sectionView(loadConfig(dir), dir, "library");
		// item types and sections have their blocks on the page itself
		expect(library.elsewhere).toEqual([]);
		expect(library.fields.map((f) => f.path)).not.toContain("library.sections");
		const security = sectionView(loadConfig(dir), dir, "security");
		expect(security.elsewhere.map((e) => [e.key, e.href])).toEqual([
			["security.auth", "/admin/users"],
			["security.users", "/admin/users"],
			["security.roles", "/admin/users"],
		]);
		expect(sectionView(loadConfig(dir), dir, "circulation").elsewhere).toEqual([]);
		expect(Object.keys(library.raw)).not.toContain("_commentSchool");
		const ui = sectionView(loadConfig(dir), dir, "ui");
		expect(ui.fields.map((f) => f.path)).toEqual(["ui.checkoutIdleSeconds"]);
		expect(ui.elsewhere).toEqual([
			{ key: "ui.locale", coverage: { editor: "appearance" }, href: "/admin/appearance" },
			{ key: "ui.theme", coverage: { editor: "appearance" }, href: "/admin/appearance" },
			{ key: "ui.dashboard", coverage: { editor: "appearance" }, href: "/admin/appearance" },
			{ key: "ui.areaStyle", coverage: { editor: "appearance" }, href: "/admin/appearance" },
			{ key: "ui.setupCompleted", coverage: { editor: "wizard" }, href: null },
		]);
		expect(() => sectionView(loadConfig(dir), dir, "nope")).toThrow(UnknownSectionError);
	});
});

describe("saving settings", () => {
	it("writes each key in the file that defines it and can go back to the default", () => {
		const { db, actor } = database();
		const change = saveSettings(
			db,
			dir,
			"privacy",
			{ set: { "privacy.auditRetentionMonths": 30 }, reset: [] },
			actor,
		);
		expect(change.action).toBe("config.privacy");
		expect(configJson().privacy).toMatchObject({ auditRetentionMonths: 30 });
		expect(getConfig().privacy.auditRetentionMonths).toBe(30);
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "config.privacy")).get()?.details,
		).toEqual({ change: change.id, keys: ["privacy.auditRetentionMonths"] });

		saveSettings(
			db,
			dir,
			"privacy",
			{ set: {}, reset: ["privacy.auditRetentionMonths"] },
			actor,
		);
		// the key is gone, the file's comment stays
		expect(configJson().privacy).not.toHaveProperty("auditRetentionMonths");
		expect(configJson().privacy?._comment).toBeDefined();
		expect(getConfig().privacy.auditRetentionMonths).toBe(24);

		// a section in its own fragment is written there
		writeFileSync(join(dir, "backup.json"), JSON.stringify({ keepDays: 10 }));
		saveSettings(
			db,
			dir,
			"backup",
			{ set: { "backup.keepDays": 12, "backup.offsite.enabled": true }, reset: [] },
			actor,
		);
		// keepDays is defined by the fragment, offsite by config.json: each stays where it is
		expect(JSON.parse(readFileSync(join(dir, "backup.json"), "utf8"))).toEqual({
			keepDays: 12,
		});
		expect(configJson().backup?.offsite).toMatchObject({ enabled: true });
		expect(getConfig().backup).toMatchObject({ keepDays: 12, offsite: { enabled: true } });
	});

	it("refuses keys the form does not edit, invalid values and removing what is in use", () => {
		const { db, actor } = database();
		const before = listConfigChanges(dir).length;
		expect(() =>
			saveSettings(
				db,
				dir,
				"library",
				{ set: { "library.itemTypes": [] }, reset: [] },
				actor,
			),
		).toThrow(NotASettingError);
		expect(() =>
			saveSettings(
				db,
				dir,
				"barcodes",
				{ set: { "barcodes.patron.totalDigits": 12 }, reset: [] },
				actor,
			),
		).toThrow(NotASettingError);
		expect(() =>
			saveSettings(
				db,
				dir,
				"privacy",
				{ set: { "privacy.auditRetentionMonths": 0 }, reset: [] },
				actor,
			),
		).toThrow(ConfigError);
		createPatron(
			db,
			{
				patronType: "student",
				firstName: "Anna",
				lastName: "Rossi",
				levelCode: "5",
				groupId: String(classId(db, "5", "B")),
				groupName: "",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			PATRON_RULES,
		);
		const levels = getConfig().school.levels.filter((l) => l.code !== "5");
		expect(() =>
			saveSettings(db, dir, "school", { set: { "school.levels": levels }, reset: [] }, actor),
		).toThrow(NotASettingError);
		try {
			saveSectionJson(
				db,
				dir,
				"school",
				{ ...sectionView(loadConfig(dir), dir, "school").raw, levels },
				actor,
			);
			expect.unreachable();
		} catch (e) {
			expect(e).toBeInstanceOf(ConfigInUseError);
			expect((e as ConfigInUseError).problems).toEqual([
				{ kind: "level", code: "5", count: 1 },
			]);
		}
		expect(getConfig().school.levels.map((l) => l.code)).toContain("5");
		expect(listConfigChanges(dir)).toHaveLength(before);
	});
});

describe("editor blocks", () => {
	it("save whole keys of their section, audited under the section", () => {
		const { db, actor } = database();
		const overrides = { dvd: { loanDays: 3 }, libro: { maxLoans: 2 } };
		saveConfigKeys(
			db,
			dir,
			"circulation",
			{ "circulation.itemTypeOverrides": overrides },
			actor,
		);
		expect(getConfig().circulation.itemTypeOverrides).toEqual(overrides);
		expect(configJson().circulation?.itemTypeOverrides).toEqual(overrides);
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "config.circulation")).get()
				?.details,
		).toMatchObject({ keys: ["circulation.itemTypeOverrides"] });
		expect(() =>
			saveConfigKeys(db, dir, "circulation", { "privacy.auditRetentionMonths": 1 }, actor),
		).toThrow(NotASettingError);
	});
});

describe("section as JSON", () => {
	it("checks and saves the section as its file writes it, folder pieces left alone", () => {
		const { db, actor } = database();
		expect(checkSectionJson(dir, "privacy", { auditRetentionMonths: 0 })).toEqual([
			expect.objectContaining({ level: "error", path: "privacy.auditRetentionMonths" }),
		]);
		expect(
			checkSectionJson(dir, "privacy", { auditRetentionMonths: 36 }).filter(
				(i) => i.level === "error",
			),
		).toEqual([]);
		saveSectionJson(db, dir, "privacy", { auditRetentionMonths: 36 }, actor);
		expect(getConfig().privacy.auditRetentionMonths).toBe(36);

		// the stocks come from labels/stocks/*.json: saving the section does not copy them
		const stocks = getConfig().labels.stocks.length;
		const labels = sectionView(loadConfig(dir), dir, "labels").raw;
		expect(labels.stocks).toBeUndefined();
		saveSectionJson(db, dir, "labels", { ...labels, titleMaxChars: 25 }, actor);
		expect(getConfig().labels).toMatchObject({ titleMaxChars: 25 });
		expect(getConfig().labels.stocks).toHaveLength(stocks);
		expect(configJson().labels?._commentStocks).toBeDefined();

		expect(() => saveSectionJson(db, dir, "classification", {}, actor)).toThrow(
			UnknownSectionError,
		);
		expect(() => checkSectionJson(dir, "nope", {})).toThrow(UnknownSectionError);
	});
});

describe("history", () => {
	it("restores the previous version, never the creation of config.json, never what is in use", () => {
		const { db, actor } = database();
		const created = listConfigChanges(dir)[0];
		const change = saveSettings(
			db,
			dir,
			"privacy",
			{ set: { "privacy.auditRetentionMonths": 30 }, reset: [] },
			actor,
		);
		expect(configHistory(dir)[0]?.id).toBe(change.id);
		const restore = revertChange(db, dir, change.id, actor);
		expect(restore.action).toBe(`revert ${change.id}`);
		expect(getConfig().privacy.auditRetentionMonths).toBe(24);
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "config.revert")).get()?.details,
		).toEqual({ change: restore.id, of: change.id });
		expect(() => revertChange(db, dir, created?.id ?? "", actor)).toThrow(RevertRefusedError);

		// a level added, then used: taking it away again is refused
		const school = sectionView(loadConfig(dir), dir, "school").raw;
		const added = saveSectionJson(
			db,
			dir,
			"school",
			{
				...school,
				levels: [
					...getConfig().school.levels,
					{ code: "6", label: "6", name: "Sesta primaria", stage: "primaria" },
				],
			},
			actor,
		);
		createPatron(
			db,
			{
				patronType: "student",
				firstName: "Bruno",
				lastName: "Verdi",
				levelCode: "6",
				groupId: String(classId(db, "6", "F")),
				groupName: "",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			patronRules(getConfig()),
		);
		expect(() => revertChange(db, dir, added.id, actor)).toThrow(ConfigInUseError);
		expect(getConfig().school.levels.map((l) => l.code)).toContain("6");
	});
});
