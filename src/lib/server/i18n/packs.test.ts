// SPDX-License-Identifier: GPL-3.0-or-later
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NAMESPACES } from "#lib/i18n/index.js";
import { compareDictionary, describeProblem, discoverPacks, validatePack } from "./packs.js";
import {
	availableLocales,
	builtInDictionaries,
	installDefaultPacks,
	invalidatePacks,
	isAvailableLocale,
	isKnownLocale,
	knownLocales,
	loadPacks,
	packTranslations,
	setPackLogger,
} from "./registry.js";

const dirs: string[] = [];
function tempDir(): string {
	const d = mkdtempSync(join(tmpdir(), "bv-packs-"));
	dirs.push(d);
	return d;
}
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
	invalidatePacks();
	setPackLogger(console.warn);
});

describe("plural forms of a pack", () => {
	it("refuses a language that needs forms a string does not give, and warns of a missing selector", () => {
		const problems: Parameters<typeof compareDictionary>[3] = [];
		const reference = { n: "{{count}} {{count:plural; one:student; other:students;}}" };
		compareDictionary(
			"a.json",
			reference,
			{ n: "{{count}} {{count:plural; one:студент; other:студентов;}}" },
			problems,
			"",
			"ru",
		);
		expect(problems).toMatchObject([
			{
				severity: "error",
				kind: "plural_forms",
				detail: expect.stringContaining("few, many"),
			},
		]);
		const ok: typeof problems = [];
		compareDictionary(
			"a.json",
			reference,
			{
				n: "{{count}} {{count:plural; one:студент; few:студента; many:студентов; other:студента;}}",
			},
			ok,
			"",
			"ru",
		);
		expect(ok).toEqual([]);
		const none: typeof problems = [];
		compareDictionary("a.json", reference, { n: "{{count}} Schüler" }, none, "", "de");
		expect(none).toMatchObject([{ severity: "warning", kind: "plural_forms" }]);
	});
});

/** A complete pack cloned from the built-in Italian, with the code and names of German. */
function clonePack(configDir: string, code = "de", edit?: (dir: string) => void): string {
	const dir = join(configDir, "i18n", code);
	mkdirSync(dir, { recursive: true });
	cpSync("src/lib/i18n/it", dir, { recursive: true });
	writeFileSync(
		join(dir, "pack.json"),
		JSON.stringify({ name: "German", nativeName: "Deutsch", appVersion: "0.1.0" }),
	);
	edit?.(dir);
	return dir;
}

const rewrite = (dir: string, file: string, edit: (d: Record<string, unknown>) => void): void => {
	const path = join(dir, file);
	const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
	edit(data);
	writeFileSync(path, JSON.stringify(data));
};

describe("compareDictionary", () => {
	it("reports missing, extra, non-string and placeholder problems with their paths", () => {
		const problems: never[] = [];
		const list = problems as unknown as Parameters<typeof compareDictionary>[3];
		compareDictionary(
			"common.json",
			{ a: "Hi {{name}}", nested: { b: "x", c: "y" }, obj: { d: "z" } },
			{ a: "Ciao {{nome}}", nested: { b: 1, extra: "e" }, obj: "flat", more: "m" },
			list,
		);
		expect(list.map((p) => `${p.severity}:${p.kind}:${p.key ?? ""}`)).toEqual([
			"error:placeholders:a",
			"error:not_a_string:nested.b",
			"warning:missing_key:nested.c",
			"warning:extra_key:nested.extra",
			"error:not_a_string:obj",
			"warning:extra_key:more",
		]);
		expect(describeProblem("de", list[0] as never)).toContain(
			'pack "de": placeholders at common.json › a',
		);
	});
});

