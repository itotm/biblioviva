// SPDX-License-Identifier: GPL-3.0-or-later
// The Mermaid diagrams of docs/ drawn as SVG (step 9.53, ADR-053): every ```mermaid block of the
// Markdown, by the hash of its code (`site/.diagrams/<hash>.svg`, read by `scripts/site-build.ts`),
// in the fonts of the documentation so the labels fit the boxes on the site.
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { diagramHash, mermaidBlocks } from "../../scripts/diagrams.ts";

const ROOT = resolve(".");
const OUT = join(ROOT, "site", ".diagrams");

function markdownFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory()
			? markdownFiles(path)
			: name.endsWith(".md")
				? [path]
				: [];
	});
}

test("draws the diagrams of the documentation", async ({ page }) => {
	const codes = new Set(
		markdownFiles(join(ROOT, "docs")).flatMap((f) => mermaidBlocks(readFileSync(f, "utf8"))),
	);
	rmSync(OUT, { recursive: true, force: true });
	mkdirSync(OUT, { recursive: true });
	const font = pathToFileURL(
		join(ROOT, "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"),
	).href;
	const host = join(OUT, "render.html");
	writeFileSync(
		host,
		`<!doctype html><meta charset="utf-8"><style>@font-face{font-family:"Inter Variable";src:url("${font}") format("woff2");font-weight:100 900}body{font-family:"Inter Variable",sans-serif}</style><div id="c"></div>`,
	);
	await page.goto(pathToFileURL(host).href);
	await page.addScriptTag({ path: join(ROOT, "node_modules/mermaid/dist/mermaid.min.js") });
	await page.evaluate(async () => {
		await document.fonts.load('16px "Inter Variable"');
	});
	for (const code of codes) {
		const svg = await page.evaluate(
			async ({ code, id }) => {
				const m = (
					window as unknown as {
						mermaid: {
							initialize: (c: object) => void;
							render: (id: string, code: string) => Promise<{ svg: string }>;
						};
					}
				).mermaid;
				m.initialize({
					startOnLoad: false,
					securityLevel: "strict",
					theme: "neutral",
					fontFamily: '"Inter Variable", sans-serif',
					er: { useMaxWidth: false },
					flowchart: { useMaxWidth: false },
				});
				return (await m.render(id, code)).svg;
			},
			{ code, id: `d${diagramHash(code)}` },
		);
		expect(svg).toContain("<svg");
		writeFileSync(join(OUT, `${diagramHash(code)}.svg`), svg);
	}
	rmSync(host);
	expect(readdirSync(OUT)).toHaveLength(codes.size);
});
