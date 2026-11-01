// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { pageCss, previewDocument, printDocument, rulerSvg, SCREEN_PAGES_CSS } from "./document.js";

describe("print documents", () => {
	it("wraps the styles and the body in the installation's language, escaped", () => {
		const html = printDocument({
			title: "Tessere <1> d'Anna",
			lang: "it",
			styles: ["a { b: c; }", ".x {}"],
			body: "<p>x</p>",
			bodyData: { layout: 'du"plex' },
		});
		expect(html).toBe(`<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>Tessere &lt;1&gt; d&#39;Anna</title>
<style>a { b: c; }</style>
<style>.x {}</style>
</head><body data-layout="du&quot;plex"><p>x</p></body></html>`);
	});

	it("gives pages of the paper's size and their screen view", () => {
		const css = pageCss({ width: 148, height: 210 }, "A5 portrait");
		expect(css[0]).toBe("@page { size: A5 portrait; margin: 0; }");
		expect(css[2]).toContain("width: 148mm; height: 210mm;");
		expect(pageCss({ width: 210, height: 297 })[0]).toBe(
			"@page { size: A4 portrait; margin: 0; }",
		);
		expect(SCREEN_PAGES_CSS).toMatch(/^@media screen/);
	});

	it("frames one face for the preview iframe at its zoom", () => {
		const html = previewDocument({
			title: "default",
			lang: "en",
			zoom: 2,
			frameCss: ".face { width: 10mm; }",
			css: ".tpl { color: red; }",
			body: "<div></div>",
		});
		expect(html).toContain('<html lang="en">');
		expect(html).toContain("body { zoom: 2; }\n.face { width: 10mm; }</style>");
		expect(html).toContain("<style>.tpl { color: red; }</style>");
		expect(html).toContain("<body><div></div></body>");
	});

	it("draws a ruler with a tick per millimetre and a number per centimetre", () => {
		const svg = rulerSvg(30);
		expect(svg.match(/<line /g)).toHaveLength(32);
		expect(svg.match(/<text /g)).toHaveLength(4);
	});
});