describe("validatePack / discoverPacks", () => {
	it("accepts a complete pack and reports gaps as warnings", async () => {
		const configDir = tempDir();
		clonePack(configDir, "de", (dir) => {
			rewrite(dir, "nav.json", (d) => {
				delete d.catalog;
			});
		});
		const english = await builtInDictionaries("en");
		const [pack] = discoverPacks(configDir, english);
		expect(pack).toMatchObject({ code: "de", valid: true, meta: { nativeName: "Deutsch" } });
		// the Italian has no selector where an invariant word makes it needless: a warning, apart
		expect(pack?.problems.filter((p) => p.kind !== "plural_forms")).toEqual([
			{ severity: "warning", file: "nav.json", key: "catalog", kind: "missing_key" },
		]);
		expect(Object.keys(pack?.dictionaries ?? {})).toEqual([...NAMESPACES]);
	});

	it("rejects packs with a missing file, bad JSON, a bad pack.json, a bad code or a placeholder mismatch", async () => {
		const configDir = tempDir();
		const english = await builtInDictionaries("en");
		clonePack(configDir, "fr", (dir) => {
			rmSync(join(dir, "about.json"));
		});
		clonePack(configDir, "es", (dir) => {
			writeFileSync(join(dir, "auth.json"), "{ not json");
		});
		clonePack(configDir, "pt", (dir) => {
			writeFileSync(join(dir, "pack.json"), JSON.stringify({ name: "" }));
		});
		clonePack(configDir, "nl", (dir) => {
			rmSync(join(dir, "pack.json"));
		});
		clonePack(configDir, "ro", (dir) => {
			rewrite(dir, "common.json", (d) => {
				(d.app as Record<string, unknown>).name = "{{wrong}}";
			});
		});
		clonePack(configDir, "not-a-code");
		clonePack(configDir, "it"); // built-in: an example folder, not a pack
		const packs = discoverPacks(configDir, english);
		const byCode = Object.fromEntries(packs.map((p) => [p.code, p]));
		const first = (problems: { kind: string }[] | undefined): { kind: string } | undefined =>
			problems?.find((p) => p.kind !== "plural_forms");
		expect(Object.keys(byCode).sort()).toEqual(["es", "fr", "nl", "not-a-code", "pt", "ro"]);
		expect(byCode.fr?.valid).toBe(false);
		expect(first(byCode.fr?.problems)).toMatchObject({
			kind: "missing_file",
			file: "about.json",
		});
		expect(first(byCode.es?.problems)).toMatchObject({ kind: "bad_json", file: "auth.json" });
		expect(first(byCode.pt?.problems)).toMatchObject({ kind: "bad_pack_file" });
		expect(first(byCode.nl?.problems)).toMatchObject({ kind: "missing_pack_file" });
		expect(byCode.ro?.valid).toBe(false);
		expect(first(byCode.ro?.problems)).toMatchObject({
			kind: "placeholders",
			key: "app.name",
			file: "common.json",
		});
		expect(first(byCode["not-a-code"]?.problems)).toMatchObject({ kind: "bad_code" });
		expect(validatePack("de", join(configDir, "nope"), english).valid).toBe(false);
		expect(discoverPacks(join(configDir, "missing"), english)).toEqual([]);
	});
});

describe("registry", () => {
	it("lists built-in languages first, then valid packs; logs problems once; serves the pack", async () => {
		const configDir = tempDir();
		clonePack(configDir, "de", (dir) => {
			rewrite(dir, "common.json", (d) => {
				(d.app as Record<string, unknown>).name = "BiblioViva (DE)";
			});
			rewrite(dir, "nav.json", (d) => {
				delete d.catalog;
			});
		});
		clonePack(configDir, "fr", (dir) => {
			rmSync(join(dir, "about.json"));
		});
		const log: string[] = [];
		setPackLogger((m) => log.push(m));
		const locales = await availableLocales(configDir);
		expect(locales).toEqual([
			{ code: "en", name: "English", builtIn: true },
			{ code: "it", name: "Italiano", builtIn: true },
			{ code: "de", name: "Deutsch", builtIn: false },
		]);
		expect(log.some((m) => m.includes('pack "de": missing key at nav.json › catalog'))).toBe(
			true,
		);
		expect(log.some((m) => m.includes('pack "fr" is not offered'))).toBe(true);
		const count = log.length;
		await loadPacks(configDir);
		expect(log).toHaveLength(count);
		expect(await isAvailableLocale("de", configDir)).toBe(true);
		expect(await isAvailableLocale("fr", configDir)).toBe(false);
		expect(await isAvailableLocale("en", configDir)).toBe(true);
		expect(await isAvailableLocale(42, configDir)).toBe(false);
		expect(isKnownLocale("de")).toBe(true);
		expect(isKnownLocale("fr")).toBe(false);
		expect(knownLocales()).toEqual(["en", "it", "de"]);
		const translations = packTranslations("de");
		expect(translations?.de?.common).toMatchObject({ app: { name: "BiblioViva (DE)" } });
		expect(packTranslations("fr")).toBeNull();
		invalidatePacks();
		expect(isKnownLocale("de")).toBe(false);
		expect(knownLocales()).toEqual(["en", "it"]);
	});

	it("installs the built-in languages as example packs without overwriting", async () => {
		const configDir = tempDir();
		const written = await installDefaultPacks(configDir);
		expect(written).toContain("it/pack.json");
		expect(written).toContain("it/common.json");
		expect(written).toContain("en/pack.json");
		const meta = JSON.parse(
			readFileSync(join(configDir, "i18n", "it", "pack.json"), "utf8"),
		) as {
			nativeName: string;
			appVersion: string;
		};
		expect(meta.nativeName).toBe("Italiano");
		expect(meta.appVersion).toMatch(/^\d+\.\d+\.\d+/);
		writeFileSync(join(configDir, "i18n", "it", "nav.json"), "{}");
		expect(await installDefaultPacks(configDir)).toEqual([]);
		expect(readFileSync(join(configDir, "i18n", "it", "nav.json"), "utf8")).toBe("{}");
		// the examples are not packs: nothing is offered beyond the built-in languages
		expect((await availableLocales(configDir)).map((l) => l.code)).toEqual(["en", "it"]);
	});
});
