// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCache } from "#lib/server/config/index.js";
import { ConfigError, loadConfig } from "#lib/server/config/load.js";
import { resetEnvCache } from "#lib/server/env.js";
import {
	applyConfigChange,
	checkDraftFiles,
	ConfigChangeNotFoundError,
	ConfigPathError,
	ConfigRevertConflictError,
	draftWrites,
	HISTORY_KEEP,
	keyDrafts,
	listConfigChanges,
	sectionFile,
	setClassPerItem,
	sectionWrite,
	setConfigKeys,
} from "./config-edit.js";
import { revertConfigChange, setUiTheme } from "../../../../tests/helpers/config.js";

/** A whole section replaced in the file it comes from, as the JSON editor of a section does. */
const writeSection = (
	configDir: string,
	section: string,
	value: Record<string, unknown>,
): ReturnType<typeof applyConfigChange> =>
	applyConfigChange(configDir, `config.${section}`, [sectionWrite(configDir, section, value)]);

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-config-edit-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

describe("editConfig", () => {
	it("creates config.json from the example, writes atomically and reloads", () => {
		const loaded = setUiTheme(dir, "sunset");
		expect(loaded.config.ui.theme).toBe("sunset");
		expect(loaded.source).toBe("file");
		const raw = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
		expect(raw.ui.theme).toBe("sunset");
		expect(Object.keys(raw.school)).toContain("_comment");
		expect(existsSync(join(dir, "config.json.tmp"))).toBe(false);
		// a second edit starts from the written file
		expect(setUiTheme(dir, "grape").config.ui.theme).toBe("grape");
		expect(JSON.parse(readFileSync(join(dir, "config.json"), "utf8")).ui.theme).toBe("grape");
	});

	it("sets keys in a fresh folder: config.json from the example", () => {
		expect(setConfigKeys(dir, "config.locale", { "ui.locale": "it" }).config.ui.locale).toBe(
			"it",
		);
		expect(JSON.parse(readFileSync(join(dir, "config.json"), "utf8")).ui.locale).toBe("it");
	});

	it("refuses an invalid result without touching the file", () => {
		setUiTheme(dir, "ocean");
		expect(() => setUiTheme(dir, "neon")).toThrow(ConfigError);
		expect(JSON.parse(readFileSync(join(dir, "config.json"), "utf8")).ui.theme).toBe("ocean");
		expect(() => setConfigKeys(dir, "x", { "library.name": "" })).toThrow(ConfigError);
	});
});

describe("setClassPerItem", () => {
	it("writes the flag in classification.json when the fragment exists (fragments win)", () => {
		setUiTheme(dir, "ocean"); // config.json + the shipped fragments, classification.json included
		expect(existsSync(join(dir, "classification.json"))).toBe(true);
		const loaded = setClassPerItem(dir, true);
		expect(loaded.config.classification.classPerItem).toBe(true);
		const fragment = JSON.parse(readFileSync(join(dir, "classification.json"), "utf8"));
		expect(fragment.classPerItem).toBe(true);
		expect(fragment._comment).toBeDefined();
		expect(existsSync(join(dir, "classification.json.tmp"))).toBe(false);
	});

	it("restores the fragment when the folder would become invalid", () => {
		setUiTheme(dir, "ocean");
		const path = join(dir, "classification.json");
		const broken = JSON.parse(readFileSync(path, "utf8"));
		broken.genres = [];
		writeFileSync(path, JSON.stringify(broken));
		const before = readFileSync(path, "utf8");
		expect(() => setClassPerItem(dir, true)).toThrow(ConfigError);
		expect(readFileSync(path, "utf8")).toBe(before);
	});
});

