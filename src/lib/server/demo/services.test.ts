// SPDX-License-Identifier: GPL-3.0-or-later
// The services of the public demo store the example, not what the visitor sent (9.17, Q121):
// notes, patrons, records and copies, classes, print lists, wishes, inventories, reasons,
// pictures, and the CSV imports, which take the demo's example file only.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import {
	auditLog,
	biblio,
	classGroup,
	inventoryScan,
	item,
	note,
	patron,
	printList,
	staffUser,
	wish,
} from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { readCsv } from "#lib/server/imports/csv.js";
import { detectCatalogFormat, validateCatalogImport } from "#lib/server/imports/catalog.js";
import { mapRows } from "#lib/server/imports/pipeline.js";
import {
	detectPatronFormat,
	mapPatronRows,
	validatePatronImport,
} from "#lib/server/imports/patrons.js";
import { templateResponse } from "#lib/server/imports/template.js";
import { storeUpload } from "#lib/server/imports/uploads.js";
import { catalogRules, createBiblio, updateBiblio } from "#lib/server/services/catalog.js";
import {
	addItems,
	CHECK_IN_REASON,
	setItemStatus,
	updateItem,
} from "#lib/server/services/catalog-items.js";
import { createGroups } from "#lib/server/services/class-groups.js";
import { saveCover } from "#lib/server/services/covers.js";
import { openInventory, recordScan } from "#lib/server/services/inventory.js";
import { savePatronPhoto } from "#lib/server/services/media.js";
import { createNote } from "#lib/server/services/notes.js";
import {
	calendarEventsBetween,
	createCalendarEvent,
	updateCalendarEvent,
} from "#lib/server/services/calendar-events.js";
import {
	createPatron,
	patronRules,
	updatePatron,
	updatePatronNotes,
} from "#lib/server/services/patrons.js";
import { createPrintList, renamePrintList } from "#lib/server/services/print-lists.js";
import { stagePictogram } from "#lib/server/services/taxonomy-pictograms.js";
import { createWish } from "#lib/server/services/wishlist.js";
import { schoolOf } from "#lib/server/school/structure.js";
import { codeTable } from "#lib/server/barcodes/table.js";
import {
	CATALOG_FIELDS,
	CATALOG_IMPORT,
	STUDENT_IMPORT,
	TEACHER_IMPORT,
} from "#lib/shared/import-columns.js";
import type { BiblioFormInput } from "#lib/shared/catalog-schema.js";
import { demoExample, prepareDemoTexts } from "./content.js";
import { demoExamplePath, readDemoExample, writeDemoExamples } from "./examples.js";
import type { DemoBlockedError } from "./public.js";

const config = parseConfig(exampleRaw()).config;
const rules = catalogRules(config);
const school = schoolOf(config);
const now = new Date("2026-10-18T17:40:00Z");
const saved = { DEMO_PUBLIC: process.env.DEMO_PUBLIC, DATA_DIR: process.env.DATA_DIR };
let dataDir = "";
const bytes = new Uint8Array([1, 2, 3, 4]);

beforeAll(async () => {
	await prepareDemoTexts("it", "Europe/Rome", (key, params) =>
		Promise.resolve(`${key.split(".").pop() ?? ""} ${String(params.when)}`),
	);
});
beforeEach(() => {
	dataDir = mkdtempSync(join(tmpdir(), "bv-demo-services-"));
	process.env.DATA_DIR = dataDir;
	process.env.DEMO_PUBLIC = "1";
	resetEnvCache();
});
afterEach(() => {
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	resetEnvCache();
	rmSync(dataDir, { recursive: true, force: true });
});

function setup(): { db: Db; actor: { id: number }; classA: number } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: ["admin"] })
		.returning({ id: staffUser.id })
		.get();
	const level = school.levels[0]?.code ?? "1";
	// the wizard's classes (no actor): never replaced
	const [classA = 0] = createGroups(
		db,
		school,
		[
			{ kind: "students", name: "A", levels: [level] },
			{ kind: "students", name: "B", levels: [level] },
		],
		null,
		now,
	);
	return { db, actor, classA };
}

