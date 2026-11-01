// SPDX-License-Identifier: GPL-3.0-or-later
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { auditLog, patron, staffUser } from "#lib/server/db/schema.js";
import { createPatron } from "./patrons.js";
import { savePatronPhoto } from "./media.js";
import { cardGeometry, type CardGeometry, cutGuide, sheetCss, sheetMarks } from "./card-sheets.js";
import {
	buildCardContext,
	CARD_FIELDS,
	listCardTemplates,
	loadCardTemplate,
	PLACEHOLDER_PHOTO,
	renderCard,
	templateNameFor,
} from "./card-templates.js";
import {
	markCardsPrinted,
	recordCardsPrinted,
	recordGroupCardsPrinted,
	renderCardsSheet,
	selectPatronsForCards,
} from "./cards.js";
import type { Db } from "#lib/server/db/client.js";
import { DemoBlockedError } from "#lib/server/demo/public.js";
import { resetEnvCache } from "#lib/server/env.js";
import { classId, PATRON_RULES } from "../../../../tests/helpers/school.js";

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-cards-"));
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
const input = {
	patronType: "student" as const,
	firstName: "Anna",
	lastName: "D'Angelo <script>",
	levelCode: "3",
	groupId: "",
	groupName: "A",
	cardNumber: "0000001240",
	externalId: "",
	email: "",
	circulationNote: "",
	notes: "",
};

function seeded(): { db: Db; actor: { id: number }; student: number; teacher: number } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	classId(db, "3", "A");
	const student = createPatron(db, input, actor, rules);
	const teacher = createPatron(
		db,
		{
			...input,
			patronType: "teacher",
			firstName: "Sara",
			lastName: "Neri",
			levelCode: "",
			groupName: "",
			cardNumber: "0001000018",
		},
		actor,
		rules,
	);
	return { db, actor, student, teacher };
}

describe("card context and template", () => {
	it("builds every allowed field, escaping names and using the placeholder without a photo", () => {
		const { db, student } = seeded();
		const p = selectPatronsForCards(db, { ids: [student] })[0]!;
		const template = loadCardTemplate("default", temp());
		const ctx = buildCardContext(
			p,
			config,
			template.meta,
			null,
			new Date("2026-09-19T10:00:00Z"),
		);
		expect(ctx.patron).toMatchObject({
			first_name: "Anna",
			class_label: "3 A",
			level_label: "3",
			level_name: "Terza primaria",
			group: "A",
			is_student: true,
			is_teacher: false,
			has_photo: false,
			card_number: "0000001240",
		});
		expect(ctx.school).toEqual({ group_word: "Sezione" });
		expect(ctx.school_year).toBe("2026/2027");
		expect(ctx.issued_on).toBe("2026-09-19");
		expect(ctx.valid_until).toBe("2027-09-19");
		expect(ctx.photo_url).toBe(PLACEHOLDER_PHOTO);
		expect(ctx.barcode_svg.startsWith("<svg")).toBe(true);
		for (const field of CARD_FIELDS) {
			const value = field
				.split(".")
				.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], ctx);
			expect(value, field).not.toBeUndefined();
		}
		const card = renderCard(template, ctx, student);
		expect(card.front).toContain("D&#39;Angelo &lt;script&gt;");
		expect(card.front).toContain("Sezione A");
		expect(card.front).toContain("<svg");
		// no photo: the grey frame of the photo stays empty
		expect(card.front).toContain('background-color:#dddddd"></div>');
		expect(card.front).toContain('src="data:image/png;base64,');
		expect(card.css).toContain(".tpl-cards-default .front");
		expect(card.back).toContain('class="face back"');
		// the back's picture on the face itself, where the designer reads it
		expect(card.back).toContain("background-image:url('data:image/webp;base64,");
	});

	it("prints the class line and the fixed words of the installation (9.41)", () => {
		const { db, student, teacher } = seeded();
		const template = loadCardTemplate("default", temp());
		const japan: typeof config = {
			...config,
			library: {
				...config.library,
				schoolYearStart: "04-01",
				schoolYearLabel: "start" as const,
			},
			school: { ...config.school, cardClass: "{level}年{group}組" },
		};
		const english = (key: string): string => (key === "teacher" ? "Teacher" : key);
		const card = (
			id: number,
			c: typeof config = japan,
		): { ctx: ReturnType<typeof buildCardContext>; front: string } => {
			const p = selectPatronsForCards(db, { ids: [id] })[0]!;
			const ctx = buildCardContext(
				p,
				c,
				template.meta,
				null,
				new Date("2026-09-19T10:00:00Z"),
				english,
			);
			return { ctx, front: renderCard(template, ctx, id).front };
		};
		const pupil = card(student);
		expect(pupil.ctx.patron.class_line).toBe("3年A組");
		expect(pupil.ctx.school_year).toBe("2026");
		expect(pupil.front).toContain("3年A組");
		expect(pupil.front).not.toContain("Sezione");
		const adult = card(teacher);
		expect(adult.front).toContain("Teacher");
		expect(adult.front).not.toContain("Docente");
		// the default line, as before: the word and the group
		expect(card(student, config).ctx.patron.class_line).toBe("Sezione A");
	});

	it("resolves templates per patron type and reports broken user templates", () => {
		expect(templateNameFor(config, "student")).toBe("default");
		expect(
			templateNameFor(
				{
					...config,
					cards: { ...config.cards, templateByPatronType: { teacher: "staff" } },
				},
				"teacher",
			),
		).toBe("staff");
		const configDir = temp();
		mkdirSync(join(configDir, "cards", "templates", "broken"), { recursive: true });
		writeFileSync(
			join(configDir, "cards", "templates", "broken", "template.json"),
			'{"patronTypes": ["alien"]}',
		);
		const list = listCardTemplates(configDir);
		// the three shipped templates (step 11.17) and the broken one of the folder
		expect(list.map((t) => [t.name, t.error === null])).toEqual([
			["broken", false],
			["default", true],
			["fronte-retro", true],
			["verticale", true],
		]);
		expect(() => loadCardTemplate("nope", configDir)).toThrow(/not found/);
	});
});