describe("history of changes", () => {
	it("keeps the previous version of every touched file and reverts a change", () => {
		setUiTheme(dir, "ocean");
		setUiTheme(dir, "grape");
		const changes = listConfigChanges(dir);
		expect(changes.map((c) => c.action)).toEqual(["config.theme", "config.theme"]);
		// the first write created config.json, the second one replaced it
		expect(changes[1]?.files).toEqual([{ path: "config.json", existed: false }]);
		expect(changes[0]?.files).toEqual([{ path: "config.json", existed: true }]);
		const reverted = revertConfigChange(dir, changes[0]?.id ?? "");
		expect(reverted.loaded.config.ui.theme).toBe("ocean");
		expect(reverted.change.action).toBe(`revert ${changes[0]?.id}`);
		// reverting the creation removes the file again: the shipped example is back
		revertConfigChange(dir, changes[1]?.id ?? "");
		expect(existsSync(join(dir, "config.json"))).toBe(false);
		expect(() => revertConfigChange(dir, "nope")).toThrow(ConfigChangeNotFoundError);
	});

	it("writes several files as one change, binary ones too, and rolls back an invalid result", () => {
		setUiTheme(dir, "ocean");
		const png = new Uint8Array([137, 80, 78, 71]);
		const { change } = applyConfigChange(dir, "test", [
			{ path: "classification/images/Z.png", content: png },
			{ path: "notes/readme.txt", content: "ciao" },
		]);
		expect(change.files.map((f) => f.path)).toEqual([
			"classification/images/Z.png",
			"notes/readme.txt",
		]);
		expect(readFileSync(join(dir, "classification/images/Z.png"))).toEqual(Buffer.from(png));
		const before = readFileSync(join(dir, "classification.json"), "utf8");
		expect(() =>
			applyConfigChange(dir, "broken", [
				{ path: "classification.json", content: '{"genres": []}' },
				{ path: "notes/new.txt", content: "x" },
			]),
		).toThrow(ConfigError);
		expect(readFileSync(join(dir, "classification.json"), "utf8")).toBe(before);
		expect(existsSync(join(dir, "notes/new.txt"))).toBe(false);
		expect(listConfigChanges(dir).map((c) => c.action)).toEqual(["test", "config.theme"]);
	});

	it("never writes outside the folder or into the history", () => {
		for (const path of ["../x.json", "/etc/x", "a/../../x", "history/x.json", "history"]) {
			expect(() => applyConfigChange(dir, "evil", [{ path, content: "{}" }])).toThrow(
				ConfigPathError,
			);
		}
	});

	it("keeps only the last changes", () => {
		setUiTheme(dir, "ocean");
		for (let i = 0; i < HISTORY_KEEP + 3; i++) {
			applyConfigChange(
				dir,
				`note ${i}`,
				[{ path: "notes/n.txt", content: String(i) }],
				new Date(Date.UTC(2027, 0, 1, 0, 0, i)),
			);
		}
		const changes = listConfigChanges(dir);
		expect(changes).toHaveLength(HISTORY_KEEP);
		expect(changes[0]?.action).toBe(`note ${HISTORY_KEEP + 2}`);
	});
});

describe("sections", () => {
	it("are written to their fragment when it exists, else into config.json, keeping comments", () => {
		setUiTheme(dir, "ocean");
		expect(sectionFile(dir, "classification")).toBe("classification.json");
		expect(sectionFile(dir, "ui")).toBe("config.json");
		const fragment = JSON.parse(
			readFileSync(join(dir, "classification.json"), "utf8"),
		) as Record<string, unknown>;
		const loaded = writeSection(dir, "classification", {
			...fragment,
			fictionByClass: false,
		}).loaded;
		expect(loaded.config.classification.fictionByClass).toBe(false);
		const written = JSON.parse(
			readFileSync(join(dir, "classification.json"), "utf8"),
		) as Record<string, unknown>;
		expect(written._comment).toBeDefined();
		const ui = JSON.parse(readFileSync(join(dir, "config.json"), "utf8")).ui as Record<
			string,
			unknown
		>;
		expect(writeSection(dir, "ui", { ...ui, theme: "grape" }).loaded.config.ui.theme).toBe(
			"grape",
		);
		expect(listConfigChanges(dir)[0]).toMatchObject({
			action: "config.ui",
			files: [{ path: "config.json" }],
		});
	});
});

