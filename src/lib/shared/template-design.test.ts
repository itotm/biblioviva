// SPDX-License-Identifier: GPL-3.0-or-later
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	type DesignElement,
	type DesignFace,
	type DesignKind,
	ELEMENT_TYPES,
	emptyFace,
	NO_IMAGE,
	readFace,
} from "./template-design.js";
import { newElement, writeElement, writeFace } from "./template-design-write.js";
import { fontOf, hexColor, lengthMm } from "./template-style.js";

const CONFIG = join(import.meta.dirname, "../../../config");

function ids(): () => string {
	let n = 0;
	return () => `e${++n}`;
}

const read = (kind: DesignKind, file: string, html: string): DesignFace =>
	readFace(kind, file, html, ids());
const elementsOf = (face: DesignFace): DesignElement[] =>
	face.nodes.filter((n): n is DesignElement => n.kind === "element");

/** The lines of `b` that are not in `a`. */
const added = (a: string, b: string): string[] => {
	const before = new Set(a.split("\n"));
	return b.split("\n").filter((l) => !before.has(l));
};

const CARD = readFileSync(join(CONFIG, "cards/templates/default/front.html"), "utf8");

describe("template design", () => {
	it("writes back every face of the shipped card and label templates unchanged", () => {
		for (const kind of ["cards", "labels"] as const) {
			const root = join(CONFIG, kind, "templates");
			for (const name of readdirSync(root)) {
				for (const file of readdirSync(join(root, name)).filter((f) =>
					f.endsWith(".html"),
				)) {
					const html = readFileSync(join(root, name, file), "utf8");
					const face = read(kind, file, html);
					expect(writeFace(face), `${name}/${file}`).toBe(html);
					expect(face.locked, `${name}/${file}`).toBe(0);
				}
			}
		}
	});

	it("reads the elements of the shipped card, all placed in their own style", () => {
		const face = read("cards", "front.html", CARD);
		expect(face.root?.tag).toBe("div");
		const elements = elementsOf(face);
		expect(elements.map((e) => e.type)).toEqual([
			"image",
			"field",
			"photo",
			"html",
			"html",
			"barcode",
			"field",
		]);
		expect(elements.every((e) => e.placed)).toBe(true);
		const [logo, library, , , , barcode, number] = elements;
		expect([logo?.image, logo?.x, logo?.y, logo?.w, logo?.h]).toEqual([
			"logo.png",
			4,
			4,
			16,
			16,
		]);
		expect(library?.field).toBe("library.name");
		expect(library?.style).toEqual({
			fontSizePt: 10.2,
			bold: null,
			italic: true,
			uppercase: null,
			align: "center",
			font: "serif",
			color: null,
		});
		expect([barcode?.x, barcode?.y, barcode?.w, barcode?.h]).toEqual([8, 39.5, 70, 8]);
		expect(number?.style.bold).toBe(true);
	});

	it("reads the flow layout of a label as elements to measure", () => {
		const html = readFileSync(join(CONFIG, "labels/templates/pair-default/top.html"), "utf8");
		const elements = elementsOf(read("labels", "top.html", html));
		expect(elements.map((e) => [e.type, e.field])).toEqual([
			["field", "item.barcode"],
			["field", "biblio.title_short"],
			["pictogram", null],
			["field", "call.head"],
			["html", null],
		]);
		expect(elements.some((e) => e.placed)).toBe(false);
	});

	it("writes a move, a restyle and new content into their element only", () => {
		const face = read("cards", "front.html", CARD);
		const [, library, photo, name, , barcode, number] = elementsOf(face);
		if (!library || !photo || !name || !barcode || !number) {
			throw new Error("elements");
		}
		barcode.x = 6;
		barcode.y = 41.5;
		library.style.bold = true;
		library.style.font = "sans";
		library.style.italic = null;
		number.style.color = "#123456";
		number.style.fontSizePt = 12;
		name.html = "<strong>{{patron.last_name}}</strong>";
		const out = writeFace(face);
		expect(added(CARD, out)).toEqual([
			"\t<div style=\"position:absolute;left:20mm;top:4mm;width:38mm;height:10mm;text-align:center;font-family:Arial, Helvetica, 'Liberation Sans', 'DejaVu Sans', sans-serif;font-size:3.6mm;font-weight:700\">{{library.name}}</div>",
			'\t<div style="position:absolute;left:6mm;top:22mm;width:50mm;height:8mm;font-size:3.4mm;line-height:1.25"><strong>{{patron.last_name}}</strong></div>',
			'\t<div class="bv-barcode" style="position:absolute;left:6mm;top:41.5mm;width:70mm;height:8mm">{{{barcode_svg}}}</div>',
			'\t<div style="position:absolute;left:8mm;top:47.5mm;width:70mm;height:4mm;text-align:center;font-weight:700;font-size:12pt;letter-spacing:0.3mm;color:#123456">{{patron.card_number}}</div>',
		]);
		// read again, the changes are what the drawing shows
		const again = elementsOf(read("cards", "front.html", out));
		expect(again[5]?.x).toBe(6);
		expect(again[1]?.style.bold).toBe(true);
		expect(again[6]?.style.fontSizePt).toBe(12);
		expect(writeFace(read("cards", "front.html", out))).toBe(out);
	});

	it("fixes an element laid out by the style sheet where the preview draws it", () => {
		const face = read(
			"labels",
			"label.html",
			'<div class="band">\n\t<div class="code">{{item.barcode}}</div>\n</div>\n',
		);
		const [code] = elementsOf(face);
		if (!code) {
			throw new Error("code");
		}
		Object.assign(code, { placed: true, x: 0, y: 3, w: 70, h: 4.23 });
		expect(writeElement(code)).toBe(
			'<div class="code" style="position:absolute;margin:0;box-sizing:border-box;left:0mm;top:3mm;width:70mm;height:4.23mm">{{item.barcode}}</div>',
		);
	});

	it("changes fields, texts, images, fills, borders and the face background", () => {
		const html = [
			'<div class="face front" style="background:#fff">',
			'<div style="position:absolute;left:1mm;top:1mm;width:5mm;height:5mm">{{patron.first_name}}</div>',
			'<div style="position:absolute;left:1mm;top:1mm;width:5mm;height:5mm">Tessera</div>',
			'<img src="{{#asset}}a.png{{/asset}}" alt="" style="position:absolute;left:1mm;top:1mm;width:5mm;height:5mm" />',
			'<div style="position:absolute;left:1mm;top:1mm;width:5mm;height:5mm;background:#eee"></div>',
			"</div>",
		].join("");
		const face = read("cards", "front.html", html);
		const [field, text, image, box] = elementsOf(face);
		expect(face.background).toBe("#ffffff");
		expect(box?.fill).toBe("#eeeeee");
		if (!field || !text || !image || !box) {
			throw new Error("elements");
		}
		field.field = "patron.last_name";
		text.text = "Tessera {{n}} <b>\nriga";
		image.image = "b.png";
		box.fill = "#00ff00";
		box.border = { color: "#ff0000", widthMm: 0.5 };
		face.background = null;
		face.backgroundImage = "retro.jpg";
		expect(writeFace(face)).toBe(
			[
				'<div class="face front" style="background-image:url(\'{{#asset}}retro.jpg{{/asset}}\');background-size:cover;background-position:center">',
				'<div style="position:absolute;left:1mm;top:1mm;width:5mm;height:5mm">{{patron.last_name}}</div>',
				'<div style="position:absolute;left:1mm;top:1mm;width:5mm;height:5mm">Tessera &#123;&#123;n&#125;&#125; &lt;b&gt;<br />riga</div>',
				'<img src="{{#asset}}b.png{{/asset}}" alt="" style="position:absolute;left:1mm;top:1mm;width:5mm;height:5mm" />',
				'<div style="position:absolute;left:1mm;top:1mm;width:5mm;height:5mm;background-color:#00ff00;border:0.5mm solid #ff0000"></div>',
				"</div>",
			].join(""),
		);
	});

	it("reads the picture of the shipped card's back as the face's own, and takes it away", () => {
		const html = readFileSync(join(CONFIG, "cards/templates/default/back.html"), "utf8");
		const face = read("cards", "back.html", html);
		// a shipped background runs past the card to be cut away (step 11.17)
		expect([face.background, face.backgroundImage, face.backgroundBleed]).toEqual([
			"#ffffff",
			"background-d4.webp",
			true,
		]);
		expect(writeFace(face)).toBe(html);
		// another picture of the template: it covers the face
		face.backgroundBleed = false;
		face.backgroundImage = "retro.jpg";
		expect(writeFace(face)).toBe(
			'<div class="face back" style="background-color:#ffffff;background-image:url(\'{{#asset}}retro.jpg{{/asset}}\');background-size:cover;background-position:center"></div>\n',
		);
		face.backgroundImage = NO_IMAGE;
		const written = writeFace(face);
		expect(written).toBe(
			'<div class="face back" style="background-color:#ffffff;background-image:none"></div>\n',
		);
		expect(read("cards", "back.html", written).backgroundImage).toBe(NO_IMAGE);
		// no picture of its own: the one of the style sheet, if any
		face.backgroundImage = null;
		expect(writeFace(face)).toBe(
			'<div class="face back" style="background-color:#ffffff"></div>\n',
		);
		// a shipped background chosen again: with its bleed
		face.backgroundImage = "background-c8.webp";
		face.backgroundBleed = true;
		expect(read("cards", "back.html", writeFace(face))).toMatchObject({
			backgroundImage: "background-c8.webp",
			backgroundBleed: true,
		});
	});

	it("keeps the elements inside a Mustache section and those of a file without a root as they are", () => {
		const html =
			'<div class="a">x</div>\n{{#classification.image_url}}<img src="{{classification.image_url}}">{{/classification.image_url}}\n<style>.a{}</style>\n';
		const face = read("labels", "label.html", html);
		expect(face.root).toBeNull();
		expect(face.locked).toBe(2);
		expect(elementsOf(face).map((e) => e.type)).toEqual(["text"]);
		const [a] = elementsOf(face);
		if (a) {
			a.text = "y";
		}
		expect(writeFace(face)).toBe(html.replace(">x<", ">y<"));
	});

	it("marks every element for the preview, changed or not", () => {
		const face = read("cards", "front.html", CARD);
		const marked = writeFace(face, true);
		expect(marked.match(/data-bv="e\d+"/g)).toHaveLength(7);
		const [logo] = elementsOf(face);
		if (logo) {
			logo.x = 5;
		}
		expect(writeFace(face, true)).toContain(
			'<img data-bv="e1" src="{{#asset}}logo.png{{/asset}}"',
		);
	});

	it("makes new elements of every type that read back as the same type", () => {
		for (const kind of ["cards", "labels"] as const) {
			for (const type of ELEMENT_TYPES.filter((t) => t !== "other")) {
				const e = newElement(
					kind,
					type,
					"n1",
					{ widthMm: 70, heightMm: 48 },
					{
						text: "Testo",
						image: "logo.png",
					},
				);
				expect(e.type, `${kind} ${type}`).toBe(type);
				expect(e.placed).toBe(true);
				const html = writeElement(e);
				const back = elementsOf(read(kind, "x.html", html))[0];
				expect(back?.type, `${kind} ${type}`).toBe(type === "html" ? "text" : type);
				expect(writeFace(read(kind, "x.html", html))).toBe(html);
			}
		}
		const small = newElement("labels", "barcode", "n2", { widthMm: 30, heightMm: 8 });
		expect([small.x, small.y, small.w, small.h]).toEqual([0, 0, 30, 8]);
	});

	it("tells the kinds of hand-written elements and keeps the text around a root", () => {
		const html =
			'<!-- front -->\n<div class="face front">\n<img src="{{photo_url}}" alt=""><input type="text"><img src="x.png"><div></div>\n</div>\n<!-- end -->\n';
		const face = read("cards", "front.html", html);
		expect(face.before).toBe("<!-- front -->\n");
		expect(face.after).toBe("\n<!-- end -->\n");
		expect(elementsOf(face).map((e) => e.type)).toEqual(["photo", "other", "other", "box"]);
		const [, , , box] = elementsOf(face);
		if (box) {
			box.style.italic = true;
			box.style.uppercase = true;
			box.style.align = "right";
		}
		expect(writeFace(face)).toContain(
			'<div style="font-style:italic;text-transform:uppercase;text-align:right"></div>',
		);
		expect(writeFace(read("cards", "back.html", emptyFace("cards", "back.html")))).toBe(
			'<div class="face back">\n</div>\n',
		);
		expect(emptyFace("labels", "label.html")).toBe("");
	});

	it("reads lengths, colours and type faces", () => {
		expect(lengthMm("3.5mm")).toBe(3.5);
		expect(lengthMm("1cm")).toBe(10);
		expect(lengthMm("72pt")).toBe(25.4);
		expect(lengthMm("96px")).toBe(25.4);
		expect(lengthMm("0")).toBe(0);
		expect(lengthMm("5")).toBeNull();
		expect(lengthMm("100%")).toBeNull();
		expect(lengthMm(null)).toBeNull();
		expect(hexColor("#AbC")).toBe("#aabbcc");
		expect(hexColor("red")).toBeNull();
		expect(fontOf('"DejaVu Sans", Arial, sans-serif')).toBe("sans");
		expect(fontOf("Georgia, 'DejaVu Serif', serif")).toBe("serif");
		expect(fontOf("'DejaVu Sans Mono', monospace")).toBe("mono");
		// a style left as it was keeps its own way of writing a value
		const face = read(
			"labels",
			"x.html",
			'<div style="position:absolute;left:0;top:0;width:10mm;height:5mm;font-weight:bold;font-size:12px">{{item.barcode}}</div>',
		);
		const [e] = elementsOf(face);
		expect([e?.placed, e?.style.bold, e?.style.fontSizePt]).toEqual([true, true, 9]);
		if (e) {
			e.style.bold = false;
		}
		expect(writeFace(face)).toContain("font-weight:400;font-size:12px");
	});
});