const geometryOf = (c: typeof config, layout: "side-by-side" | "duplex"): CardGeometry =>
	cardGeometry(c, undefined, layout);

describe("geometry and sheet", () => {
	it("uses CR80 faces side by side and fits four or five rows on A4", () => {
		const g = cardGeometry(config);
		expect(g).toMatchObject({ cardW: 85.6, cardH: 53.98, unitW: 171.2, rows: 4 });
		expect(g.fit.fits).toBe(true);
		expect(g.usedHeightMm).toBeCloseTo(4 * 53.98 + 3 * 3 + 12, 2);
		const five = cardGeometry({
			...config,
			cards: { ...config.cards, sheet: { ...config.cards.sheet, rows: 5 } },
		});
		expect(five.fit.fits).toBe(true);
		expect(five.usedHeightMm).toBeLessThanOrEqual(297);
		// the shipped portrait template (step 11.17): the rows that fit the page, three
		const portrait = cardGeometry(
			{ ...config, cards: { ...config.cards, sheet: { ...config.cards.sheet, rows: 5 } } },
			loadCardTemplate("verticale", temp()).meta,
		);
		expect(portrait).toMatchObject({ cardW: 53.98, cardH: 85.6, rows: 3 });
		expect(portrait.fit.fits).toBe(true);
		expect(portrait.usedHeightMm).toBeLessThanOrEqual(297);
		const css = sheetCss(config, g);
		expect(css).toContain("width: 171.2mm; height: 53.98mm");
		expect(css).toContain(".face { width: 85.6mm; height: 53.98mm");
		// no coloured outline by default: crop marks show where to cut (step 11.17)
		expect(css).not.toContain("outline:");
		// every card placed in mm from the corner of the paper (9.27)
		expect(css).toContain("@page { size: A4 portrait; margin: 0; }");
		const outlined = sheetCss(
			{
				...config,
				cards: {
					...config.cards,
					sheet: { ...config.cards.sheet, cutLines: { color: "#c00000", widthMm: 0.2 } },
				},
			},
			g,
		);
		expect(outlined).toContain("outline: 0.2mm solid #c00000");
		expect(sheetMarks(config)).toEqual({ cut: true, fold: true });
		const off = {
			...config,
			cards: { ...config.cards, sheet: { ...config.cards.sheet, cutMarks: false } },
		};
		expect(sheetMarks(off)).toEqual({ cut: false, fold: true });
	});

	it("takes the marks and the outline from the configuration, never from a template", () => {
		const dir = temp();
		cpSync("config/cards/templates/default", join(dir, "cards", "templates", "default"), {
			recursive: true,
		});
		const file = join(dir, "cards", "templates", "default", "template.json");
		writeFileSync(
			file,
			JSON.stringify({
				...JSON.parse(readFileSync(file, "utf8")),
				foldMark: false,
				cutMarks: false,
				cutLines: { color: "#00ff00", widthMm: 1 },
			}),
		);
		const meta = loadCardTemplate("default", dir).meta;
		expect(meta).not.toHaveProperty("cutMarks");
		expect(meta).not.toHaveProperty("foldMark");
		expect(meta).not.toHaveProperty("cutLines");
		expect(sheetCss(config, cardGeometry(config, meta))).not.toContain("#00ff00");
	});

	it("gives the turn to the requests waiting while it renders a sheet", async () => {
		const { db } = seeded();
		const order: string[] = [];
		// a request that arrives while the sheet is rendered
		setImmediate(() => order.push("other request"));
		await renderCardsSheet(
			{ db, config, configDir: temp(), dataDir: temp() },
			{ groupId: classId(db, "3", "A") },
			{ breakAfterMs: 0 },
		).then(() => order.push("sheet"));
		expect(order).toEqual(["other request", "sheet"]);
	});

	it("renders a sheet for a class with photos inlined, skips patrons without a number, marks printed", async () => {
		const { db, actor, student, teacher } = seeded();
		const dataDir = temp();
		await savePatronPhoto(
			db,
			dataDir,
			student,
			new Uint8Array(readFileSync("tests/fixtures/images/portrait-exif.jpg")),
			config.photos,
			actor,
		);
		const noCard = createPatron(
			db,
			{ ...input, lastName: "Zeta", cardNumber: "" },
			actor,
			rules,
		);
		db.$client.run("update patron set card_number = null where id = ?", [noCard]);

		expect(selectPatronsForCards(db, {})).toEqual([]);
		expect(
			selectPatronsForCards(db, { groupId: classId(db, "3", "A") }).map((p) => p.lastName),
		).toEqual(["D'Angelo <script>", "Zeta"]);
		expect(selectPatronsForCards(db, { patronType: "teacher" }).map((p) => p.id)).toEqual([
			teacher,
		]);
		expect(selectPatronsForCards(db, { missingCard: true })).toHaveLength(3);

		const job = await renderCardsSheet(
			{ db, config, configDir: temp(), dataDir },
			{ groupId: classId(db, "3", "A") },
			{ now: new Date("2026-09-19T10:00:00Z") },
		);
		expect(job.count).toBe(1);
		expect(job.skipped).toEqual([noCard]);
		expect(job.html).toContain("<!doctype html>");
		expect(job.html).toContain(`data-patron="${student}"`);
		expect(job.html).toContain('src="data:image/webp;base64,');
		expect(job.html).not.toContain('background-color:#dddddd"></div>');

		// the unit at its place: centred across, the page margin from the top
		expect(job.html).toContain(`style="left: 19.4mm; top: 6mm;"`);

		// on both sides of the sheet (9.27): a page of fronts, a page of backs at the mirrored
		// places moved by the calibrated offset, the background running past the edge
		const duplexConfig = {
			...config,
			cards: {
				...config.cards,
				bleedMm: 1.5,
				duplex: { flip: "long-edge" as const, backOffsetMm: { x: 1, y: -0.5 } },
			},
		};
		const duplex = await renderCardsSheet(
			{ db, config: duplexConfig, configDir: temp(), dataDir },
			{ groupId: classId(db, "3", "A") },
			{ now: new Date("2026-09-19T10:00:00Z"), layout: "duplex" },
		);
		expect(duplex.html).toContain('data-layout="duplex"');
		expect(duplex.html.match(/class="page"/g)).toHaveLength(2);
		// the back's picture once in the document, every back (and its bleed copy) refers to it
		// (step 9.29)
		expect(duplex.html.match(/url\("data:image\/webp/g)).toHaveLength(1);
		expect(duplex.html).toContain(':root {\n--bv-asset-1: url("data:image/webp;base64,');
		expect(
			duplex.html.match(/background-image:var\(--bv-asset-1\)/g)?.length,
		).toBeGreaterThanOrEqual(2 * duplex.count);
		const left = Math.round(((210 - (2 * 85.6 + 3)) / 2) * 100) / 100;
		expect(duplex.html).toContain(`class="slot front`);
		expect(duplex.html).toContain(`style="left: ${left}mm; top: 6mm;"`);
		const backX = Math.round((210 - (210 - (2 * 85.6 + 3)) / 2 - 85.6 + 1) * 100) / 100;
		expect(duplex.html).toContain(`style="left: ${backX}mm; top: 5.5mm;"`);
		expect(duplex.html).toContain("bv-bleed");
		expect(duplex.html).toContain("left: -1.5mm !important");
		// side by side never bleeds
		expect(job.html).not.toMatch(/class="[^"]*bv-bleed/);
		expect(geometryOf(duplexConfig, "duplex")).toMatchObject({ perPage: 10, bleedMm: 1.5 });

		expect(recordCardsPrinted(db, [student, teacher], actor)).toBe(2);
		expect(
			db
				.select()
				.from(auditLog)
				.all()
				.filter((r) => r.action === "patron.cards_printed")
				.map((r) => r.details),
		).toEqual([{ count: 2 }]);
		expect(selectPatronsForCards(db, { missingCard: true }).map((p) => p.id)).toEqual([noCard]);
		expect(markCardsPrinted(db, [])).toBe(0);
	});
});

describe("a job of several templates", () => {
	// students on the portrait card (53.98 × 85.6 mm), teachers on the default one (85.6 × 53.98)
	const mixed = {
		...config,
		cards: {
			...config.cards,
			templateByPatronType: { student: "verticale" },
			sheet: { ...config.cards.sheet, cutLines: { color: "#c00000", widthMm: 0.2 } },
		},
	};

	it("prints a print list in its own order, a level, and an empty sheet when nobody matches", async () => {
		const { db, student, teacher } = seeded();
		const now = new Date("2026-09-19T10:00:00Z");
		const listed = await renderCardsSheet(
			{ db, config, configDir: temp(), dataDir: temp() },
			{ ids: [teacher, student] },
			{ now, orderedIds: [teacher, student] },
		);
		expect(listed.html.indexOf(`data-patron="${teacher}"`)).toBeLessThan(
			listed.html.indexOf(`data-patron="${student}"`),
		);
		const level = await renderCardsSheet(
			{ db, config, configDir: temp(), dataDir: temp() },
			{ levelCode: "3" },
			{ now },
		);
		expect(level.count).toBe(1);
		const none = await renderCardsSheet(
			{ db, config, configDir: temp(), dataDir: temp() },
			{ ids: [999] },
			{ now },
		);
		expect(none).toMatchObject({ count: 0, templates: [] });
		expect(none.html).toContain('<body data-layout="side-by-side"></body>');
	});

	it("sizes and centres a bleeding background against the face, not against its larger copy", async () => {
		const { db, student } = seeded();
		const configDir = temp();
		// a copy of the default card whose back covers the face with a picture of its own
		const cover = join(configDir, "cards", "templates", "copertina");
		cpSync("config/cards/templates/default", cover, { recursive: true });
		writeFileSync(
			join(cover, "back.html"),
			`<div class="face back" style="background-image:url('{{#asset}}background-d4.webp{{/asset}}');background-size:cover;background-position:center"></div>\n`,
		);
		const bleeding = { ...config, cards: { ...config.cards, bleedMm: 3 } };
		for (const [template, size] of [
			["default", "calc(100% + 6mm) calc(100% + 6mm)"],
			["copertina", "cover"],
		] as const) {
			const job = await renderCardsSheet(
				{ db, config: bleeding, configDir, dataDir: temp() },
				{ ids: [student] },
				{ templateName: template, layout: "duplex", now: new Date("2026-09-19T10:00:00Z") },
			);
			// the copy runs 3 mm past every edge of the slot…
			const rule = /\.slot > \.bv-bleed \{([^}]*)\}/.exec(job.html)?.[1] ?? "";
			expect(rule).toContain("left: -3mm !important; top: -3mm !important;");
			expect(rule).toContain("width: calc(100% + 6mm) !important;");
			// …but its background is laid out in a content box of the face's size (the bleed is its
			// padding) and painted under the padding too: the picture behind the edge continues the
			// face's picture at the same scale and centre
			expect(rule).toContain("padding: 3mm !important;");
			expect(rule).toContain("box-sizing: border-box !important;");
			expect(rule).toContain("background-origin: content-box !important;");
			expect(rule).toContain("background-clip: border-box !important;");
			// the copy keeps the face's own size and position of the picture
			const copy = /<div class="face back bv-bleed"[^>]*>/.exec(job.html)?.[0] ?? "";
			expect(copy).toContain(`background-size:${size}`);
			expect(copy).toContain("background-position:center");
		}
	});

	it("puts each template's cards on sheets of their own size, with their own marks", async () => {
		const { db, student, teacher } = seeded();
		const job = await renderCardsSheet(
			{ db, config: mixed, configDir: temp(), dataDir: temp() },
			{ ids: [student, teacher] },
			{ now: new Date("2026-09-19T10:00:00Z") },
		);
		expect(job.count).toBe(2);
		// in the order of the cards: D'Angelo (student) before Neri (teacher)
		expect(job.templates).toEqual(["verticale", "default"]);
		// one page per template, each unit sized by its own template
		const pages = job.html.split('<div class="page"').slice(1);
		expect(pages).toHaveLength(2);
		expect(pages[0]).toContain(`class="unit tpl-cards-verticale" data-patron="${student}"`);
		expect(pages[1]).toContain(`class="unit tpl-cards-default" data-patron="${teacher}"`);
		// the portrait unit centred across the paper: (210 − 2 × 53.98) / 2
		expect(pages[0]).toContain('style="left: 51.02mm; top: 6mm;"');
		expect(pages[1]).toContain('style="left: 19.4mm; top: 6mm;"');
		expect(job.html).toContain(
			".unit.tpl-cards-verticale { position: absolute; display: flex; width: 107.96mm; height: 85.6mm;",
		);
		expect(job.html).toContain(
			".unit.tpl-cards-default { position: absolute; display: flex; width: 171.2mm; height: 53.98mm;",
		);
		expect(job.html).toContain(".tpl-cards-verticale .face { width: 53.98mm; height: 85.6mm;");
		expect(job.html).toContain(".tpl-cards-default .face { width: 85.6mm; height: 53.98mm;");
		// no rule sizes every face of the document
		expect(job.html).not.toMatch(/^\.face \{/m);
		// each page's fold mark at the middle of its own unit
		expect(pages[0]).toContain('<line x1="105" y1="0" x2="105" y2="5" stroke-dasharray');
		expect(pages[1]).toContain('<line x1="105" y1="0" x2="105" y2="5" stroke-dasharray');
		// the crop marks at the edges of each page's own units
		expect(pages[0]).toContain('<line x1="51.02" y1="0" x2="51.02" y2="5" />');
		expect(pages[0]).not.toContain('x1="19.4"');
		expect(pages[1]).toContain('<line x1="19.4" y1="0" x2="19.4" y2="5" />');
	});

	it("counts the sheets of every template for the public demo's limit", async () => {
		const { db, actor, teacher } = seeded();
		// nine more pupils on the portrait card, three a page: with the teacher's sheet, four sheets
		const ids = [teacher];
		for (let i = 0; i < 9; i++) {
			ids.push(
				createPatron(db, { ...input, lastName: `Zeta ${i}`, cardNumber: "" }, actor, rules),
			);
		}
		const saved = process.env.DEMO_PUBLIC;
		process.env.DEMO_PUBLIC = "1";
		resetEnvCache();
		try {
			await expect(
				renderCardsSheet(
					{ db, config: mixed, configDir: temp(), dataDir: temp() },
					{ ids },
					{ breakAfterMs: 0 },
				),
			).rejects.toBeInstanceOf(DemoBlockedError);
		} finally {
			process.env.DEMO_PUBLIC = saved;
			resetEnvCache();
		}
	});
});

describe("what the print dialog says to cut along", () => {
	it("the crop marks, else the coloured outline, else the edge of the card", () => {
		const sheet = config.cards.sheet;
		const guide = (s: Partial<typeof sheet>): string =>
			cutGuide({ ...config, cards: { ...config.cards, sheet: { ...sheet, ...s } } });
		expect(guide({})).toBe("marks");
		expect(guide({ cutLines: { color: "#c00000", widthMm: 0.2 } })).toBe("marks");
		expect(guide({ cutMarks: false, cutLines: { color: "#c00000", widthMm: 0.2 } })).toBe(
			"line",
		);
		expect(guide({ cutMarks: false, cutLines: null })).toBe("edge");
	});
});

describe("the cards of a class printed from Stampe → Classi (9.42)", () => {
	it("marks exactly the cards of the class that the print page prints", () => {
		const { db, actor, student, teacher } = seeded();
		classId(db, "3", "B");
		const other = createPatron(
			db,
			{ ...input, firstName: "Luca", lastName: "Bruni", groupName: "B", cardNumber: "" },
			actor,
			rules,
		);
		const group = classId(db, "3", "A");
		const printedOf = (id: number): string | null =>
			db.select().from(patron).where(eq(patron.id, id)).get()?.cardPrintedAt ?? null;
		expect(printedOf(student)).toBeNull();

		const now = new Date("2026-09-19T10:00:00Z");
		expect(recordGroupCardsPrinted(db, group, actor, now)).toBe(1);
		expect(printedOf(student)).toBe(now.toISOString());
		// the teacher and the pupil of another class are untouched
		expect(printedOf(teacher)).toBeNull();
		expect(printedOf(other)).toBeNull();
		expect(
			db
				.select()
				.from(auditLog)
				.all()
				.filter((r) => r.action === "patron.cards_printed")
				.map((r) => r.details),
		).toEqual([{ count: 1 }]);
		// an empty class marks nothing
		expect(recordGroupCardsPrinted(db, classId(db, "5", "C"), actor, now)).toBe(0);
	});
});