const record = (over: Partial<BiblioFormInput> = {}): BiblioFormInput => ({
	title: "Titolo del visitatore",
	subtitle: "",
	originalTitle: "",
	responsibility: "",
	author: "Visitatore, Uno",
	publisher: "Editore",
	publicationPlace: "",
	publicationYear: "2021",
	isbn: "",
	issn: "",
	ean: "",
	physicalDescription: "",
	series: "",
	seriesNumber: "",
	dewey: "",
	kind: "fiction",
	genreCode: config.classification.genres[0]?.code ?? "",
	classCode: "",
	readingLevel: config.classification.fictionByClass
		? (config.classification.readingLevels[0]?.code ?? "")
		: "",
	subjects: "",
	notes: "",
	...over,
});

describe("the services of the public demo", () => {
	it("store a note as the demo's text, its colour and pin as chosen", () => {
		const { db, actor } = setup();
		const id = createNote(
			db,
			{ body: "testo offensivo", color: "pink", pinned: true },
			actor,
			now,
		);
		expect(db.select().from(note).where(eq(note.id, id)).get()).toMatchObject({
			body: demoExample("note", now),
			color: "pink",
			pinned: 1,
		});
	});

	it("store a date of the calendar under the demo's text, its days as chosen (9.25)", () => {
		const { db, actor } = setup();
		const id = createCalendarEvent(
			db,
			{
				title: "testo offensivo",
				notes: "altro testo",
				startsOn: "2026-11-02",
				endsOn: "2026-11-04",
			},
			actor,
			now,
		);
		expect(
			calendarEventsBetween(db, "2026-11-01", "2026-11-30").find((e) => e.id === id),
		).toMatchObject({
			title: demoExample("date", now),
			notes: demoExample("comment", now),
			startsOn: "2026-11-02",
			endsOn: "2026-11-04",
		});
		// a later edit of the days keeps the stored texts
		updateCalendarEvent(
			db,
			id,
			{
				title: demoExample("date", now),
				notes: demoExample("comment", now),
				startsOn: "2026-11-03",
				endsOn: "",
			},
			actor,
			new Date(now.getTime() + 60_000),
		);
		expect(
			calendarEventsBetween(db, "2026-11-01", "2026-11-30").find((e) => e.id === id),
		).toMatchObject({
			title: demoExample("date", now),
			startsOn: "2026-11-03",
			endsOn: null,
		});
	});

	it("store a patron under fake names, keep them on a later edit", () => {
		const { db, actor, classA } = setup();
		const pRules = patronRules(config, now);
		const form = {
			patronType: "student" as const,
			firstName: "Nome",
			lastName: "Reale",
			levelCode: school.levels[0]?.code ?? "1",
			groupId: String(classA),
			groupName: "",
			cardNumber: "",
			externalId: "X1",
			email: "vero@example.org",
			circulationNote: "",
			notes: "nota",
		};
		const id = createPatron(db, form, actor, pRules);
		const stored = db.select().from(patron).where(eq(patron.id, id)).get();
		expect(stored).toMatchObject({
			email: null,
			externalId: null,
			notes: demoExample("comment"),
		});
		expect(stored?.firstName).not.toBe("Nome");
		// the same names sent back with the form stay
		updatePatron(
			db,
			id,
			{
				...form,
				firstName: stored?.firstName ?? "",
				lastName: stored?.lastName ?? "",
				notes: stored?.notes ?? "",
			},
			actor,
			pRules,
		);
		expect(db.select().from(patron).where(eq(patron.id, id)).get()).toMatchObject({
			firstName: stored?.firstName,
			lastName: stored?.lastName,
		});
		updatePatronNotes(
			db,
			id,
			{ circulationNote: "attenzione", notes: stored?.notes ?? "" },
			actor,
		);
		expect(db.select().from(patron).where(eq(patron.id, id)).get()?.circulationNote).toMatch(
			/^comment /,
		);
	});

	it("store an example record and copies with the call number of the format", () => {
		const { db, actor } = setup();
		const id = createBiblio(db, record(), actor, rules, { now });
		const row = db.select().from(biblio).where(eq(biblio.id, id)).get();
		expect(row).toMatchObject({
			title: demoExample("book", now),
			author: "AA. VV.",
			publisher: "s.n.",
		});
		// an edit of something else keeps the stored title
		updateBiblio(
			db,
			id,
			record({
				title: row?.title,
				author: "AA. VV.",
				publisher: "s.n.",
				publicationYear: "2022",
			}),
			actor,
			rules,
			now,
		);
		expect(db.select().from(biblio).where(eq(biblio.id, id)).get()).toMatchObject({
			title: demoExample("book", now),
			publicationYear: 2022,
		});
		// the import (the demo's example file only) keeps its own data
		const imported = createBiblio(db, record({ title: "Dal file di esempio" }), actor, rules, {
			source: "import",
			now,
		});
		expect(db.select().from(biblio).where(eq(biblio.id, imported)).get()?.title).toBe(
			"Dal file di esempio",
		);
		const copy = {
			itemType: config.library.itemTypes[0]?.code ?? "libro",
			callNumber: "SCRITTA",
			readingLevel: "",
			enumeration: "vol. scritto",
			acquisitionDate: "",
			notes: "nota della copia",
			notForLoan: false,
		};
		const { ids } = addItems(db, id, copy, 1, actor, rules, now);
		const [itemId = 0] = ids;
		const stored = db.select().from(item).where(eq(item.id, itemId)).get();
		expect(stored?.callNumber).not.toBe("SCRITTA");
		expect(stored).toMatchObject({ enumeration: null, notes: demoExample("comment", now) });
		updateItem(db, itemId, { ...copy, callNumber: "ALTRA" }, actor, rules, now);
		expect(db.select().from(item).where(eq(item.id, itemId)).get()?.callNumber).toBe(
			stored?.callNumber,
		);
		// a reason typed by hand is replaced; the desk's own reason stays
		setItemStatus(db, itemId, "damaged", "motivo inventato", actor, now);
		setItemStatus(db, itemId, "damaged", CHECK_IN_REASON, actor, now);
		const reasons = db
			.select({ details: auditLog.details })
			.from(auditLog)
			.where(eq(auditLog.action, "item.status"))
			.all()
			.map((r) => (r.details as { reason?: string }).reason);
		expect(reasons).toEqual([demoExample("reason", now), CHECK_IN_REASON]);
	});

	it("name classes, lists, wishes and inventories after the demo", () => {
		const { db, actor } = setup();
		const level = school.levels[0]?.code ?? "1";
		const ids = createGroups(
			db,
			school,
			[
				{ kind: "students", name: "C", levels: [level] },
				{ kind: "students", name: "Nome inventato", levels: [level] },
				{ kind: "students", name: "Altro inventato", levels: [level] },
			],
			actor,
			now,
		);
		const names = ids.map(
			(groupId) => db.select().from(classGroup).where(eq(classGroup.id, groupId)).get()?.name,
		);
		expect(names).toEqual([
			"C",
			`${demoExample("class", now)} 2`,
			`${demoExample("class", now)} 3`,
		]);
		const list = createPrintList(db, "patrons", "Lista offensiva", actor, now);
		expect(db.select().from(printList).where(eq(printList.id, list)).get()?.name).toBe(
			demoExample("printList", now),
		);
		renamePrintList(db, list, demoExample("printList", now), actor, now);
		expect(db.select().from(printList).where(eq(printList.id, list)).get()?.name).toBe(
			demoExample("printList", now),
		);
		const { id: wishId } = createWish(
			db,
			{
				title: "Un libro",
				author: "Qualcuno",
				series: "",
				seriesNumber: "",
				note: "subito",
				patronId: null,
			},
			actor,
			now,
		);
		expect(db.select().from(wish).where(eq(wish.id, wishId)).get()).toMatchObject({
			title: demoExample("wish", now),
			author: null,
			note: demoExample("comment", now),
		});
		const campaign = openInventory(
			db,
			{ name: "Inventario offensivo", notes: "nota" },
			actor,
			now,
		);
		expect(campaign.name).toBe(demoExample("inventory", now));
		const bookId = createBiblio(db, record(), actor, rules, { now });
		const { barcodes } = addItems(
			db,
			bookId,
			{
				callNumber: "",
				readingLevel: "",
				enumeration: "",
				acquisitionDate: "",
				notes: "",
				notForLoan: false,
			},
			1,
			actor,
			rules,
			now,
		);
		recordScan(
			db,
			campaign.id,
			barcodes[0] ?? "",
			"SCAFFALE INVENTATO",
			codeTable(config),
			actor,
			now,
		);
		expect(
			db
				.select()
				.from(inventoryScan)
				.all()
				.map((s) => s.shelf),
		).toEqual([null]);
	});

	it("store the placeholder for every picture sent", async () => {
		const { db, actor, classA } = setup();
		const id = createPatron(
			db,
			{
				patronType: "student",
				firstName: "A",
				lastName: "B",
				levelCode: school.levels[0]?.code ?? "1",
				groupId: String(classA),
				groupName: "",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			patronRules(config, now),
		);
		// bytes that are no image at all: stored anyway, as the placeholder
		const photo = await savePatronPhoto(db, dataDir, id, bytes, config.photos, actor);
		expect(existsSync(join(dataDir, photo.path))).toBe(true);
		const bookId = createBiblio(db, record(), actor, rules, { now });
		const cover = await saveCover(db, dataDir, bookId, bytes, config.covers, actor, "mock");
		expect(existsSync(join(dataDir, cover.path))).toBe(true);
		expect(await stagePictogram(dataDir, bytes)).toMatch(/^[0-9a-f]{32}$/);
	});

	it("import the example files only, valid against the demo", () => {
		const { db } = setup();
		writeDemoExamples(db, config, dataDir);
		const students = readDemoExample(dataDir, "students");
		expect(students?.name).toBe("students-example.csv");
		const parsed = readCsv(students?.bytes ?? new Uint8Array());
		const detection = detectPatronFormat(parsed.rows, "students");
		const inputs = mapPatronRows(
			parsed.rows,
			detection.mapping,
			detection.header,
			"students",
			parsed.lines,
		);
		const result = validatePatronImport(db, inputs, {
			audience: "students",
			mode: "upsert",
			duplicatePolicy: "update",
			rules: patronRules(config, now),
			columns: ["firstName", "lastName", "class", "email"],
			canRemove: false,
		});
		expect(result.rows.flatMap((r) => r.reasons)).toEqual([]);
		expect(result.rows).toHaveLength(8);
		const teachers = readCsv(readDemoExample(dataDir, "teachers")?.bytes ?? new Uint8Array());
		expect(teachers.rows[0]).toEqual(
			TEACHER_IMPORT.columns
				.filter((c) => c.group !== "key" && c.field !== "group")
				.map((c) => c.header),
		);
		const catalog = readCsv(readDemoExample(dataDir, "catalog")?.bytes ?? new Uint8Array());
		const catalogDetection = detectCatalogFormat(catalog.rows);
		const catalogResult = validateCatalogImport(
			db,
			mapRows(
				catalog.rows,
				catalogDetection.mapping,
				catalogDetection.header,
				CATALOG_FIELDS,
				catalog.lines,
			),
			{ rules, useSpecialValues: false, today: "2026-10-18" },
		);
		expect(catalogResult.rows.flatMap((r) => r.reasons)).toEqual([]);
		expect(STUDENT_IMPORT.columns.map((c) => c.header)).toContain(parsed.rows[0]?.[2]);
		expect(CATALOG_IMPORT.columns.map((c) => c.header)).toEqual(
			expect.arrayContaining(catalog.rows[0] ?? []),
		);

		// the upload of any other file is refused; the example is stored under its own name
		expect(() =>
			storeUpload(dataDir, "elenco.csv", new TextEncoder().encode("a;b\n"), "students"),
		).toThrow(expect.objectContaining({ feature: "importExample" }) as DemoBlockedError);
		const stored = storeUpload(
			dataDir,
			"nome scelto.csv",
			students?.bytes ?? new Uint8Array(),
			"students",
		);
		expect(stored.filename).toBe("students-import.csv");
		expect(readFileSync(demoExamplePath(dataDir, "students"))).toEqual(
			Buffer.from(students?.bytes ?? []),
		);
		// the loans import has no free text: any file
		expect(
			storeUpload(dataDir, "prestiti.csv", new TextEncoder().encode("a;b\n"), "loans")
				.filename,
		).toBe("loans-import.csv");
	});

	it("hand out the example file as the template of an import", async () => {
		const { db } = setup();
		writeDemoExamples(db, config, dataDir);
		const response = templateResponse(
			STUDENT_IMPORT,
			new URL("http://x/t?columns=first_name"),
			"students-template.csv",
			"students",
		);
		expect(response.headers.get("Content-Disposition")).toContain("students-example.csv");
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(
			readDemoExample(dataDir, "students")?.bytes,
		);
	});
});
