// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	assetDataUrl,
	discoverTemplates,
	NO_PHOTO_CARDS,
	shippedTemplatesDir,
	findTemplate,
	listTemplates,
	loadTemplate,
	readTemplateJson,
	renderTemplate,
	scopeCss,
	shareDataUrls,
	TemplateError,
	unknownFields,
	usedFields,
} from "./engine.js";
import * as v from "valibot";

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-tpl-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

function makeTemplate(root: string, name: string, files: Record<string, string>): string {
	const dir = join(root, "cards", "templates", name);
	mkdirSync(join(dir, "assets"), { recursive: true });
	for (const [file, content] of Object.entries(files)) {
		writeFileSync(join(dir, file), content);
	}
	return dir;
}

describe("template discovery", () => {
	it("lists built-ins and lets CONFIG_DIR override a template of the same name", () => {
		const configDir = temp();
		makeTemplate(configDir, "default", { "template.json": '{"name":"default"}' });
		makeTemplate(configDir, "school", { "template.json": '{"name":"school"}' });
		makeTemplate(configDir, "bad name", { "template.json": "{}" });
		mkdirSync(join(configDir, "cards", "templates", "nojson"));
		const all = discoverTemplates("cards", configDir);
		expect(all.map((t) => [t.name, t.source])).toEqual([
			["default", "config"],
			["fronte-retro", "builtin"],
			["school", "config"],
			["verticale", "builtin"],
		]);
		expect(findTemplate("cards", "nope", configDir)).toBeUndefined();
		// the three shipped card templates (step 11.17)
		expect(discoverTemplates("cards", temp()).map((t) => [t.name, t.source])).toEqual([
			["default", "builtin"],
			["fronte-retro", "builtin"],
			["verticale", "builtin"],
		]);
	});

	it("ships the cards without the photo while photos are switched off (9.38)", () => {
		expect(shippedTemplatesDir("cards", false)).toBe(NO_PHOTO_CARDS);
		expect(shippedTemplatesDir("cards", true)).toBe("templates");
		expect(shippedTemplatesDir("labels", false)).toBe("templates");
		const off = discoverTemplates("cards", temp(), "config", false);
		expect(off.map((t) => t.name)).toEqual(["default", "fronte-retro", "verticale"]);
		expect(off.every((t) => t.dir.includes(NO_PHOTO_CARDS))).toBe(true);
		// a template of CONFIG_DIR still wins
		const configDir = temp();
		makeTemplate(configDir, "default", { "template.json": '{"name":"default"}' });
		expect(discoverTemplates("cards", configDir, "config", false)[0]?.source).toBe("config");
	});

	it("loads a template with its schema and checks, and lists each with its meta or error", () => {
		const configDir = temp();
		makeTemplate(configDir, "school", { "template.json": '{"name":"school","size":3}' });
		makeTemplate(configDir, "big", { "template.json": '{"name":"big","size":30}' });
		makeTemplate(configDir, "broken", { "template.json": '{"name":1}' });
		const type = {
			kind: "cards",
			schema: v.object({ name: v.string(), size: v.optional(v.number(), 1) }),
			check: (meta: { size: number }) => (meta.size > 10 ? ["size: too big"] : []),
		} as const;
		const school = loadTemplate(type, "school", configDir);
		expect(school.folder).toMatchObject({ name: "school", source: "config" });
		expect(school.meta).toEqual({ name: "school", size: 3 });
		expect(() => loadTemplate(type, "big", configDir)).toThrow(/size: too big/);
		expect(() => loadTemplate(type, "nope", configDir)).toThrow(/template folder not found/);
		const listed = listTemplates(type, configDir);
		const status = (name: string): (typeof listed)[number] | undefined =>
			listed.find((t) => t.name === name);
		expect(status("school")).toMatchObject({ meta: { size: 3 }, error: null });
		expect(status("big")).toMatchObject({
			meta: null,
			error: expect.stringMatching(/too big/),
		});
		expect(status("broken")?.error).toMatch(/template\.json name/);
		// without the check: the three built-ins and the three of CONFIG_DIR
		expect(listTemplates({ kind: "cards", schema: type.schema }, configDir)).toHaveLength(6);
	});
});

