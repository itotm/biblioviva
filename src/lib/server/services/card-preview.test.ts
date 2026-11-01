// SPDX-License-Identifier: GPL-3.0-or-later
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { staffUser } from "#lib/server/db/schema.js";
import { TemplateError } from "#lib/server/templates/engine.js";
import { createPatron } from "./patrons.js";
import { savePatronPhoto } from "./media.js";
import {
	duplexCalibrationHtml,
	previewPatron,
	PreviewPatronNotFoundError,
	renderCardPreview,
	samplePatron,
	sampleSheetHtml,
	testSheetHtml,
} from "./card-preview.js";
import type { Db } from "#lib/server/db/client.js";
import { classId, PATRON_RULES } from "../../../../tests/helpers/school.js";

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-preview-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const config = parseConfig(exampleRaw()).config;
const rules = PATRON_RULES;

function seeded(): { db: Db; actor: { id: number }; student: number } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const student = createPatron(
		db,
		{
			patronType: "student",
			firstName: "Anna",
			lastName: "Verdi",
			levelCode: "3",
			groupId: String(classId(db, "3", "A")),
			groupName: "",
			cardNumber: "0000001240",
			externalId: "",
			email: "",
			circulationNote: "",
			notes: "",
		},
		actor,
		rules,
	);
	return { db, actor, student };
}

/** A user template folder: a copy of the built-in default, optionally broken. */
function userTemplate(configDir: string, name: string, patch?: (dir: string) => void): string {
	const dir = join(configDir, "cards", "templates", name);
	cpSync("config/cards/templates/default", dir, { recursive: true });
	writeFileSync(
		join(dir, "template.json"),
		JSON.stringify({ name, description: `copy ${name}`, patronTypes: ["teacher"] }),
	);
	patch?.(dir);
	return dir;
}

describe("card preview", () => {
	it("renders the sample patron of the template kind as two standalone documents", () => {
		const { db } = seeded();
		const configDir = temp();
		const p = renderCardPreview({ db, config, configDir, dataDir: temp() }, "default");
		expect(p.template).toBe("default");
		expect(p.front).toMatch(/^<!doctype html>/);
		expect(p.front).toContain("Maria");
		expect(p.front).toContain("Esempio");
		expect(p.front).toContain("Sezione B");
		expect(p.front).toContain("zoom: 1;");
		expect(p.back).toContain('class="tpl-cards-default"');
		expect([p.widthMm, p.heightMm, p.zoom]).toEqual([85.6, 53.98, 1]);

		userTemplate(configDir, "docenti");
		const teacher = renderCardPreview({ db, config, configDir, dataDir: temp() }, "docenti", {
			zoom: 2,
		});
		expect(teacher.front).toContain("Giovanni");
		expect(teacher.front).toContain("Docente");
		expect(teacher.front).toContain("zoom: 2;");
		expect(samplePatron("teacher")).toMatchObject({ levelLabel: "", classLabel: "Docenti" });
	});

	it("renders a real patron with the photo and refuses unknown ids", async () => {
		const { db, actor, student } = seeded();
		const dataDir = temp();
		await savePatronPhoto(
			db,
			dataDir,
			student,
			new Uint8Array(readFileSync("tests/fixtures/images/portrait-exif.jpg")),
			config.photos,
			actor,
		);
		const p = renderCardPreview({ db, config, configDir: temp(), dataDir }, "default", {
			patronId: student,
		});
		expect(p.front).toContain("Verdi");
		expect(p.front).toContain("Sezione A");
		// the photo saved (in the configured format), inside the photo's frame
		expect(p.front).toMatch(
			/<img src="data:image\/(?:webp|jpeg);base64,[^"]+" alt="" style="display:block;width:100%;height:100%;object-fit:cover" \/>/,
		);
		expect(previewPatron(db, dataDir, 0).patron.firstName).toBe("Maria");
		expect(() => previewPatron(db, dataDir, 999)).toThrow(PreviewPatronNotFoundError);
	});

	it("reports a broken template with its problems", () => {
		const { db } = seeded();
		const configDir = temp();
		userTemplate(configDir, "typo", (dir) =>
			writeFileSync(join(dir, "front.html"), '<div class="face">{{patron.nickname}}</div>'),
		);
		expect(() => renderCardPreview({ db, config, configDir, dataDir: temp() }, "typo")).toThrow(
			TemplateError,
		);
		expect(() =>
			renderCardPreview({ db, config, configDir, dataDir: temp() }, "missing"),
		).toThrow(/not found/);
	});
});