describe("drafts", () => {
	it("validates the folder with some files replaced, fragments and stocks included", () => {
		setUiTheme(dir, "ocean");
		expect(checkDraftFiles(dir, {}).config?.ui.theme).toBe("ocean");
		const bad = checkDraftFiles(dir, {
			"classification.json": { genres: [], nonfiction: [] },
		});
		expect(bad.config).toBeNull();
		expect(bad.issues.some((i) => i.path.startsWith("classification.genres"))).toBe(true);
		const base = JSON.parse(readFileSync(join(dir, "config.json"), "utf8")) as Record<
			string,
			unknown
		>;
		const themed = checkDraftFiles(dir, { "config.json": { ...base, ui: { theme: "grape" } } });
		expect(themed.config?.ui.theme).toBe("grape");
		// the stocks still come from labels/stocks
		expect(themed.config?.labels.stocks.length).toBeGreaterThan(0);
	});

	it("sets and removes keys in the file that defines them, never in folder pieces", () => {
		setUiTheme(dir, "ocean");
		const loaded = loadConfig(dir);
		const drafts = keyDrafts(dir, loaded, {
			"privacy.auditRetentionMonths": 30,
			"classification.fictionByClass": false,
			"cards.sheet.gapMm": undefined,
			"backup.newGroup.value": 1,
		});
		expect(Object.keys(drafts).sort()).toEqual(["classification.json", "config.json"]);
		expect(drafts["config.json"]?.privacy).toMatchObject({ auditRetentionMonths: 30 });
		expect(
			(drafts["config.json"]?.cards as { sheet: Record<string, unknown> }).sheet,
		).not.toHaveProperty("gapMm");
		expect((drafts["config.json"]?.backup as Record<string, unknown>).newGroup).toEqual({
			value: 1,
		});
		expect(drafts["classification.json"]?.fictionByClass).toBe(false);
		expect(
			draftWrites(drafts)
				.map((w) => w.path)
				.sort(),
		).toEqual(["classification.json", "config.json"]);
		writeFileSync(
			join(dir, "calendar.2027.json"),
			JSON.stringify({ holidays: ["2027-01-02"] }),
		);
		expect(() => keyDrafts(dir, loadConfig(dir), { "calendar.holidays": [] })).toThrow(
			ConfigPathError,
		);
		expect(() => keyDrafts(dir, loaded, { nope: 1 })).toThrow(ConfigPathError);
		expect(() => keyDrafts(dir, loaded, { privacy: {} })).toThrow(ConfigPathError);
	});

	it("puts the files back when the commit step refuses the change", () => {
		setUiTheme(dir, "ocean");
		const before = readFileSync(join(dir, "config.json"), "utf8");
		const changes = listConfigChanges(dir).length;
		expect(() =>
			applyConfigChange(
				dir,
				"guarded",
				[{ path: "notes/x.txt", content: "x" }],
				new Date(),
				() => {
					throw new Error("refused");
				},
			),
		).toThrow("refused");
		expect(existsSync(join(dir, "notes/x.txt"))).toBe(false);
		expect(readFileSync(join(dir, "config.json"), "utf8")).toBe(before);
		expect(listConfigChanges(dir)).toHaveLength(changes);
	});
});

describe("reverting one change", () => {
	it("undoes only the keys the change set, and refuses what was changed again since", () => {
		setUiTheme(dir, "ocean");
		setUiTheme(dir, "grape");
		const themeChange = listConfigChanges(dir)[0]?.id ?? "";
		setConfigKeys(dir, "config.locale", { "ui.locale": "en" });
		revertConfigChange(dir, themeChange);
		const loaded = loadConfig(dir).config;
		// the theme goes back, the language changed later stays
		expect(loaded.ui).toMatchObject({ theme: "ocean", locale: "en" });

		setUiTheme(dir, "sunset");
		const first = listConfigChanges(dir)[0]?.id ?? "";
		setUiTheme(dir, "cherry");
		try {
			revertConfigChange(dir, first);
			expect.unreachable();
		} catch (e) {
			expect(e).toBeInstanceOf(ConfigRevertConflictError);
			expect((e as ConfigRevertConflictError).conflicts).toEqual(["ui.theme"]);
		}
		expect(loadConfig(dir).config.ui.theme).toBe("cherry");
	});

	it("puts other files back only while they are as the change left them", () => {
		setUiTheme(dir, "ocean");
		const { change: created } = applyConfigChange(dir, "add", [
			{ path: "notes/a.txt", content: "one" },
		]);
		const { change: removed } = applyConfigChange(dir, "remove", [
			{ path: "notes/a.txt", content: null },
		]);
		expect(removed.files).toEqual([{ path: "notes/a.txt", existed: true, removed: true }]);
		revertConfigChange(dir, removed.id);
		expect(readFileSync(join(dir, "notes/a.txt"), "utf8")).toBe("one");
		writeFileSync(join(dir, "notes/a.txt"), "edited by hand");
		expect(() => revertConfigChange(dir, created.id)).toThrow(ConfigRevertConflictError);
		writeFileSync(join(dir, "notes/a.txt"), "one");
		revertConfigChange(dir, created.id);
		expect(existsSync(join(dir, "notes/a.txt"))).toBe(false);
		// a fragment names its conflicts by key
		const fragment = JSON.parse(
			readFileSync(join(dir, "classification.json"), "utf8"),
		) as Record<string, unknown>;
		const { change: flag } = writeSection(dir, "classification", {
			...fragment,
			fictionByClass: false,
		});
		writeSection(dir, "classification", { ...fragment, fictionByClass: true });
		expect(() => revertConfigChange(dir, flag.id)).toThrow(/classification\.fictionByClass/);
	});
});
