// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import parser from "@sveltekit-i18n/parser-curly";
import { describe, expect, it } from "vitest";
import { neededPluralCategories, pluralExpressions, pluralProblems } from "./plural.js";

describe("plural expressions", () => {
	it("finds the selectors of a message and the keys of their options", () => {
		expect(
			pluralExpressions(
				"{{count}} {{count:plural; one:student; other:students;}} in {{name}}",
			),
		).toEqual([{ name: "count", options: ["one", "other"] }]);
		expect(
			pluralExpressions(
				"{{a:plural; one:{{a}} book; other:{{a}} books;}} and {{b:plural; =0:none; one:x; other:y;}}",
			),
		).toEqual([
			{ name: "a", options: ["one", "other"] },
			{ name: "b", options: ["=0", "one", "other"] },
		]);
		expect(pluralExpressions("{{count}} students")).toEqual([]);
	});

	it("knows the forms a language uses for the numbers of a school", () => {
		expect(neededPluralCategories("en")).toEqual(["one", "other"]);
		// `many` of Italian, French and Spanish starts at a million
		expect(neededPluralCategories("it")).toEqual(["one", "other"]);
		expect(neededPluralCategories("fr")).toEqual(["one", "other"]);
		expect(neededPluralCategories("ru")).toEqual(["one", "few", "many", "other"]);
		expect(neededPluralCategories("pl")).toEqual(["one", "few", "many", "other"]);
		expect(neededPluralCategories("sl")).toEqual(["one", "two", "few", "other"]);
		expect(neededPluralCategories("ro")).toEqual(["one", "few", "other"]);
		expect(neededPluralCategories("ja")).toEqual(["other"]);
	});

	it("reports the forms a message lacks for its language", () => {
		const two = "{{n}} {{n:plural; one:студент; other:студентов;}}";
		expect(pluralProblems(two, "ru")).toEqual([{ missing: ["few", "many"], unused: [] }]);
		// a `default` option covers what is missing
		expect(pluralProblems("{{n:plural; one:a; default:b;}}", "ru")).toEqual([]);
		expect(pluralProblems("{{n:plural; one:a; other:b;}}", "en")).toEqual([]);
		// a form the language never uses is only noise
		expect(pluralProblems("{{n:plural; one:a; few:c; other:b;}}", "en")).toEqual([
			{ missing: [], unused: ["few"] },
		]);
		expect(pluralProblems("{{n:plural; other:{{n}}人;}}", "ja")).toEqual([]);
	});
});

describe("the built-in dictionaries", () => {
	const dictionaries = (locale: string): [string, string][] =>
		readdirSync(join("src/lib/i18n", locale))
			.filter((f) => f.endsWith(".json"))
			.flatMap((f) => {
				const out: [string, string][] = [];
				const walk = (node: unknown, path: string): void => {
					if (typeof node === "string") {
						out.push([`${f} › ${path}`, node]);
					} else if (node && typeof node === "object") {
						for (const [k, v] of Object.entries(node)) {
							walk(v, path ? `${path}.${k}` : k);
						}
					}
				};
				walk(JSON.parse(readFileSync(join("src/lib/i18n", locale, f), "utf8")), "");
				return out;
			});

	for (const locale of ["en", "it"]) {
		it(`${locale}: every plural selector has the forms of its language and no old selector is left`, () => {
			for (const [where, text] of dictionaries(locale)) {
				expect(/\{\{\w+;\s*1:/.test(text), `${where} uses the old selector`).toBe(false);
				expect(pluralProblems(text, locale), where).toEqual([]);
				for (const expression of pluralExpressions(text)) {
					expect(expression.options, where).toContain("other");
				}
			}
		});
	}

	for (const locale of ["en", "it"]) {
		it(`${locale}: every message with a plural selector renders a full text for 0, 1, 2, 5 and 21`, () => {
			const { parse } = parser({ onReport: null });
			for (const [where, text] of dictionaries(locale)) {
				if (pluralExpressions(text).length === 0) {
					continue;
				}
				const names = [
					...new Set([...text.matchAll(/\{\{\s*([\w.]+)/g)].map((m) => m[1] ?? "")),
				];
				for (const n of [0, 1, 2, 5, 21]) {
					const payload = Object.fromEntries(names.map((name) => [name, n]));
					const out = parse(text, [payload, {}], locale, "k");
					expect(out, `${where} for ${n}`).not.toMatch(/\{\{|^\s*$/);
					expect(out, `${where} for ${n}`).not.toMatch(/ {2}|\s[,.:;]/);
				}
			}
		});
	}
});
