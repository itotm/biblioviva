// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import type { ServerContext } from "#lib/server/context.js";
import type { Db } from "#lib/server/db/client.js";
import { staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { writeCardSize } from "#lib/shared/card-size.js";
import { readFace, type DesignElement } from "#lib/shared/template-design.js";
import { writeFace } from "#lib/shared/template-design-write.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import { deleteTemplate } from "./template-folders.js";
import {
	editorSource,
	previewDraft,
	saveTemplateSource,
	TemplateEditorError,
} from "./template-editor.js";

let dir = "";
let dataDir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-template-editor-"));
	dataDir = mkdtempSync(join(tmpdir(), "bv-template-editor-data-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
	setUiTheme(dir, "ocean");
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
	rmSync(dataDir, { recursive: true, force: true });
});

const OPTIONS = { today: "2026-09-26", teacherLabel: "Docente" };

function database(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

/** The context of a request over the test folders, with the configuration as loaded now. */
function context(db: Db): ServerContext {
	return { db, config: getConfig(), configDir: dir, dataDir };
}

describe("template editor", () => {
	it("opens a folder of the configuration with its files and the faces to draw", () => {
		const source = editorSource(getConfig(), dir, "cards", "default");
		expect(Object.keys(source.files)).toEqual([
			"back.html",
			"front.html",
			"style.css",
			"template.json",
		]);
		expect(source.faces.map((f) => [f.file, f.widthMm, f.doc])).toEqual([
			["front.html", 85.6, "front"],
			["back.html", 85.6, "back"],
		]);
		expect(source.assets).toContain("logo.png");
		const pair = editorSource(getConfig(), dir, "labels", "pair-default");
		// every layout of the unit, each on a stock that selects it
		expect(pair.faces.map((f) => [f.file, f.offsetMm, f.doc, f.cell, f.variant])).toEqual([
			["top.html", 0, "a4-70x48", 0, "full"],
			["bottom.html", 48, "a4-70x48", 1, "full"],
			["top-compact.html", 0, "a4-70x24", 0, "compact"],
			["bottom-compact.html", 24, "a4-70x24", 1, "compact"],
		]);
		const barcode = editorSource(getConfig(), dir, "labels", "barcode-default");
		expect(barcode.faces.map((f) => [f.file, f.heightMm])).toEqual([
			["label.html", 48],
			["label-compact.html", 24],
		]);
		expect(() => editorSource(getConfig(), dir, "cards", "nope")).toThrow(TemplateEditorError);
	});

	it("previews code drafts, reports the problems of a broken one, and saves", () => {
		const { db, actor } = database();
		const source = editorSource(getConfig(), dir, "cards", "default");
		const files = {
			...source.files,
			"front.html":
				source.files["front.html"]?.replace("{{library.name}}", "Biblioteca di prova") ??
				"",
		};
		const preview = previewDraft(
			context(db),
			{ kind: "cards", name: "default", files },
			OPTIONS,
		);
		expect(preview.ok && preview.preview.kind === "cards" && preview.preview.front).toContain(
			"Biblioteca di prova",
		);
		const broken = previewDraft(
			context(db),
			{ kind: "cards", name: "default", files: { ...files, "front.html": "{{nope}}" } },
			OPTIONS,
		);
		expect(broken.ok).toBe(false);
		expect(() =>
			saveTemplateSource(
				context(db),
				{ kind: "cards", name: "default", files: { ...files, "front.html": "{{nope}}" } },
				OPTIONS,
				actor,
			),
		).toThrow(TemplateEditorError);
		const change = saveTemplateSource(
			context(db),
			{ kind: "cards", name: "default", files },
			OPTIONS,
			actor,
		);
		expect(change.files.map((f) => f.path)).toEqual(["cards/templates/default/front.html"]);
		expect(readFileSync(join(dir, "cards/templates/default/front.html"), "utf8")).toContain(
			"Biblioteca di prova",
		);
	});

	it("saves a drawing as the files it edits, keeping the variants and dropping a design.json", () => {
		const { db, actor } = database();
		const folder = join(dir, "labels/templates/spine-default");
		writeFileSync(join(folder, "design.json"), "{}");
		const source = editorSource(getConfig(), dir, "labels", "spine-default");
		let n = 0;
		const face = readFace(
			"labels",
			"label.html",
			source.files["label.html"] ?? "",
			() => `e${++n}`,
		);
		const elements = face.nodes.filter((x): x is DesignElement => x.kind === "element");
		// the flow layout fixed where the preview draws it, then the pictogram moved
		elements.forEach((e, i) => {
			Object.assign(e, { placed: true, x: 0, y: i * 8, w: 70, h: 6 });
		});
		const pictogram = elements.find((e) => e.type === "pictogram");
		Object.assign(pictogram ?? {}, { x: 4, y: 20, w: 20, h: 20 });
		const files = { ...source.files, "label.html": writeFace(face) };
		const preview = previewDraft(
			context(db),
			{ kind: "labels", name: "spine-default", files },
			OPTIONS,
		);
		expect(preview.ok && preview.preview.kind === "labels").toBe(true);
		if (preview.ok && preview.preview.kind === "labels") {
			// one document per layout: the full band and the compact sticker
			expect(preview.preview.docs.map((d) => [d.stock, d.variant])).toEqual([
				["a4-70x48", "full"],
				["l7651", "compact"],
			]);
			expect(preview.preview.docs[0]?.html).toContain(
				"left:4mm;top:20mm;width:20mm;height:20mm",
			);
		}
		const change = saveTemplateSource(
			context(db),
			{ kind: "labels", name: "spine-default", files },
			OPTIONS,
			actor,
		);
		expect(change.files.map((f) => f.path).sort()).toEqual([
			"labels/templates/spine-default/design.json",
			"labels/templates/spine-default/label.html",
		]);
		expect(existsSync(join(folder, "design.json"))).toBe(false);
		const saved = editorSource(getConfig(), dir, "labels", "spine-default");
		expect(saved.files["template.json"]).toBe(source.files["template.json"]);
		expect(saved.files["style.css"]).toBe(source.files["style.css"]);
		expect(saved.faces.map((f) => f.file)).toEqual(["label.html", "label-compact.html"]);
	});

	it("previews every kind of slip with sample rows", () => {
		const { db } = database();
		for (const name of ["overdue-by-class", "overdue-patron", "checkout-receipt"]) {
			const source = editorSource(getConfig(), dir, "slips", name);
			const preview = previewDraft(
				context(db),
				{ kind: "slips", name, files: source.files },
				OPTIONS,
			);
			expect(
				preview.ok && preview.preview.kind === "slips" && preview.preview.html,
				name,
			).toContain("Pinocchio");
		}
	});

	it("reports a slip draft whose template.json is not valid instead of failing", () => {
		const { db } = database();
		const source = editorSource(getConfig(), dir, "slips", "checkout-receipt");
		for (const json of ["{ oops", JSON.stringify({ name: "checkout-receipt" })]) {
			const preview = previewDraft(
				context(db),
				{
					kind: "slips",
					name: "checkout-receipt",
					files: { ...source.files, "template.json": json },
				},
				OPTIONS,
			);
			expect(preview.ok, json).toBe(false);
		}
	});

	it("refuses a card too large for the sheet, with its size and the largest that fits", () => {
		const { db, actor } = database();
		const source = editorSource(getConfig(), dir, "cards", "default");
		const files = {
			...source.files,
			"template.json": writeCardSize(source.files["template.json"] ?? "", {
				width: 120,
				height: 80,
			}),
		};
		const preview = previewDraft(
			context(db),
			{ kind: "cards", name: "default", files },
			OPTIONS,
		);
		expect(preview).toEqual({
			ok: false,
			problems: [expect.stringContaining("120 × 80 mm")],
			cardSize: { width: 120, height: 80, maxWidth: 99, maxHeight: 285 },
		});
		expect(() =>
			saveTemplateSource(
				context(db),
				{ kind: "cards", name: "default", files },
				OPTIONS,
				actor,
			),
		).toThrow(TemplateEditorError);
	});

	it("never opens a template shipped with the application", () => {
		const { db, actor } = database();
		deleteTemplate(db, dir, "cards", "default", actor);
		expect(() => editorSource(getConfig(), dir, "cards", "default")).toThrow(
			TemplateEditorError,
		);
	});
});
