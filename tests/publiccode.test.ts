// SPDX-License-Identifier: GPL-3.0-or-later
// `publiccode.yml` (step 9.55, ADR-056): the description of BiblioViva for the Developers Italia catalogue keeps
// to the standard (https://yml.publiccode.tools, version 0): the mandatory keys, the lengths of the descriptions, the
// allowed values, and the files and addresses it names.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Doc = Record<string, unknown>;

const doc = Bun.YAML.parse(readFileSync("publiccode.yml", "utf8")) as Doc;
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { license: string };

function at(path: string): unknown {
	return path.split(".").reduce<unknown>((node, key) => (node as Doc | undefined)?.[key], doc);
}

const PLATFORMS = ["web", "windows", "mac", "linux", "ios", "android"];
const STATUSES = ["concept", "development", "beta", "stable", "obsolete"];
const TYPES = [
	"standalone/mobile",
	"standalone/iot",
	"standalone/desktop",
	"standalone/web",
	"standalone/backend",
	"standalone/other",
	"addon",
	"library",
	"configurationFiles",
];
const MAINTENANCE = ["internal", "contract", "community", "none"];

describe("publiccode.yml", () => {
	it("has the mandatory keys of the standard", () => {
		expect(at("publiccodeYmlVersion")).toBe("0");
		expect(at("name")).toBe("BiblioViva");
		expect(at("url")).toBe("https://github.com/itotm/biblioviva");
		expect(at("platforms")).toEqual(expect.arrayContaining(["web"]));
		for (const p of at("platforms") as string[]) {
			expect(PLATFORMS).toContain(p);
		}
		expect(STATUSES).toContain(at("developmentStatus"));
		expect(TYPES).toContain(at("softwareType"));
		expect(at("legal.license")).toBe(pkg.license);
		expect(MAINTENANCE).toContain(at("maintenance.type"));
		expect(at("localisation.localisationReady")).toBe(true);
	});

	it("names a maintainer to contact, as community maintenance requires", () => {
		const contacts = at("maintenance.contacts") as { name?: string }[];
		expect(contacts.length).toBeGreaterThan(0);
		for (const c of contacts) {
			expect(c.name?.trim()).toBeTruthy();
		}
	});

	it("describes BiblioViva in the languages of the interface, within the standard's lengths", () => {
		const languages = at("localisation.availableLanguages") as string[];
		expect(languages).toEqual(["it", "en"]);
		for (const lang of languages) {
			const d = at(`description.${lang}`) as Doc;
			const short = String(d.shortDescription);
			const long = String(d.longDescription);
			expect(short.length, `${lang} shortDescription`).toBeLessThanOrEqual(150);
			expect(short).not.toContain("\n");
			expect(long.length, `${lang} longDescription`).toBeGreaterThanOrEqual(150);
			expect(long.length, `${lang} longDescription`).toBeLessThanOrEqual(10_000);
			const features = d.features as string[];
			expect(features.length).toBeGreaterThanOrEqual(5);
			expect(features.length).toBeLessThanOrEqual(20);
			expect(String(d.documentation)).toMatch(/^https:\/\//);
		}
		// the same number of features in both languages: one is the mirror of the other
		expect((at("description.en.features") as string[]).length).toBe(
			(at("description.it.features") as string[]).length,
		);
	});

	it("uses the standard's lists and names files that exist", () => {
		expect(at("categories")).toEqual(["integrated-library-system"]);
		expect(at("intendedAudience.scope")).toEqual(["education"]);
		expect(at("intendedAudience.countries")).toEqual(["it"]);
		expect(existsSync(String(at("logo")))).toBe(true);
	});

	it("never calls BiblioViva «il programma» (the documentation's tone, writing guide)", () => {
		const text = readFileSync("publiccode.yml", "utf8");
		expect(text).not.toMatch(/è il programma|is the program/i);
	});
});
