// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { gridLines, TemplateDesigner, type FaceSize } from "./template-designer.svelte.js";

const SIZES: FaceSize[] = [
	{
		file: "top.html",
		widthMm: 70,
		heightMm: 48,
		offsetMm: 0,
		doc: "a4-70x48",
		cell: 0,
		variant: null,
	},
	{
		file: "bottom.html",
		widthMm: 70,
		heightMm: 48,
		offsetMm: 48,
		doc: "a4-70x48",
		cell: 1,
		variant: null,
	},
];

const TOP =
	'<div class="band">\n\t<div class="code">{{item.barcode}}</div>\n\t<div class="title">{{biblio.title_short}}</div>\n</div>\n';
const STYLE = {
	fontSizePt: 10,
	bold: true,
	italic: false,
	uppercase: false,
	align: "center",
	font: "sans",
	color: "#000000",
} as const;

describe("TemplateDesigner", () => {
	it("reads the files, adds, moves, resizes, reorders and removes elements inside the face", () => {
		const d = new TemplateDesigner("labels", SIZES);
		d.grid = 0.5;
		const files = { "top.html": TOP, "style.css": ".band{}" };
		d.load(files);
		expect(d.faces.map((f) => f.file)).toEqual(["top.html", "bottom.html"]);
		// nothing changed: the same files, and no file for the empty bottom face
		expect(d.write(files)).toEqual(files);
		expect(d.elements.map((e) => e.id)).toEqual(["e1", "e2"]);
		expect(d.unplaced).toBe(2);

		d.add("field");
		d.add("text", { text: "Biblioteca" });
		expect(d.elements.map((e) => e.id)).toEqual(["e1", "e2", "e3", "e4"]);
		expect(d.selected?.text).toBe("Biblioteca");
		expect(d.write(files)["top.html"]).toBe(
			'<div class="band">\n\t<div class="code">{{item.barcode}}</div>\n\t<div class="title">{{biblio.title_short}}</div>\n' +
				"\t<div style=\"position:absolute;left:2mm;top:2mm;width:30mm;height:6mm;overflow:hidden;font-family:Arial, Helvetica, 'Liberation Sans', 'DejaVu Sans', sans-serif;font-size:10pt\">{{item.barcode}}</div>\n" +
				"\t<div style=\"position:absolute;left:2mm;top:2mm;width:30mm;height:6mm;overflow:hidden;font-family:Arial, Helvetica, 'Liberation Sans', 'DejaVu Sans', sans-serif;font-size:10pt\">Biblioteca</div>\n</div>\n",
		);

		// moving one element fixes every element of the face where the preview drew it
		d.measured = {
			e1: { x: 0, y: 2.997, w: 69.999, h: 4.229, style: STYLE },
			e2: { x: 0, y: 7.226, w: 69.999, h: 4.229, style: STYLE },
		};
		expect(d.box(d.elements[0]!)).toEqual({ x: 0, y: 2.997, w: 69.999, h: 4.229 });
		d.moveTo("e3", 100, -3);
		expect(d.unplaced).toBe(0);
		expect(d.elements.map((e) => [e.x, e.y])).toEqual([
			[0, 3],
			[0, 7.23],
			[40, 0],
			[2, 2],
		]);
		d.moveBy("e3", -0.26, 10.3);
		expect([d.elements[2]?.x, d.elements[2]?.y]).toEqual([39.5, 10.5]);
		d.resizeTo("e3", 80, 0.2);
		expect([d.elements[2]?.w, d.elements[2]?.h]).toEqual([30.5, 1]);

		d.reorder("e3", 1);
		expect(d.elements.map((e) => e.id)).toEqual(["e1", "e2", "e4", "e3"]);
		d.reorder("e1", -1);
		expect(d.elements.map((e) => e.id)).toEqual(["e1", "e2", "e4", "e3"]);

		// the bottom face had no file: it gets one with its first element
		d.face = 1;
		d.add("barcode");
		expect(d.elements.map((e) => e.id)).toEqual(["e5"]);
		expect(d.write(files)["bottom.html"]).toBe(
			'<div class="bv-barcode" style="position:absolute;left:2mm;top:2mm;width:40mm;height:10mm">{{{barcode_svg}}}</div>\n',
		);
		d.remove("e5");
		expect(d.selected).toBeNull();
		expect(d.write(files)["bottom.html"]).toBeUndefined();

		// read again from what it wrote: the same drawing
		const written = d.write(files);
		const top = written["top.html"] ?? "";
		expect(top).toContain(
			'<div class="code" style="position:absolute;margin:0;box-sizing:border-box;left:0mm;top:3mm;width:70mm;height:4.23mm">',
		);
		d.load(written);
		expect(d.face).toBe(1);
		expect(d.write(written)).toEqual(written);
		d.face = 0;
		expect(d.unplaced).toBe(0);
		expect(d.write(written, true)["top.html"]?.match(/data-bv=/g)).toHaveLength(4);
	});

	it("starts the face of a card from its root", () => {
		const d = new TemplateDesigner("cards", [
			{ ...SIZES[0]!, file: "front.html", widthMm: 85.6, heightMm: 54, doc: "front" },
		]);
		d.load({});
		d.add("photo");
		expect(d.write({})["front.html"]).toMatch(
			/^<div class="face front">\n\t<div style="position:absolute;left:2mm;top:2mm;width:15mm;height:15mm;overflow:hidden;background-color:#e5e7eb">\{\{#patron\.has_photo\}\}/,
		);
	});

	it("snaps moves and sizes to the grid chosen, or to a tenth of a millimetre without one", () => {
		const d = new TemplateDesigner("labels", SIZES);
		d.load({ "top.html": TOP });
		d.add("box");
		const id = d.selectedId ?? "";
		expect([d.grid, d.step]).toEqual([2, 2]);
		d.grid = 5;
		d.moveTo(id, 12.4, 13);
		d.resizeTo(id, 7, 11);
		expect([d.selected?.x, d.selected?.y, d.selected?.w, d.selected?.h]).toEqual([
			10, 15, 5, 10,
		]);
		expect(d.step).toBe(5);
		d.grid = 2.5;
		d.moveBy(id, d.step, 0);
		expect(d.selected?.x).toBe(12.5);
		d.grid = 0;
		d.moveTo(id, 3.14159, 2.71828);
		expect([d.selected?.x, d.selected?.y, d.step]).toEqual([3.1, 2.7, 0.1]);
	});

	it("starts on a grid of 2 mm", () => {
		expect(new TemplateDesigner("labels", SIZES).grid).toBe(2);
	});

	it("draws the grid's lines where the moves land, never drifting", () => {
		// 200 %: a step of 2 mm is 15.118 px, a size the browser would round if it repeated a tile
		const scale = (96 / 25.4) * 2;
		const lines = gridLines(85.6, 2, scale);
		expect(lines).toHaveLength(43);
		expect(lines[0]).toBe(0);
		expect(lines.at(-1)).toBeCloseTo(84 * scale, 6);
		for (const [k, x] of lines.entries()) {
			expect(x).toBeCloseTo(k * 2 * scale, 6);
		}
		// lines closer than 6 px are thinned to every 2, 5 or 10 steps, still on the grid
		expect(gridLines(10, 0.5, 96 / 25.4)).toEqual(
			[0, 2.5, 5, 7.5, 10].map((v) => (v * 96) / 25.4),
		);
		expect(gridLines(10, 0, 96 / 25.4)).toEqual([]);
	});
});
