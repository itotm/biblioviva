// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PICTOGRAM_ICONS, pictogramSvg, symbolColour } from "./pictograms.js";

describe("pictograms", () => {
	it("draws the icon in white on dark colours and near-black on light ones", () => {
		expect(symbolColour("#1a237e")).toBe("#ffffff");
		expect(symbolColour("#f6e300")).toBe("#1c1917");
		expect(symbolColour("not a colour")).toBe("#1c1917");
	});

	it("builds a self-contained SVG and drops anything that is not a shape", () => {
		const svg = pictogramSvg(
			[
				["path", { d: "M1 1h2", key: "x" }],
				["script", { src: "evil.js" }],
				["circle", { cx: 12, cy: 12, r: 3, onload: "alert(1)" }],
			],
			"#e8231b",
			'Romanzi "e" <Racconti>',
		);
		expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100"/);
		expect(svg).toContain('<path d="M1 1h2"/>');
		expect(svg).toContain('<circle cx="12" cy="12" r="3"/>');
		expect(svg).not.toMatch(/script|onload|key=/);
		expect(svg).toContain("<title>Romanzi &quot;e&quot; &lt;Racconti></title>");
	});

	it("ships one generated pictogram for every genre and non-fiction top node", () => {
		const taxonomy = JSON.parse(readFileSync("config/classification.json", "utf8")) as {
			genres: { code: string; image?: string }[];
			nonfiction: { code: string; image?: string }[];
		};
		for (const node of [...taxonomy.genres, ...taxonomy.nonfiction]) {
			expect(PICTOGRAM_ICONS[node.code], node.code).toBeDefined();
			expect(node.image).toBe(`${node.code}.svg`);
			const file = `config/classification/images/${node.code}.svg`;
			expect(existsSync(file), file).toBe(true);
			const svg = readFileSync(file, "utf8");
			expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 100 100"/);
			expect(svg).not.toMatch(/<script|on\w+=/i);
		}
	});
});
