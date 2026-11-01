// SPDX-License-Identifier: GPL-3.0-or-later
// The Italian and English dictionaries must have identical key sets (PLAN.md Q50: hard error).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverLocales, localesModule, LOCALES_FILE } from "./discover.js";
import { LOCALES, NAMESPACES } from "./index.js";

const root = new URL(".", import.meta.url).pathname;

function flatten(value: unknown, prefix = ""): string[] {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
			flatten(v, prefix ? `${prefix}.${k}` : k),
		);
	}
	return [prefix];
}

function keysOf(locale: string, namespace: string): string[] {
	const json = JSON.parse(readFileSync(join(root, locale, `${namespace}.json`), "utf8"));
	return flatten(json).sort();
}

describe("i18n dictionaries", () => {
	it("generated locale list matches the dictionary folders, English first", () => {
		const found = discoverLocales();
		expect([...LOCALES]).toEqual(found);
		expect(found[0]).toBe("en");
		// the committed file must be what the generator produces (run `bun run i18n:locales`)
		expect(readFileSync(LOCALES_FILE, "utf8")).toBe(localesModule(found));
	});

	it("list every namespace file for every locale", () => {
		for (const locale of LOCALES) {
			const files = readdirSync(join(root, locale))
				.filter((f) => f.endsWith(".json"))
				.map((f) => f.replace(/\.json$/, ""))
				.sort();
			expect(files, `namespaces of ${locale}`).toEqual([...NAMESPACES].sort());
		}
	});

	it.each(NAMESPACES)("have identical key sets in it/ and en/ for %s", (namespace) => {
		const reference = keysOf("it", namespace);
		for (const locale of LOCALES) {
			expect(keysOf(locale, namespace), `${namespace}: ${locale} vs it`).toEqual(reference);
		}
	});

	it("never contain empty strings", () => {
		for (const locale of LOCALES) {
			for (const namespace of NAMESPACES) {
				const json = JSON.parse(
					readFileSync(join(root, locale, `${namespace}.json`), "utf8"),
				);
				const empty = flatten(json).filter((key) => {
					const value = key
						.split(".")
						.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], json);
					return typeof value !== "string" || value.trim() === "";
				});
				expect(empty, `${locale}/${namespace}`).toEqual([]);
			}
		}
	});
});
