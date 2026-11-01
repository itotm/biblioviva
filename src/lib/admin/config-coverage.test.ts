// SPDX-License-Identifier: GPL-3.0-or-later
// The completeness rule of Phase 11: every key of the configuration schema and every kind of file
// of the configuration folder has an editor; nothing is left pending (since step 11.9 every
// editor exists, and a new key or file kind without one fails here).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
	BUILTIN_ONLY_FOLDERS,
	CONFIG_FILE_KINDS,
	CONFIG_FILES,
	DEFAULT_ENTRIES,
	fileKindOf,
	travels,
} from "#lib/server/config/folder.js";
import { schemaLeaves, schemaSections } from "#lib/server/config/introspect.js";
import {
	coverageOf,
	editorHref,
	FILE_COVERAGE,
	KEY_COVERAGE,
	SECTION_BLOCKS,
} from "./config-coverage.js";

const leaves = schemaLeaves();

function dictionary(locale: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join("src/lib/i18n", locale, "config.json"), "utf8")) as Record<
		string,
		unknown
	>;
}
const lookup = (tree: unknown, path: string): unknown =>
	path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], tree);

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(path) : [path];
	});
}

describe("configuration coverage map", () => {
	it("covers every key the settings forms cannot edit", () => {
		const uncovered = leaves.filter((l) => l.field === null && coverageOf(l.path) === null);
		expect(uncovered.map((l) => l.path)).toEqual([]);
	});

	it("lists no key that is not in the schema", () => {
		for (const key of Object.keys(KEY_COVERAGE)) {
			expect(
				leaves.some((l) => coverageOf(l.path)?.key === key),
				`${key} matches no key of the schema`,
			).toBe(true);
		}
	});

	it("leaves nothing pending: every key and file kind has its editor", () => {
		const pending = [...Object.entries(KEY_COVERAGE), ...Object.entries(FILE_COVERAGE)]
			.filter(([, c]) => "pending" in c)
			.map(([key]) => key);
		expect(pending).toEqual([]);
	});

	it("covers every kind of configuration file, and the shipped folder has no other", () => {
		expect(Object.keys(FILE_COVERAGE).sort()).toEqual([...CONFIG_FILE_KINDS].sort());
		const unknown = files("config")
			.map((f) => relative("config", f).split("\\").join("/"))
			.filter((f) => fileKindOf(f) === null)
			.filter((f) => !BUILTIN_ONLY_FOLDERS.some((folder) => f.startsWith(folder)));
		expect(unknown).toEqual([]);
		expect(fileKindOf("calendar.2026.json")).toBe("calendar.<year>.json");
		expect(fileKindOf("circulation.json")).toBe("<section>.json");
		expect(fileKindOf("notes.json")).toBeNull();
		expect(fileKindOf("history/20260925-101500-000/change.json")).toBe("history/");
		expect(fileKindOf("i18n/fr/common.json")).toBe("i18n/<code>/");
		expect(fileKindOf("branding/logo.png")).toBe("branding/logo.png");
		// a stray file beside a known one belongs to nothing: never exported, never refused on import
		expect(fileKindOf("branding/logo.png.tmp")).toBeNull();
		expect(fileKindOf("classification/images/old/x.png")).toBeNull();
		expect(travels("config.example.json")).toBe(false);
		expect(travels("history/1/change.json")).toBe(false);
		expect(travels("reports/loans.json")).toBe(true);
	});

	it("gives every kind of file but the history a part of the archive, and ships the defaults", () => {
		expect(CONFIG_FILES.filter((f) => f.part === null).map((f) => f.kind)).toEqual([
			"history/",
		]);
		for (const entry of DEFAULT_ENTRIES) {
			const shipped = statSync(join("config", entry)).isDirectory()
				? files(join("config", entry)).map((f) =>
						relative("config", f).split("\\").join("/"),
					)
				: [entry];
			expect(shipped.length, entry).toBeGreaterThan(0);
			expect(shipped.filter((f) => fileKindOf(f) === null)).toEqual([]);
		}
	});

	it("draws on each section page the block of every editor the map lists for it", () => {
		const page = readFileSync("src/routes/(app)/admin/config/[section]/+page.svelte", "utf8");
		for (const editor of new Set(Object.values(SECTION_BLOCKS).flat())) {
			expect(page, editor).toContain(`blocks.includes("${editor}")`);
		}
	});

	it("gives every settings key a label and an explanation in both languages", () => {
		for (const locale of ["en", "it"]) {
			const dict = dictionary(locale);
			for (const leaf of leaves) {
				if (!leaf.field || coverageOf(leaf.path) !== null) {
					continue;
				}
				expect(lookup(dict, `fields.${leaf.path}.label`), `${locale} ${leaf.path}`).toEqual(
					expect.any(String),
				);
				expect(lookup(dict, `fields.${leaf.path}.hint`), `${locale} ${leaf.path}`).toEqual(
					expect.any(String),
				);
				for (const option of leaf.field.options ?? []) {
					expect(
						lookup(dict, `options.${leaf.path}.${option}`),
						`${locale} ${leaf.path} = ${option}`,
					).toEqual(expect.any(String));
				}
				const group = leaf.path.split(".").slice(0, -1).join(".");
				if (group.includes(".")) {
					expect(lookup(dict, `groups.${group}.title`), `${locale} ${group}`).toEqual(
						expect.any(String),
					);
				}
			}
			for (const section of schemaSections()) {
				expect(lookup(dict, `sections.${section}.title`), section).toEqual(
					expect.any(String),
				);
			}
		}
	});

	it("knows where each editor lives", () => {
		expect(editorHref("settings", "circulation")).toBe("/admin/config/circulation");
		expect(editorHref("taxonomy", "classification")).toBe("/admin/config/classification");
		expect(editorHref("appearance", "ui")).toBe("/admin/appearance");
		expect(editorHref("history", "ui")).toBe("/admin/config/history");
		expect(editorHref("wizard", "ui")).toBeNull();
		expect(coverageOf("library.itemTypes[].code")?.key).toBe("library.itemTypes");
		expect(coverageOf("classification.nonfiction[].children[].code")?.coverage).toEqual({
			editor: "taxonomy",
		});
		expect(coverageOf("library.name")).toBeNull();
	});
});
