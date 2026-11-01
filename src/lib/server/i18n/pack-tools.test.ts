// SPDX-License-Identifier: GPL-3.0-or-later
import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { builtInDictionaries } from "./registry.js";
import {
	buildPackZip,
	changedKeys,
	checkChunk,
	foreignScripts,
	completeness,
	flatten,
	mergeChunks,
	sha256,
	splitChunks,
	unflatten,
} from "./pack-tools.js";

describe("pack tools", async () => {
	const english = await builtInDictionaries("en");
	const italian = await builtInDictionaries("it");

	it("flattens and unflattens a dictionary without losing a message", () => {
		const flat = flatten(english.setup);
		expect(Object.keys(flat).length).toBeGreaterThan(100);
		expect(flatten(unflatten(flat))).toEqual(flat);
		expect(unflatten({ "a.b": "x", "a.c": "y", d: "z" })).toEqual({
			a: { b: "x", c: "y" },
			d: "z",
		});
	});

	it("cuts every namespace into chunks that together hold every message once", () => {
		const chunks = splitChunks(english, italian, 150);
		const seen = new Map<string, number>();
		for (const chunk of chunks) {
			expect(Object.keys(chunk.entries).length).toBeLessThanOrEqual(150);
			for (const key of Object.keys(chunk.entries)) {
				const id = `${chunk.namespace}:${key}`;
				seen.set(id, (seen.get(id) ?? 0) + 1);
			}
		}
		const total = Object.values(english).reduce(
			(n, d) => n + Object.keys(flatten(d)).length,
			0,
		);
		expect(seen.size).toBe(total);
		expect([...seen.values()].every((n) => n === 1)).toBe(true);
		expect(chunks.find((c) => c.id === "config-1")).toBeDefined();
	});

	it("checks a translated chunk: keys, placeholders, plural forms, text left in English", () => {
		const chunk = {
			id: "x-1",
			namespace: "common" as const,
			entries: {
				a: { en: "Hello {{name}}", it: "Ciao {{name}}" },
				b: {
					en: "{{count}} {{count:plural; one:book; other:books;}}",
					it: "{{count}} libri",
				},
				c: { en: "Save the whole configuration", it: "Salva tutto" },
				d: { en: "Cancel", it: "Annulla" },
			},
		};
		const good = checkChunk(
			chunk,
			{
				a: "Hallo {{name}}",
				b: "{{count}} {{count:plural; one:книга; few:книги; many:книг; other:книги;}}",
				c: "Die ganze Konfiguration speichern",
				d: "Abbrechen",
			},
			"ru",
		);
		expect(good.problems).toEqual([]);
		const bad = checkChunk(
			chunk,
			{
				a: "Hallo",
				b: "{{count}} {{count:plural; one:книга; other:книг;}}",
				c: "Save the whole configuration",
				e: "x",
			},
			"ru",
		);
		expect(bad.problems.map((p) => `${p.kind}:${p.key}`).sort()).toEqual([
			"extra_key:e",
			"missing_key:d",
			"placeholders:a",
			"plural_forms:b",
		]);
		expect(bad.notes).toEqual(["c: left in English"]);
		expect(checkChunk(chunk, null, "ru").problems).toMatchObject([{ kind: "bad_json" }]);
		expect(
			checkChunk(chunk, { a: "", b: "", c: "", d: "" }, "ru").problems.length,
		).toBeGreaterThan(0);
	});

	it("finds letters of another script inside a text", () => {
		expect(foreignScripts("sv", "Spara")).toEqual([]);
		expect(foreignScripts("sv", "Spaра")).toEqual(["cyrillic"]);
		expect(foreignScripts("ru", "Сохранить BiblioViva")).toEqual([]);
		expect(foreignScripts("ru", "Сохранить 保存")).toEqual(["han"]);
		expect(foreignScripts("ja", "保存する・カタカナ")).toEqual([]);
		expect(foreignScripts("ko", "저장 保存")).toEqual([]);
		expect(foreignScripts("el", "Αποθήκευση")).toEqual([]);
		expect(foreignScripts("pt-BR", "Gravar")).toEqual([]);
	});

	it("puts delivered chunks back together and measures what is translated", () => {
		const chunks = splitChunks(english, italian, 150);
		const first = chunks[0];
		expect(first).toBeDefined();
		if (!first) {
			return;
		}
		const delivered = {
			[first.id]: Object.fromEntries(
				Object.entries(first.entries).map(([k, e]) => [k, `«${e.en}»`]),
			),
		};
		const merged = mergeChunks(english, delivered);
		const { total, translated } = completeness(english, merged);
		expect(translated).toBe(Object.keys(first.entries).length);
		expect(total).toBeGreaterThan(translated);
		expect(completeness(english, english)).toEqual({ total, translated: total });
		expect(completeness(english, {})).toEqual({ total, translated: 0 });
	});

	it("lists the messages that changed between two versions of the English", () => {
		const before = { ...english, common: { a: "one", b: "two", c: "three" } };
		const after = { ...english, common: { a: "one", b: "TWO", d: "four" } };
		const diff = changedKeys(before, after);
		expect(diff.added).toContain("common:d");
		expect(diff.changed).toContain("common:b");
		expect(diff.removed).toContain("common:c");
	});

	it("builds the zip the upload of the admin reads, and its checksum", async () => {
		const zip = buildPackZip("de", { "pack.json": '{"name":"German"}', "nav.json": "{}" });
		const files = unzipSync(zip);
		expect(Object.keys(files).sort()).toEqual(["de/nav.json", "de/pack.json"]);
		expect(strFromU8(files["de/pack.json"] ?? new Uint8Array())).toBe('{"name":"German"}');
		expect(await sha256(new Uint8Array([97, 98, 99]))).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});
});
