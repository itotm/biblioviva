// SPDX-License-Identifier: GPL-3.0-or-later
import { recognise } from "#lib/shared/scan.js";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { biblio, importBatch, item, loan, patron, staffUser } from "#lib/server/db/schema.js";
import { createPatron, type PatronRules } from "#lib/server/services/patrons.js";
import { readCsv, type CsvEncoding, type ParsedCsv } from "./csv.js";
import {
	commitPatronImport,
	detectPatronFormat,
	mapPatronRows,
	standardMapping,
	validatePatronImport,
	type ColumnMapping,
	type CommitOptions,
	type FormatDetection,
	type PatronImportColumn,
	type PatronAudience,
	type PatronImportInput,
	type PatronImportOptions,
} from "./patrons.js";
import { ImportNotReadyError } from "./pipeline.js";
import type { Db } from "#lib/server/db/client.js";
import { TEST_CODES } from "../../../../tests/helpers/codes.js";
import { classId, PATRON_RULES } from "../../../../tests/helpers/school.js";

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-import-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const rules: PatronRules = PATRON_RULES;
const fixture = (name: string): ParsedCsv & { encoding: CsvEncoding } =>
	readCsv(new Uint8Array(readFileSync(`tests/fixtures/import/${name}`)));

function load(
	name: string,
	audience: PatronAudience = "students",
	override?: Partial<{ mapping: ColumnMapping; header: boolean }>,
): {
	detection: FormatDetection;
	inputs: PatronImportInput[];
	columns: PatronImportColumn[];
} {
	const { rows, lines } = fixture(name);
	const detection = detectPatronFormat(rows, audience);
	const mapping = override?.mapping ?? detection.mapping;
	const header = override?.header ?? detection.header;
	return {
		detection,
		inputs: mapPatronRows(rows, mapping, header, audience, lines),
		columns: mapping.filter((c): c is PatronImportColumn => c !== null),
	};
}

const simple = (rows: string[][]): PatronImportInput[] =>
	mapPatronRows(rows, standardMapping("simple"), false, "students");