describe("fields and CSS", () => {
	it("collects the fields a template uses, sections included", () => {
		const used = usedFields("{{a.b}} {{#p}}{{x}}{{/p}} {{{raw}}} {{^q}}n{{/q}}");
		expect([...used].sort()).toEqual(["a.b", "p", "p.x", "q", "raw"]);
		expect(unknownFields("{{a.b}} {{#p}}{{x}}{{/p}} {{c}}", ["a.b", "p", "p.x"])).toEqual([
			"c",
		]);
		// names relative to an allowed list section
		expect(
			unknownFields("{{#rows}}{{patron.first_name}}{{nope}}{{/rows}}", [
				"rows",
				"patron.first_name",
			]),
		).toEqual(["rows.nope"]);
	});

	it("scopes selectors, recursing into media queries and leaving @font-face alone", () => {
		const css = scopeCss(
			".a, .b { x: 1 } @media print { .c { y: 2 } } @font-face { font-family: F }",
			"s",
		);
		expect(css).toContain(".s .a, .s .b {");
		expect(css).toContain("@media print { .s .c {");
		expect(css).toContain("@font-face { font-family: F }");
		expect(scopeCss("/* one, two */\n.a { x: 1 }", "s")).toBe("\n.s .a { x: 1 }");
	});
});

describe("rendering", () => {
	const schema = v.object({ name: v.string(), n: v.optional(v.number(), 1) });

	it("renders with escaping, raw fields, sections and inlined assets in HTML and CSS", () => {
		const configDir = temp();
		const dir = makeTemplate(configDir, "t", {
			"template.json": '{"name":"t"}',
			"face.html":
				'<p>{{patron.first_name}}</p>{{{barcode_svg}}}{{#patron.has_photo}}<img src="{{#asset}}logo.png{{/asset}}">{{/patron.has_photo}}',
			"style.css": '.x { background: url("{{#asset}}logo.png{{/asset}}") }',
		});
		writeFileSync(join(dir, "assets", "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
		const folder = findTemplate("cards", "t", configDir)!;
		expect(readTemplateJson(folder, schema)).toEqual({ name: "t", n: 1 });
		const out = renderTemplate(
			folder,
			["face.html"],
			{
				patron: { first_name: "<script>alert(1)</script>", has_photo: true },
				barcode_svg: "<svg/>",
			},
			["patron.first_name", "patron.has_photo", "barcode_svg"],
		);
		expect(out.html["face.html"]).toContain("&lt;script&gt;");
		expect(out.html["face.html"]).toContain("<svg/>");
		expect(out.html["face.html"]).toContain('src="data:image/png;base64,iVBORw=="');
		// the base rules first, then the template's own
		expect(out.css).toBe(
			'.tpl-cards-t .bv-barcode > svg { display: block; width: 100%; height: 100%; }\n.tpl-cards-t .x { background: url("data:image/png;base64,iVBORw==") }',
		);
		expect(out.scope).toBe("tpl-cards-t");
	});

	it("reports unknown fields, missing files, bad JSON and bad assets with the template name", () => {
		const configDir = temp();
		const dir = makeTemplate(configDir, "u", {
			"template.json": '{"name": 5}',
			"face.html": "{{patron.secret}} {{#asset}}../x.png{{/asset}}",
		});
		const folder = findTemplate("cards", "u", configDir)!;
		expect(() => readTemplateJson(folder, schema)).toThrow(/template.json name/);
		expect(() =>
			renderTemplate(folder, ["face.html", "other.html"], {}, ["patron.first_name"]),
		).toThrow(/unknown field \{\{patron.secret\}\}.*missing file: other.html/s);
		expect(() => assetDataUrl(folder, "../x.png")).toThrow(TemplateError);
		expect(() => assetDataUrl(folder, "missing.png")).toThrow(/asset not found/);
		writeFileSync(join(dir, "assets", "evil.exe"), "x");
		expect(() => assetDataUrl(folder, "evil.exe")).toThrow(/type not allowed/);
		writeFileSync(join(dir, "template.json"), "{ broken");
		expect(() => readTemplateJson(folder, schema)).toThrow(/template.json:/);
	});
});

describe("each picture once per document (step 9.29)", () => {
	it("writes a repeated data URL of the styles once, as a custom property", () => {
		const a = "data:image/webp;base64,AAAA";
		const b = "data:image/png;base64,BBBB";
		const body = [
			`<div style="background-image:url('${a}');background-size:cover"></div>`,
			`<div style="background-image:url("${a}")"></div>`,
			`<div style="background:#fff url(${b}) center"></div>`,
			`<img src="${b}" alt="" />`,
		].join("");
		const shared = shareDataUrls(body);
		expect(shared.body).toBe(
			[
				`<div style="background-image:var(--bv-asset-1);background-size:cover"></div>`,
				`<div style="background-image:var(--bv-asset-1)"></div>`,
				`<div style="background:#fff var(--bv-asset-2) center"></div>`,
				// an image's source is not a style: it stays
				`<img src="${b}" alt="" />`,
			].join(""),
		);
		expect(shared.css).toBe(
			`:root {\n--bv-asset-1: url("${a}");\n--bv-asset-2: url("${b}");\n}`,
		);
		expect(shareDataUrls("<p>no pictures</p>")).toEqual({
			body: "<p>no pictures</p>",
			css: "",
		});
	});
});
