// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { assembleConfig, deepMerge, originOf, SECTION_NAMES } from "./folder.js";
import { ConfigError, exampleRaw, loadConfig, readJsonFile } from "./load.js";

const dirs: string[] = [];
function temp(): string {
	const d = mkdtempSync(join(tmpdir(), "bv-folder-"));
	dirs.push(d);
	return d;
}
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

/** A CONFIG_DIR with the full example as config.json (no fragments). */
function fullDir(): string {
	const dir = temp();
	writeFileSync(join(dir, "config.json"), JSON.stringify(exampleRaw()));
	return dir;
}

describe("configuration folder", () => {
	it("deep-merges objects and replaces arrays", () => {
		expect(deepMerge({ a: { b: 1, c: [1, 2] }, d: 1 }, { a: { c: [3] }, e: 2 })).toEqual({
			a: { b: 1, c: [3] },
			d: 1,
			e: 2,
		});
		expect(deepMerge(1, { a: 1 })).toEqual({ a: 1 });
	});

	it("a <section>.json fragment overrides the same section of config.json, with a warning", () => {
		const dir = fullDir();
		writeFileSync(
			join(dir, "circulation.json"),
			JSON.stringify({ rules: { student: { loanDays: 30 } } }),
		);
		const loaded = loadConfig(dir);
		expect(loaded.config.circulation.rules.student?.loanDays).toBe(30);
		expect(loaded.config.circulation.rules.student?.maxLoans).toBe(1); // untouched key of the base
		expect(loaded.files).toEqual([join(dir, "config.json"), join(dir, "circulation.json")]);
		expect(originOf(loaded.origins, "circulation.rules.student.loanDays")).toBe(
			join(dir, "circulation.json"),
		);
		expect(originOf(loaded.origins, "circulation.rules.student.maxLoans")).toBe(
			join(dir, "config.json"),
		);
		expect(originOf(loaded.origins, "library.name")).toBe(join(dir, "config.json"));
		expect(
			loaded.warnings.some((w) => w.path === "circulation" && w.message.includes("win")),
		).toBe(true);
	});

	it("appends label stocks from labels/stocks and replaces a same-named one", () => {
		const dir = fullDir();
		mkdirSync(join(dir, "labels", "stocks"), { recursive: true });
		const stock = readJsonFile("config/labels/stocks/a4-70x48.json");
		writeFileSync(
			join(dir, "labels", "stocks", "a4-70x48.json"),
			JSON.stringify({ ...stock, name: "Replaced" }),
		);
		writeFileSync(
			join(dir, "labels", "stocks", "mine.json"),
			JSON.stringify({ ...stock, id: undefined, name: "Mine" }),
		);
		const loaded = loadConfig(dir);
		const ids = loaded.config.labels.stocks.map((s) => s.id);
		expect(ids.filter((i) => i === "a4-70x48")).toHaveLength(1);
		expect(loaded.config.labels.stocks.find((s) => s.id === "a4-70x48")?.name).toBe("Replaced");
		expect(loaded.config.labels.stocks.find((s) => s.id === "mine")?.name).toBe("Mine"); // stem = id
		const index = ids.indexOf("mine");
		expect(originOf(loaded.origins, `labels.stocks.${index}.rows`)).toBe(
			join(dir, "labels", "stocks", "mine.json"),
		);
	});

	it("warns about an unknown fragment stem and reports broken fragments with their file", () => {
		const dir = fullDir();
		writeFileSync(join(dir, "typo.json"), "{}");
		const loaded = loadConfig(dir);
		expect(loaded.warnings.find((w) => w.file === join(dir, "typo.json"))?.message).toMatch(
			/not a configuration section/,
		);
		expect(SECTION_NAMES).toContain("classification");

		writeFileSync(join(dir, "covers.json"), "{ not json");
		expect(() => loadConfig(dir)).toThrow(/covers\.json/);

		writeFileSync(join(dir, "covers.json"), JSON.stringify({ width: "wide" }));
		try {
			loadConfig(dir);
			throw new Error("expected a ConfigError");
		} catch (e) {
			expect(e).toBeInstanceOf(ConfigError);
			const issue = (e as ConfigError).issues.find((i) => i.path.startsWith("covers.width"));
			expect(issue?.file).toBe(join(dir, "covers.json"));
			expect((e as ConfigError).message).toContain("covers.json");
		}
	});

	it("the shipped folder merges to exactly Appendix A of PLAN.md", () => {
		const plan = readFileSync("PLAN.md", "utf8");
		const start = plan.indexOf("## Appendix A");
		const block = /```json\n([\s\S]*?)\n```/.exec(plan.slice(start))?.[1] ?? "{}";
		const strip = (o: unknown): unknown => {
			if (Array.isArray(o)) {
				return o.map(strip);
			}
			if (o && typeof o === "object") {
				return Object.fromEntries(
					Object.entries(o as Record<string, unknown>)
						.filter(([k]) => !k.startsWith("_comment"))
						.map(([k, v]) => [k, strip(v)]),
				);
			}
			return o;
		};
		const appendix = strip(JSON.parse(block)) as Record<string, unknown>;
		const merged = strip(exampleRaw()) as Record<string, unknown>;
		// stocks are files now: order by id on both sides
		const byId = (arr: unknown): { id: string }[] =>
			[...(arr as { id: string }[])].sort((a, b) => a.id.localeCompare(b.id));
		(appendix.labels as Record<string, unknown>).stocks = byId(
			(appendix.labels as Record<string, unknown>).stocks,
		);
		(merged.labels as Record<string, unknown>).stocks = byId(
			(merged.labels as Record<string, unknown>).stocks,
		);
		expect(merged).toEqual(appendix);
	});

	it("assembleConfig records the base origin for every key", () => {
		const a = assembleConfig(temp(), { library: { name: "x" } }, "base.json");
		expect(a.files).toEqual(["base.json"]);
		expect(originOf(a.origins, "library.name")).toBe("base.json");
		expect(originOf(a.origins, "nothing.here")).toBe("base.json");
	});
});
