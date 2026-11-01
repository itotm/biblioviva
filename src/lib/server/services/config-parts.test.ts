// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCache } from "#lib/server/config/index.js";
import { loadConfig } from "#lib/server/config/load.js";
import { resetEnvCache } from "#lib/server/env.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import { folderFiles, mergeParts, partsIn, selectedFiles } from "./config-parts.js";

let root = "";
let live = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "bv-config-parts-"));
	live = join(root, "live");
	process.env.CONFIG_DIR = live;
	resetEnvCache();
	resetConfigCache();
	setUiTheme(live, "ocean");
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(root, { recursive: true, force: true });
});

function write(dir: string, files: Record<string, Uint8Array>): void {
	for (const [rel, bytes] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, rel)), { recursive: true });
		writeFileSync(join(dir, rel), bytes);
	}
}
const text = (dir: string, rel: string): string => readFileSync(join(dir, rel), "utf8");
const doc = (dir: string, rel: string): Record<string, Record<string, unknown>> =>
	JSON.parse(text(dir, rel)) as Record<string, Record<string, unknown>>;

describe("configuration parts", () => {
	it("tells the parts a folder holds, labels stocks and templates by kind included", () => {
		const parts = partsIn(live);
		for (const p of [
			"section:library",
			"section:labels",
			"config:classification",
			"config:calendar",
			"config:stocks",
			"config:cardTemplates",
			"config:pairTemplates",
			"config:barcodeTemplates",
			"config:spineTemplates",
			"config:slipTemplates",
		]) {
			expect(parts, p).toContain(p);
		}
		expect(parts).not.toContain("config:logo");
	});

	it("exports only the selected parts, config.json cut to the selected sections", () => {
		const files = selectedFiles(live, [
			"config:spineTemplates",
			"section:circulation",
			"config:stocks",
		]);
		const names = Object.keys(files).sort();
		expect(names.every((n) => n === "config.json" || n.startsWith("labels/"))).toBe(true);
		expect(names.some((n) => n.startsWith("labels/templates/spine-default/"))).toBe(true);
		expect(names.some((n) => n.startsWith("labels/templates/pair-default/"))).toBe(false);
		expect(names.some((n) => n.startsWith("labels/stocks/"))).toBe(true);
		const base = JSON.parse(new TextDecoder().decode(files["config.json"])) as Record<
			string,
			Record<string, unknown>
		>;
		// the example keeps its stocks in labels/stocks/: config.json has only the section asked
		expect(Object.keys(base).filter((k) => !k.startsWith("_"))).toEqual(["circulation"]);
	});

	it("takes the selected parts from another folder and leaves the rest byte for byte", () => {
		// stocks written in config.json too: they belong to the stocks part, not to the labels
		const start = doc(live, "config.json");
		const stock = JSON.parse(text(live, "labels/stocks/a4-70x48.json")) as Record<
			string,
			unknown
		>;
		start.labels = {
			...start.labels,
			stocks: [{ ...stock, id: "in-linea", name: "In linea" }],
		};
		writeFileSync(join(live, "config.json"), JSON.stringify(start));
		const exported = join(root, "exported");
		write(exported, selectedFiles(live, ["config:cardTemplates", "section:labels"]));
		expect(Object.keys(doc(exported, "config.json").labels ?? {})).not.toContain("stocks");

		// the live folder changes afterwards: a template, a setting, the stocks
		writeFileSync(
			join(live, "cards/templates/default/front.html"),
			'<div class="face front">cambiato</div>',
		);
		const base = doc(live, "config.json");
		base.circulation = { ...base.circulation, receipts: true };
		base.labels = { ...base.labels, titleMaxChars: 12 };
		const [first] = (base.labels as { stocks: { name: string }[] }).stocks;
		if (first) {
			first.name = "Rinominato";
		}
		writeFileSync(join(live, "config.json"), JSON.stringify(base));
		const before = Object.fromEntries(folderFiles(live).map((f) => [f, text(live, f)]));

		const out = join(root, "merged");
		mergeParts(live, exported, ["config:cardTemplates", "section:labels"], out);
		expect(text(out, "cards/templates/default/front.html")).not.toContain("cambiato");
		const merged = doc(out, "config.json");
		expect(merged.circulation?.receipts).toBe(true);
		expect(merged.labels?.titleMaxChars).toBe(30);
		expect((merged.labels as { stocks: { name: string }[] }).stocks[0]?.name).toBe(
			"Rinominato",
		);
		for (const [f, content] of Object.entries(before)) {
			if (!f.startsWith("cards/templates/") && f !== "config.json") {
				expect(text(out, f), f).toBe(content);
			}
		}
		expect(loadConfig(out).config.labels.titleMaxChars).toBe(30);
	});

	it("removes the files of a part the other folder does not have, and moves a section's file", () => {
		const other = join(root, "other");
		write(other, selectedFiles(live, ["section:circulation"]));
		writeFileSync(join(other, "circulation.json"), JSON.stringify({ receipts: true }));
		const out = join(root, "merged");
		mergeParts(live, other, ["section:circulation", "config:reports"], out);
		expect(doc(out, "circulation.json")).toEqual({ receipts: true });
	});
});
