// SPDX-License-Identifier: GPL-3.0-or-later
import { callNumberScheme } from "#lib/shared/classification.js";
import { TEST_CODES } from "../../../../tests/helpers/codes.js";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { loadConfig, parseConfig, readJsonFile } from "#lib/server/config/load.js";
import { exampleRaw } from "#lib/server/config/load.js";
import { resetConfigCache } from "#lib/server/config/index.js";
import { auditLog, classGroup, classGroupLevel, patron, staffUser } from "#lib/server/db/schema.js";
import { listConfigChanges } from "./config-edit.js";
import {
	completeSetup,
	isSetupMode,
	loadDemoData,
	readDemoInfo,
	removeDemoData,
	restoreSchoolClasses,
	setupDefaults,
	snapshotSchoolClasses,
	writeDemoSetupConfig,
	writeSetupConfig,
	type SetupInput,
} from "./setup.js";

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-setup-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	resetConfigCache();
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const hashes = {
	admin: "$argon2id$v=19$m=65536,t=2,p=1$a$a",
	prestiti: "$argon2id$v=19$m=65536,t=2,p=1$b$b",
	catalogo: "$argon2id$v=19$m=65536,t=2,p=1$c$c",
	tessere: "$argon2id$v=19$m=65536,t=2,p=1$d$d",
	report: "$argon2id$v=19$m=65536,t=2,p=1$e$e",
};