describe("sample sheet, test sheet and duplex calibration", () => {
	it("fills one page with sample units", () => {
		const html = sampleSheetHtml(config, temp(), "default", "Prova");
		expect(html.match(/class="unit /g)).toHaveLength(config.cards.sheet.rows);
		expect(html).toContain("<title>Prova</title>");
		expect(html).not.toContain("Verdi");
	});

	it("draws the test sheet with labelled faces and a 10 cm ruler", () => {
		const html = testSheetHtml(config, temp(), "default", {
			front: "FRONTE",
			back: "RETRO",
			ruler: "Righello",
			title: "Pagina di prova",
		});
		expect(html.match(/data-unit=/g)).toHaveLength(config.cards.sheet.rows);
		expect(html.match(/>FRONTE</g)).toHaveLength(config.cards.sheet.rows);
		expect(html).toContain("171.2 × 53.98 mm");
		expect(html).toContain('width="104mm"');
		expect(html).toContain('viewBox="-2 0 104 8"');
		expect(html).toContain("@page { size: A4 portrait");
		expect(() =>
			testSheetHtml(config, temp(), "nope", { front: "", back: "", ruler: "", title: "" }),
		).toThrow(TemplateError);
	});

	it("draws the crop and fold marks of the real sheet on the test sheet", () => {
		const labels = { front: "FRONTE", back: "RETRO", ruler: "Righello", title: "Prova" };
		const html = testSheetHtml(config, temp(), "default", labels);
		expect(html).toContain('<svg class="bv-marks"');
		// the fold of every unit, dashed, in the gaps and margins above and below it
		expect(html).toContain('<line x1="105" y1="0" x2="105" y2="5" stroke-dasharray="1 0.7" />');
		// a crop mark at the left edge of the units, in the top margin
		expect(html).toContain('<line x1="19.4" y1="0" x2="19.4" y2="5" />');
		// marks switched off in the configuration are left out, as on the real sheet
		const none = testSheetHtml(
			{
				...config,
				cards: {
					...config.cards,
					sheet: { ...config.cards.sheet, cutMarks: false, foldMarks: false },
				},
			},
			temp(),
			"default",
			labels,
		);
		expect(none).not.toContain('<svg class="bv-marks"');
	});

	it("fills a sheet printed on both sides with ten fronts and ten backs (9.27)", () => {
		const html = sampleSheetHtml(config, temp(), "default", "Prova", { layout: "duplex" });
		expect(html.match(/class="slot front /g)).toHaveLength(10);
		expect(html.match(/class="slot back /g)).toHaveLength(10);
		expect(html.match(/class="page"/g)).toHaveLength(2);
	});

	it("draws the duplex calibration: the outline on side 1, the rulers behind its edges on side 2 (9.27)", () => {
		const labels = { title: "Calibrazione", cut: "Ritaglia", read: "Leggi" };
		const html = duplexCalibrationHtml(config, labels);
		expect(html.match(/class="page"/g)).toHaveLength(2);
		// side 1: the 150 × 100 mm card in the middle of the page
		expect(html).toContain('class="card front" style="left: 30mm; top: 98.5mm;"');
		// side 2, turned on the long edge: the back at the mirrored place, the horizontal ruler's
		// 0 on the front's left edge (the back's right edge, x 180), the vertical one on its top
		expect(html).toContain('class="card back" style="left: 30mm; top: 98.5mm;"');
		expect(html).toContain('data-ruler="left" style="left: 167mm; top: 141.5mm;"');
		expect(html).toContain('data-ruler="top" style="left: 98mm; top: 85.5mm;"');
		expect(html.match(/>\+5</g)).toHaveLength(2);
		expect(html.match(/>−10</g)).toHaveLength(2);
		// the offset in use moves the back and its rulers; a short-edge flip mirrors the rows
		const moved = duplexCalibrationHtml(
			{
				...config,
				cards: {
					...config.cards,
					duplex: { flip: "short-edge", backOffsetMm: { x: 1, y: 2 } },
				},
			},
			labels,
		);
		expect(moved).toContain('data-flip="short-edge"');
		expect(moved).toContain('class="card back" style="left: 31mm; top: 100.5mm;"');
		// the front's top edge is the back's bottom edge there: 100.5 + 100
		expect(moved).toContain('data-ruler="top" style="left: 99mm; top: 187.5mm;"');
	});
});
