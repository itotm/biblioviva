// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	buildStartTag,
	decodeEntities,
	literal,
	markStartTag,
	nodeText,
	parseStyle,
	plainText,
	sectionBalance,
	serializeStyle,
	splitNodes,
	styleValue,
	withAttr,
	withStyle,
	type ElementNode,
} from "./template-html.js";

const join = (html: string): string => splitNodes(html).map(nodeText).join("");

describe("template HTML", () => {
	it("splits a file into top-level nodes and joins them back byte for byte", () => {
		const samples = [
			"",
			"plain text",
			'<div class="a">x</div>',
			'\n<!-- note <div> -->\n<div class="face front">\n\t<img src="{{#asset}}a.png{{/asset}}" alt="">\n</div>\n',
			"<div><div><span>a</span></div><div>b</div></div><p>c</p>",
			"{{#x}}<b>y</b>{{/x}} a < b <br/> <hr> <input value='a>b'>",
			'<div style="--band: {{classification.color}}" data-x=1 hidden>z</div>',
			"<style>.a > .b { color: red }</style><div>after</div>",
			"<DIV Class=up>case</div>",
			"<div>never closed",
			"<div/>self<span />",
		];
		for (const html of samples) {
			expect(join(html), html).toBe(html);
		}
	});

	it("reads elements with their tag, attributes, content and end", () => {
		const nodes = splitNodes(
			'  <div class="a" data-x=1 hidden style="left:1mm">in<div>ner</div></div>\n<img src="x" alt="" />',
		);
		expect(nodes.map((n) => n.kind)).toEqual(["raw", "element", "raw", "element"]);
		const div = nodes[1] as ElementNode;
		expect(div.tag).toBe("div");
		expect(div.attrs).toEqual([
			["class", "a"],
			["data-x", "1"],
			["hidden", null],
			["style", "left:1mm"],
		]);
		expect(div.inner).toBe("in<div>ner</div>");
		expect(div.endTag).toBe("</div>");
		const img = nodes[3] as ElementNode;
		expect([img.tag, img.inner, img.endTag]).toEqual(["img", "", ""]);
		// an element left open ends the parse as text
		expect(splitNodes("<p>a</p><div>open").map((n) => n.kind)).toEqual(["element", "raw"]);
		// broken or unusual markup stays text, byte for byte
		for (const html of [
			'<div class="x',
			"<div a='x>",
			"<div / data-a>b</div>",
			"<style>.a{}",
			"<div>x</div",
			"<div><!-- </div> --><style>.a { content: '</div>' }</style>z</div>",
			"<div><style>.a{}</div>",
		]) {
			expect(join(html), html).toBe(html);
		}
		const nested = splitNodes(
			"<div><!-- </div> --><style>.a { content: '</div>' }</style>z</div>",
		)[0] as ElementNode;
		expect(nested.inner).toBe("<!-- </div> --><style>.a { content: '</div>' }</style>z");
		expect((splitNodes("<div / data-a>b</div>")[0] as ElementNode).attrs).toEqual([
			["data-a", null],
		]);
	});

	it("counts Mustache sections", () => {
		expect(sectionBalance("{{#a}} {{^b}} {{/b}}")).toBe(1);
		expect(sectionBalance("{{/a}}")).toBe(-1);
		expect(sectionBalance("{{x}} {{{y}}}")).toBe(0);
	});

	it("reads and writes style declarations, keeping quotes, functions and Mustache whole", () => {
		const decls = parseStyle(
			" left: 3mm; font-family:'A; B', serif ;background:url('x;y.png') ; --band: {{c}};;bad",
		);
		expect(decls).toEqual([
			{ prop: "left", value: "3mm" },
			{ prop: "font-family", value: "'A; B', serif" },
			{ prop: "background", value: "url('x;y.png')" },
			{ prop: "--band", value: "{{c}}" },
		]);
		expect(styleValue(decls, "left")).toBe("3mm");
		expect(styleValue(decls, "top")).toBeNull();
		expect(serializeStyle(withStyle(decls, "left", "4mm"))).toBe(
			"left:4mm;font-family:'A; B', serif;background:url('x;y.png');--band:{{c}}",
		);
		expect(withStyle(decls, "background", null).map((d) => d.prop)).toEqual([
			"left",
			"font-family",
			"--band",
		]);
		expect(withStyle([], "top", "1mm")).toEqual([{ prop: "top", value: "1mm" }]);
	});

	it("rebuilds start tags and marks them for the preview", () => {
		const attrs = withAttr(
			[
				["class", "a"],
				["style", 'x:"q"'],
			],
			"src",
			"{{photo_url}}",
		);
		expect(buildStartTag("div", attrs)).toBe(
			'<div class="a" style="x:&quot;q&quot;" src="{{photo_url}}">',
		);
		expect(buildStartTag("img", withAttr(attrs, "style", null))).toBe(
			'<img class="a" src="{{photo_url}}" />',
		);
		expect(buildStartTag("input", [["hidden", null]])).toBe("<input hidden />");
		expect(markStartTag('<div class="a">', "data-bv", "e1")).toBe(
			'<div data-bv="e1" class="a">',
		);
	});

	it("tells plain text from markup and keeps literal text away from HTML and Mustache", () => {
		expect(plainText("  Biblioteca &amp; scuola<br />seconda\n  riga ")).toBe(
			"Biblioteca & scuola\nseconda riga",
		);
		expect(plainText("{{x}}")).toBeNull();
		expect(plainText("<b>x</b>")).toBeNull();
		expect(decodeEntities("&#123;&#x7D;&lt;&nbsp;&unknown;")).toBe("{}< &unknown;");
		expect(literal('a {{b}} <c> & "d"\ne')).toBe(
			"a &#123;&#123;b&#125;&#125; &lt;c&gt; &amp; &quot;d&quot;<br />e",
		);
	});
});