describe("setup service", () => {
	it("detects setup mode from the config source and flag", () => {
		const configDir = temp();
		const example = loadConfig(configDir);
		expect(example.source).toBe("example");
		expect(isSetupMode(example)).toBe(true);
		const defaults = setupDefaults(example);
		expect(defaults).toMatchObject({
			locale: "en",
			theme: "ocean",
			libraryName: "",
			schoolPreset: "it-primaria",
		});
		// the presets of config/school-presets/, named in the installation's language
		expect(defaults.presets.find((p) => p.id === "it-secondaria-I")).toMatchObject({
			name: "Lower secondary school (Italy)",
			country: "IT",
			groups: { "secondaria-I": ["A", "B", "C", "D", "E", "F"] },
		});
		// the codes of a new installation (12.8): the standard pair with the letter check
		expect(defaults.codes).toMatchObject({
			item: "standard",
			card: "standard",
			check: "mod23",
		});
		const raw = exampleRaw();
		(raw.ui as Record<string, unknown>).setupCompleted = false;
		const pending = {
			...parseConfig(raw, "x"),
			source: "file" as const,
			path: "x",
			files: ["x"],
			origins: new Map<string, string>(),
		};
		expect(isSetupMode(pending)).toBe(true);
		expect(setupDefaults(pending).libraryName).toBe("Biblioteca dell'Istituto");
		(raw.ui as Record<string, unknown>).setupCompleted = true;
		expect(
			isSetupMode({
				...parseConfig(raw, "x"),
				source: "file",
				path: "x",
				files: ["x"],
				origins: new Map(),
			}),
		).toBe(false);
	});

	it("writes a valid config.json from the example, keeping comments and hashing accounts", () => {
		const configDir = temp();
		const db = createTestDb();
		const { path } = writeSetupConfig(db, configDir, {
			locale: "en",
			theme: "sunset",
			libraryName: "Biblioteca Rodari",
			school: {
				preset: "it-secondaria-I",
				stages: [{ code: "secondaria-I", mode: "perLevel", names: ["A", "B"] }],
				teacherGroupName: "Professori",
				classLabel: "{level}{group}",
				readingLevels: false,
				callNumber: { order: "genre", end: "text" },
				schoolYearStart: "09-01",
				schoolYearLabel: "span",
			},
			codes: { item: "prefix", card: "prefix", check: "damm", layout: "fr" },
			// a school without patron photos (9.38): the switch lands in the configuration
			features: { photos: false, covers: true },
			passwordHashes: hashes,
		});
		expect(path).toBe(join(configDir, "config.json"));
		expect(existsSync(`${path}.tmp`)).toBe(false);
		const loaded = loadConfig(configDir);
		expect(loaded.source).toBe("file");
		expect(isSetupMode(loaded)).toBe(false);
		expect(loaded.config.ui).toMatchObject({
			locale: "en",
			theme: "sunset",
			setupCompleted: true,
		});
		expect(loaded.config.photos.enabled).toBe(false);
		expect(loaded.config.covers.enabled).toBe(true);
		expect(loaded.config.library).toMatchObject({
			name: "Biblioteca Rodari",
			// English: the week starts on Sunday (9.13, round 17)
			weekStart: "sunday",
		});
		// the school structure of the chosen preset (Phase 12)
		expect(loaded.config.school).toMatchObject({
			preset: "it-secondaria-I",
			teacherGroupName: "Professori",
			classLabel: "{level}{group}",
		});
		expect(loaded.config.school.levels.map((l) => l.code)).toEqual(["1", "2", "3"]);
		// the codes of the "Codici" step (12.8); the example's legacy shapes stay when compatible
		expect(loaded.config.barcodes.item.format).toEqual({
			pattern: "'L'-YYNNNNC",
			check: "damm",
		});
		expect(loaded.config.barcodes.patron.format).toEqual({
			pattern: "'T'NNNNNNC",
			check: "damm",
		});
		expect(loaded.config.barcodes.keyboardLayout).toBe("fr");
		expect(loaded.config.barcodes.item.legacy).toEqual([
			{ pattern: "YYYY-NNNN", check: "none" },
		]);
		// no reading levels: fiction is not shelved by level
		expect(loaded.config.classification.readingLevels).toEqual([]);
		expect(loaded.config.classification.fictionByClass).toBe(false);
		// the scheme of the segnatura chosen in the "Scuola" step (Q143)
		expect(loaded.config.classification.callNumber).toEqual(callNumberScheme("genre", "text"));
		expect(
			loaded.config.security.users.map((u) => [u.username, u.roles[0], u.passwordHash]),
		).toEqual([
			["admin", "admin", hashes.admin],
			["prestiti", "circulation", hashes.prestiti],
			["catalogo", "cataloging", hashes.catalogo],
			["tessere", "membership", hashes.tessere],
			["report", "reporting", hashes.report],
		]);
		expect(loaded.config.security.users.every((u) => u.password === undefined)).toBe(true);
		const raw = readJsonFile(path);
		expect(Object.keys(raw.ui as object)).toContain("_comment");
		expect(loaded.warnings.filter((w) => w.path.startsWith("security.users"))).toEqual([]);

		// a second run (setup not completed yet) starts from the written file, not the example
		const rawEdit = readJsonFile(path);
		(rawEdit.library as Record<string, unknown>).timezone = "Europe/Berlin";
		writeFileSync(path, JSON.stringify(rawEdit));
		writeSetupConfig(db, configDir, {
			locale: "it",
			theme: "ocean",
			libraryName: "X",
			school: {
				preset: "it-primaria",
				stages: [{ code: "primaria", mode: "perLevel", names: ["A"] }],
				teacherGroupName: "Docenti",
				classLabel: "{level} {group}",
				readingLevels: true,
				schoolYearStart: "09-01",
				schoolYearLabel: "span",
			},
			codes: { item: "standard", card: "standard", check: "mod23", layout: "it" },
			features: { photos: true, covers: true },
			passwordHashes: hashes,
		});
		expect(loadConfig(configDir).config.library.timezone).toBe("Europe/Berlin");
		expect(
			loadConfig(configDir).config.classification.readingLevels.map((l) => l.code),
		).toEqual(["1", "2", "3", "4", "5"]);
		// an unknown preset is refused and writes nothing
		expect(() =>
			writeSetupConfig(db, configDir, {
				locale: "it",
				theme: "ocean",
				libraryName: "X",
				school: {
					preset: "nowhere",
					stages: [],
					teacherGroupName: "Docenti",
					classLabel: "{level} {group}",
					readingLevels: true,
					schoolYearStart: "09-01",
					schoolYearLabel: "span",
				},
				codes: { item: "standard", card: "standard", check: "mod23", layout: "it" },
				features: { photos: true, covers: true },
				passwordHashes: hashes,
			}),
		).toThrow(/unknown school preset/);
		expect(loadConfig(configDir).config.library.weekStart).toBe("monday");
		// each run is one change of the history
		expect(listConfigChanges(configDir).map((c) => c.action)).toEqual([
			"config.setup",
			"config.setup",
		]);
	});

	const answers: SetupInput = {
		locale: "it",
		theme: "ocean",
		libraryName: "Biblioteca Rodari",
		school: {
			preset: "it-primaria",
			stages: [{ code: "primaria", mode: "perLevel", names: ["A"] }],
			teacherGroupName: "Docenti",
			classLabel: "{level} {group}",
			readingLevels: true,
			schoolYearStart: "09-01",
			schoolYearLabel: "span",
		},
		codes: { item: "standard", card: "standard", check: "mod23", layout: "it" },
		features: { photos: true, covers: true },
		passwordHashes: hashes,
	};

	it("writes each answer in the file that defines its key, and a refused one nowhere", () => {
		const configDir = temp();
		const db = createTestDb();
		writeFileSync(join(configDir, "ui.json"), JSON.stringify({ theme: "grape", locale: "en" }));
		writeSetupConfig(db, configDir, answers);
		// the fragment holds the language and the colour set: written there, not into config.json
		expect(readJsonFile(join(configDir, "ui.json"))).toEqual({ theme: "ocean", locale: "it" });
		expect(readJsonFile(join(configDir, "classification.json")).fictionByClass).toBe(true);
		// no answer: the library's own scheme, `B 4 DEL`
		expect(readJsonFile(join(configDir, "classification.json")).callNumber).toEqual(
			callNumberScheme("genreLevel", "author"),
		);
		expect(loadConfig(configDir).config.ui.theme).toBe("ocean");

		// the demo build writes the same files without a history
		const demoDir = temp();
		writeDemoSetupConfig(demoDir, answers);
		expect(loadConfig(demoDir).config.library.name).toBe("Biblioteca Rodari");
		expect(existsSync(join(demoDir, "history"))).toBe(false);
		const broken = temp();
		expect(() =>
			writeDemoSetupConfig(broken, {
				...answers,
				school: { ...answers.school, classLabel: "" },
			}),
		).toThrow();
		expect(existsSync(join(broken, "config.json"))).toBe(false);
	});

	it("completes the wizard: accounts, empty classes, teachers' group, audit", async () => {
		const configDir = temp();
		const dataDir = temp();
		const db = createTestDb();
		const passwords = Object.fromEntries(
			Object.keys(hashes).map((k) => [k, "una-password-lunga"]),
		) as Record<keyof typeof hashes, string>;
		const { passwordHashes: _h, ...rest } = answers;
		const result = await completeSetup(
			db,
			{ configDir, dataDir },
			{
				...rest,
				passwords,
				demo: false,
			},
		);
		expect(result).toEqual({ demo: null });
		expect(
			db
				.select({ username: staffUser.username })
				.from(staffUser)
				.all()
				.map((u) => u.username)
				.sort(),
		).toEqual(["admin", "catalogo", "prestiti", "report", "tessere"]);
		const groups = db.select({ kind: classGroup.kind }).from(classGroup).all();
		expect(groups.filter((g) => g.kind === "teachers")).toHaveLength(1);
		expect(groups.filter((g) => g.kind === "students").length).toBeGreaterThan(0);
		expect(db.select().from(patron).all()).toEqual([]);
		const audited = db.select().from(auditLog).all();
		expect(audited.find((a) => a.action === "setup.completed")?.details).toMatchObject({
			path: join(configDir, "config.json"),
			schoolPreset: "it-primaria",
			demo: false,
		});
		expect(isSetupMode(loadConfig(configDir))).toBe(false);
	});

	it("loads demo data once, records the marker and removes everything on request", async () => {
		const dataDir = temp();
		const db = createTestDb();
		expect(readDemoInfo(dataDir)).toBeNull();
		const settings = {
			photos: {
				enabled: true,
				width: 48,
				height: 64,
				quality: 60,
				maxUploadBytes: 1_000_000,
			},
			seed: { codes: TEST_CODES },
		};
		const info = await loadDemoData(db, dataDir, settings, new Date("2026-09-19T10:00:00Z"));
		expect(info.counts.patrons).toBe(300);
		expect(info.counts.biblios).toBeGreaterThan(0);
		expect(readDemoInfo(dataDir)).toEqual(info);
		// the demo photos are stored like any other photo
		const withPhoto = db.$client
			.query<{ p: string }, []>(
				"SELECT photo_path AS p FROM patron WHERE photo_path IS NOT NULL",
			)
			.all();
		expect(withPhoto.length).toBeGreaterThan(100);
		expect(existsSync(join(dataDir, withPhoto[0]?.p ?? "missing"))).toBe(true);
		// already seeded: the marker is refreshed without seeding again
		const again = await loadDemoData(db, dataDir, settings, new Date("2026-09-20T10:00:00Z"));
		expect(again.counts.patrons).toBe(300);
		expect(again.counts.biblios).toBe(0);

		const dbPath = join(dataDir, "db", "biblioviva.db");
		mkdirSync(join(dataDir, "db"));
		writeFileSync(dbPath, "x");
		writeFileSync(`${dbPath}-wal`, "x");
		mkdirSync(join(dataDir, "uploads", "patrons"), { recursive: true });
		const removed = removeDemoData(dataDir, dbPath);
		expect(removed).toEqual([
			dbPath,
			`${dbPath}-wal`,
			join(dataDir, "uploads"),
			join(dataDir, "demo-data.json"),
		]);
		expect(existsSync(dbPath)).toBe(false);
		expect(readDemoInfo(dataDir)).toBeNull();
		writeFileSync(join(dataDir, "demo-data.json"), "broken");
		expect(readDemoInfo(dataDir)).toBeNull();
	});
	it("keeps the classes and the teachers group when the demo data is removed (9.42)", async () => {
		const dataDir = temp();
		const demo = createTestDb();
		await loadDemoData(demo, dataDir, {
			photos: {
				enabled: false,
				width: 48,
				height: 64,
				quality: 60,
				maxUploadBytes: 1_000_000,
			},
			seed: { codes: TEST_CODES, patrons: 20, teachers: 2, biblios: 10, items: 12, loans: 5 },
		});
		const groups = demo.select().from(classGroup).all();
		const levels = demo.select().from(classGroupLevel).all();
		expect(groups.some((g) => g.kind === "teachers")).toBe(true);
		expect(groups.some((g) => g.kind === "students")).toBe(true);
		const snapshot = snapshotSchoolClasses(demo);

		// the database file is replaced by a fresh, empty one
		const fresh = createTestDb();
		expect(fresh.select().from(classGroup).all()).toEqual([]);
		restoreSchoolClasses(fresh, snapshot);
		expect(fresh.select().from(classGroup).all()).toEqual(groups);
		expect(fresh.select().from(classGroupLevel).all()).toEqual(levels);
		// nothing else survives: no patron, no book
		expect(fresh.select().from(patron).all()).toEqual([]);
		// a restore with nothing to restore changes nothing
		restoreSchoolClasses(createTestDb(), { groups: [], levels: [] });
	});
});