function seeded(): {
	db: Db;
	actor: { id: number };
	add: (
		firstName: string,
		lastName: string,
		level: string,
		section: string,
		extra?: Partial<{
			patronType: "student" | "teacher";
			cardNumber: string;
			externalId: string;
		}>,
	) => number;
} {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	// the import never creates classes: the school has 1 A … 5 C already
	for (const level of ["1", "2", "3", "4", "5"]) {
		for (const name of ["A", "B", "C"]) {
			classId(db, level, name);
		}
	}
	const add = (
		firstName: string,
		lastName: string,
		level: string,
		section: string,
		extra: Partial<{
			patronType: "student" | "teacher";
			cardNumber: string;
			externalId: string;
		}> = {},
	): number =>
		createPatron(
			db,
			{
				patronType: extra.patronType ?? "student",
				firstName,
				lastName,
				levelCode: level,
				groupId: "",
				groupName: section,
				cardNumber: extra.cardNumber ?? "",
				externalId: extra.externalId ?? "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			rules,
		);
	return { db, actor, add };
}

const options = (over: Partial<PatronImportOptions> = {}): PatronImportOptions => ({
	audience: "students",
	mode: "upsert",
	duplicatePolicy: "update",
	rules,
	columns: ["firstName", "lastName", "level", "section"],
	canRemove: true,
	...over,
});

describe("format detection", () => {
	it("recognises the reference format with and without header", () => {
		const withHeader = detectPatronFormat(fixture("students.csv").rows, "students");
		expect(withHeader).toMatchObject({
			header: true,
			format: "simple",
			certain: true,
			columns: 4,
		});
		expect(withHeader.mapping).toEqual(standardMapping("simple"));
		const bare = detectPatronFormat(fixture("students-no-header.csv").rows, "students");
		expect(bare).toMatchObject({ header: false, format: "simple", certain: true });
		expect(detectPatronFormat([["Giulia", "Rossi", "3A"]], "students")).toMatchObject({
			header: false,
			format: "combined",
			mapping: standardMapping("combined"),
			certain: true,
		});
		expect(detectPatronFormat([["Marco", "Verdi"]], "teachers")).toMatchObject({
			header: false,
			format: "names",
			certain: true,
		});
	});

	it("reads English headers only, in any case, and ignores the other columns (Q115)", () => {
		expect(
			detectPatronFormat(fixture("students-external-id.csv").rows, "students"),
		).toMatchObject({ header: true, format: "custom", certain: true });
		expect(detectPatronFormat(fixture("students-class.csv").rows, "students")).toMatchObject({
			header: true,
			format: "combined",
			certain: true,
		});
		expect(
			detectPatronFormat(
				[["FIRST NAME", "Last-Name", "Level", "section", "notes"]],
				"students",
			).mapping,
		).toEqual(["firstName", "lastName", "level", "section", null]);
		// the Italian names of the old templates are not headers any more
		expect(
			detectPatronFormat([["nome", "cognome", "classe", "sezione"]], "students"),
		).toMatchObject({ header: false, format: "simple", certain: false });
		// a teachers file has no class: `level` is not one of its columns
		expect(
			detectPatronFormat([["first_name", "last_name", "level"]], "teachers").mapping,
		).toEqual(["firstName", "lastName", null]);
		// a header without the class is not complete: the operator looks at it
		expect(detectPatronFormat([["first_name", "last_name", "email"]], "students").certain).toBe(
			false,
		);
	});

	it("asks the operator when the shape is ambiguous", () => {
		const ambiguous = detectPatronFormat(fixture("ambiguous.csv").rows, "students");
		expect(ambiguous).toMatchObject({ format: "unknown", certain: false });
		expect(detectPatronFormat([["a", "b", "c", "d", "e"]], "students")).toMatchObject({
			format: "unknown",
			certain: false,
		});
		expect(detectPatronFormat([["a", "b", "c"]], "teachers").format).toBe("unknown");
		expect(detectPatronFormat([], "students")).toMatchObject({
			format: "unknown",
			columns: 0,
		});
	});
});

describe("mapping rows", () => {
	it("numbers lines from the file and takes the type from the import", () => {
		const { inputs } = load("students-full.csv");
		expect(inputs).toHaveLength(2);
		expect(inputs[0]).toMatchObject({ line: 2, firstName: "Giulia", patronType: "student" });
		expect(inputs[1]).toMatchObject({ line: 3, level: "2", cardNumber: "" });
		const teachers = load("teachers.csv", "teachers").inputs;
		expect(teachers.map((t) => [t.patronType, t.group])).toEqual([
			["teacher", ""],
			["teacher", "Docenti"],
		]);
		expect(load("students-no-header.csv").inputs[0]?.line).toBe(1);
	});
});

describe("validation", () => {
	it("classifies new, update and unchanged rows and keeps accents", () => {
		const { db, add } = seeded();
		add("Giulia", "Rossi", "1", "A");
		add("Luca", "Bianchi", "2", "A");
		const { inputs } = load("students.csv");
		const result = validatePatronImport(db, inputs, options());
		expect(result.rows.map((r) => [r.line, r.status])).toEqual([
			[2, "unchanged"],
			[3, "update"],
			[5, "new"],
			[6, "new"],
		]);
		expect(result.rows[1]?.changed).toEqual(["classGroupId", "levelCode"]);
		expect(result.rows[2]?.data.lastName).toBe("D'Amico");
		expect(result.counts).toEqual({ new: 2, update: 1, unchanged: 1, error: 0, total: 4 });
		// no card number in the file: the two new students get one
		expect(result.generatedCards).toBe(2);
		expect(result.canCommit).toBe(true);
		expect(result.missing).toEqual([]);
	});

	it("reads the class in one cell against the existing classes (Q115)", () => {
		const { db } = seeded();
		const { inputs, columns } = load("students-class.csv");
		const result = validatePatronImport(db, inputs, options({ columns }));
		expect(result.rows.map((r) => r.status)).toEqual(["new", "new", "new", "error"]);
		expect(result.rows[3]?.reasons[0]).toMatchObject({
			code: "classUnknown",
			params: { value: "9Z" },
		});
		// the list names every class, in order
		expect(String(result.rows[3]?.reasons[0]?.params?.classes)).toMatch(/^1 A, 1 B, 1 C, 2 A/);
	});

	it("reports every kind of row error with the line and the valid classes", () => {
		const { db } = seeded();
		const { inputs } = load("errors.csv");
		const result = validatePatronImport(db, inputs, options());
		expect(result.rows.map((r) => [r.status, r.reasons.map((x) => x.code)])).toEqual([
			["error", ["levelUnknown", "groupUnknown"]],
			["error", ["nameRequired"]],
			["error", ["groupUnknown"]],
			["error", ["groupUnknown"]],
			["new", []],
		]);
		expect(result.rows[0]?.reasons[0]).toEqual({
			code: "levelUnknown",
			params: { value: "9" },
		});
		// the unknown section of level 1 lists the classes of level 1
		expect(result.rows[2]?.reasons[0]).toEqual({
			code: "groupUnknown",
			params: { value: "Z", classes: "1 A, 1 B, 1 C" },
		});
		expect(result.canCommit).toBe(false);
		const twice = validatePatronImport(
			db,
			simple([
				["Anna", "Blu", "1", "A"],
				["Anna", "Blu", "1", "A"],
			]),
			options(),
		);
		expect(twice.rows[1]?.reasons).toEqual([{ code: "duplicateInFile", params: { line: 1 } }]);
	});

	it("applies the length caps of the patron form", () => {
		const { db } = seeded();
		const result = validatePatronImport(
			db,
			simple([
				["A".repeat(81), "Blu", "1", "A"],
				["Anna", "B".repeat(80), "1", "A"],
			]),
			options(),
		);
		expect(result.rows[0]?.reasons).toEqual([
			{ code: "tooLong", params: { column: "first_name", max: 80 } },
		]);
		expect(result.rows[1]?.status).toBe("new");
	});

	it("flags homonyms in two classes until the operator picks one", () => {
		const { db, add } = seeded();
		const a = add("Luca", "Bianchi", "1", "A");
		const b = add("Luca", "Bianchi", "3", "B");
		const inputs = simple([["Luca", "Bianchi", "2", "A"]]);
		const unresolved = validatePatronImport(db, inputs, options());
		expect(unresolved.rows[0]?.status).toBe("error");
		expect(unresolved.rows[0]?.reasons[0]?.code).toBe("homonym");
		expect(unresolved.rows[0]?.candidates?.map((c) => c.id).sort()).toEqual([a, b].sort());

		const picked = validatePatronImport(db, inputs, options({ resolutions: { 1: b } }));
		expect(picked.rows[0]).toMatchObject({
			status: "update",
			matchId: b,
			changed: ["classGroupId", "levelCode"],
		});
		const created = validatePatronImport(db, inputs, options({ resolutions: { 1: "create" } }));
		expect(created.rows[0]?.status).toBe("new");
		// the same class breaks the tie without asking
		const tie = validatePatronImport(db, simple([["Luca", "Bianchi", "3", "B"]]), options());
		expect(tie.rows[0]).toMatchObject({ status: "unchanged", matchId: b });
	});

	it("matches on card number, then external id, and refuses numbers of somebody else", () => {
		const { db, add } = seeded();
		const giulia = add("Giulia", "Rossi", "2", "B", { cardNumber: "0000001240" });
		const luca = add("Luca", "Bianchi", "1", "A", { externalId: "A0002" });
		const full = load("students-full.csv");
		const byCard = validatePatronImport(db, full.inputs, options({ columns: full.columns }));
		expect(byCard.rows[0]).toMatchObject({ status: "update", matchId: giulia });
		expect(byCard.rows[0]?.changed).toEqual(["classGroupId", "levelCode", "email"]);
		expect(byCard.rows[1]?.status).toBe("new");

		const external = load("students-external-id.csv");
		const ext = validatePatronImport(
			db,
			external.inputs,
			options({ columns: external.columns }),
		);
		expect(ext.rows[1]).toMatchObject({ status: "unchanged", matchId: luca });
		// Giulia is found by name and gets the external id
		expect(ext.rows[0]).toMatchObject({
			status: "update",
			matchId: giulia,
			changed: ["classGroupId", "levelCode", "externalId"],
		});

		const stolen = validatePatronImport(
			db,
			mapPatronRows(
				[["Marco", "Verdi", "1", "A", "0000001240"]],
				[...standardMapping("simple"), "cardNumber"],
				false,
				"students",
			),
			options({
				columns: [...standardMapping("simple"), "cardNumber"] as PatronImportColumn[],
				duplicatePolicy: "create",
			}),
		);
		expect(stolen.rows[0]?.reasons[0]?.code).toBe("cardNumberTaken");
	});

	it("an empty card cell keeps the card of the patron (bug: it cleared it)", () => {
		const { db, add } = seeded();
		const giulia = add("Giulia", "Rossi", "1", "A", { cardNumber: "0000001240" });
		const mapping: ColumnMapping = [...standardMapping("simple"), "cardNumber", "email"];
		const inputs = mapPatronRows(
			[["Giulia", "Rossi", "1", "A", "", ""]],
			mapping,
			false,
			"students",
		);
		const columns = mapping.filter((c): c is PatronImportColumn => c !== null);
		const result = validatePatronImport(db, inputs, options({ columns }));
		expect(result.rows[0]).toMatchObject({ status: "unchanged", matchId: giulia });
		expect(result.generatedCards).toBe(0);
	});

	it("applies the duplicate policy", () => {
		const { db, add } = seeded();
		add("Giulia", "Rossi", "1", "A");
		const inputs = simple([["Giulia", "Rossi", "2", "A"]]);
		expect(
			validatePatronImport(db, inputs, options({ duplicatePolicy: "skip" })).rows[0],
		).toMatchObject({
			status: "unchanged",
			reasons: [{ code: "skipped" }],
		});
		expect(
			validatePatronImport(db, inputs, options({ duplicatePolicy: "create" })).rows[0]
				?.status,
		).toBe("new");
	});

	it("teachers: their own import, the default group or a named one", () => {
		const { db, add } = seeded();
		const marco = add("Marco", "Verdi", "", "", { patronType: "teacher" });
		const { inputs, columns } = load("teachers.csv", "teachers");
		const result = validatePatronImport(db, inputs, options({ audience: "teachers", columns }));
		expect(result.rows[0]).toMatchObject({ status: "update", matchId: marco });
		expect(result.rows[0]?.changed).toEqual(["cardNumber"]);
		expect(result.rows[1]?.status).toBe("new");
		const unknown = validatePatronImport(
			db,
			mapPatronRows(
				[["Anna", "Blu", "Supplenti"]],
				["firstName", "lastName", "group"],
				false,
				"teachers",
			),
			options({ audience: "teachers", columns: ["firstName", "lastName", "group"] }),
		);
		expect(unknown.rows[0]?.reasons).toEqual([
			{ code: "teacherGroupUnknown", params: { value: "Supplenti", classes: "Docenti" } },
		]);
	});

	it("sync mode lists the missing patrons of the import's type and offers removal only with the permission", () => {
		const { db, add } = seeded();
		add("Giulia", "Rossi", "1", "A");
		const gone1 = add("Sara", "Neri", "2", "A");
		const gone2 = add("Paolo", "Gialli", "3", "C");
		const teacher = add("Marco", "Verdi", "", "", { patronType: "teacher" });
		const inputs = simple([["Giulia", "Rossi", "2", "A"]]);
		const sync = validatePatronImport(db, inputs, options({ mode: "sync" }));
		expect(sync.missing.map((m) => m.id).sort()).toEqual([gone1, gone2].sort());
		expect(sync.offerRemoval).toBe(true);
		const noPermission = validatePatronImport(
			db,
			inputs,
			options({ mode: "sync", canRemove: false }),
		);
		expect(noPermission.missing).toHaveLength(2);
		expect(noPermission.offerRemoval).toBe(false);
		expect(validatePatronImport(db, inputs, options()).missing).toEqual([]);
		// the teachers import synchronises the teachers only
		const teachers = validatePatronImport(
			db,
			mapPatronRows([["Anna", "Blu"]], standardMapping("names"), false, "teachers"),
			options({ audience: "teachers", mode: "sync", columns: ["firstName", "lastName"] }),
		);
		expect(teachers.missing.map((m) => m.id)).toEqual([teacher]);
	});
});

describe("commit", () => {
	const commitOptions = (
		db: ReturnType<typeof seeded>,
		over: Partial<PatronImportOptions> & { removeMissing?: boolean } = {},
	): CommitOptions => ({
		...options(over),
		actor: db.actor,
		filename: "students.csv",
		storeFile: (batchId: number) => `imports/${batchId}/students.csv`,
		removeMissing: over.removeMissing ?? false,
		dataDir: temp(),
	});

	it("creates, updates, assigns card numbers, records the batch, and is idempotent", () => {
		const s = seeded();
		s.add("Luca", "Bianchi", "2", "A");
		const { inputs } = load("students.csv");
		const summary = commitPatronImport(s.db, inputs, commitOptions(s));
		expect(summary).toMatchObject({
			created: 3,
			updated: 1,
			unchanged: 0,
			removed: 0,
			notRemoved: [],
		});
		expect(summary.createdIds).toHaveLength(3);
		const all = s.db.select().from(patron).all();
		expect(all).toHaveLength(4);
		expect(
			all.every((p) => p.cardNumber && recognise(p.cardNumber, TEST_CODES).kind === "card"),
		).toBe(true);
		expect(all.find((p) => p.lastName === "Bianchi")).toMatchObject({
			levelCode: "1",
			classGroupId: classId(s.db, "1", "A"),
		});
		const batch = s.db
			.select()
			.from(importBatch)
			.where(eq(importBatch.id, summary.batchId))
			.get();
		expect(batch).toMatchObject({
			kind: "patrons",
			mode: "upsert",
			storedPath: `imports/${summary.batchId}/students.csv`,
			byUserId: s.actor.id,
		});
		expect(batch?.finishedAt).toBeTruthy();
		expect(batch?.summary).toMatchObject({ created: 3, createdIds: summary.createdIds });

		const again = commitPatronImport(s.db, inputs, commitOptions(s));
		expect(again).toMatchObject({ created: 0, updated: 0, unchanged: 4 });
		expect(s.db.select().from(patron).all()).toHaveLength(4);
	});

	it("refuses a file with errors and rolls everything back", () => {
		const s = seeded();
		const { inputs } = load("errors.csv");
		expect(() => commitPatronImport(s.db, inputs, commitOptions(s))).toThrow(
			ImportNotReadyError,
		);
		expect(s.db.select().from(patron).all()).toHaveLength(0);
		expect(s.db.select().from(importBatch).all()).toHaveLength(0);
	});

	it("sync mode anonymizes the missing students on request, keeps those with open loans and every teacher", () => {
		const s = seeded();
		s.add("Giulia", "Rossi", "1", "A");
		const gone = s.add("Sara", "Neri", "2", "A");
		const borrowing = s.add("Paolo", "Gialli", "3", "C");
		const teacher = s.add("Marco", "Verdi", "", "", { patronType: "teacher" });
		const b = s.db
			.insert(biblio)
			.values({ title: "T", author: "A", publisher: "P", kind: "fiction" })
			.returning({ id: biblio.id })
			.get();
		const it1 = s.db
			.insert(item)
			.values({ biblioId: b.id, barcode: "2026-00011" })
			.returning({ id: item.id })
			.get();
		s.db
			.insert(loan)
			.values({
				itemId: it1.id,
				patronId: borrowing,
				dueDate: "2026-10-01",
				patronTypeSnapshot: "student",
				schoolYear: "2026/2027",
			})
			.run();
		const inputs = simple([["Giulia", "Rossi", "2", "A"]]);
		const summary = commitPatronImport(
			s.db,
			inputs,
			commitOptions(s, { mode: "sync", removeMissing: true }),
		);
		expect(summary).toMatchObject({ updated: 1, removed: 1, notRemoved: [borrowing] });
		const byId = (id: number): typeof patron.$inferSelect | undefined =>
			s.db.select().from(patron).where(eq(patron.id, id)).get();
		expect(byId(gone)).toMatchObject({
			status: "anonymized",
			firstName: "Studente",
			cardNumber: null,
		});
		expect(byId(borrowing)?.status).toBe("active");
		expect(byId(teacher)).toMatchObject({ status: "active", lastName: "Verdi" });

		// without the permission nothing is removed even when asked
		const s2 = seeded();
		const keep = s2.add("Sara", "Neri", "2", "A");
		commitPatronImport(
			s2.db,
			inputs,
			commitOptions(s2, { mode: "sync", removeMissing: true, canRemove: false }),
		);
		expect(s2.db.select().from(patron).where(eq(patron.id, keep)).get()?.status).toBe("active");
	});

	it("imports 1 000 rows in under 3 seconds", () => {
		const s = seeded();
		const rows = Array.from({ length: 1000 }, (_, i) => [
			`Nome${i}`,
			`Cognome${i}`,
			String((i % 5) + 1),
			["A", "B", "C"][i % 3] ?? "A",
		]);
		const inputs = simple(rows);
		const started = performance.now();
		const summary = commitPatronImport(s.db, inputs, commitOptions(s));
		expect(performance.now() - started).toBeLessThan(3000);
		expect(summary.created).toBe(1000);
		const again = validatePatronImport(s.db, inputs, options());
		expect(again.counts).toMatchObject({ unchanged: 1000, error: 0 });
	});
});
