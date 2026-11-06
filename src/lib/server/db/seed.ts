// SPDX-License-Identifier: GPL-3.0-or-later
// Deterministic synthetic data for development, demos and tests (PLAN.md step 1.2, Q38), generated
// from the choices of the installation (step 12.8): the classes of the school, its levels, the
// reading levels, the item types and the code formats. Never real people: faker with the locale of
// the school's country and a fixed seed.
import {
	fakerDE,
	fakerEN,
	fakerEN_GB,
	fakerEN_US,
	fakerES,
	fakerFR,
	fakerIT,
	fakerPL,
	type Faker,
} from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import { sequenceName } from "#lib/server/barcodes/counters.js";
import { generateCode } from "#lib/shared/barcodes/pattern.js";
import { DEFAULT_CODE_FORMATS } from "#lib/shared/barcodes/presets.js";
import { buildCodeTable, type CodeTable } from "#lib/shared/barcodes/table.js";
import { invertAuthorName } from "#lib/shared/author-name.js";
import { callNumberScheme, type CallNumberScheme } from "#lib/shared/classification.js";
import { refreshCallNumbers } from "#lib/server/services/call-numbers.js";
import { schoolYearFor } from "#lib/shared/school-year.js";
import { classLabel, levelOf, levelPosition, type SchoolStructure } from "#lib/shared/school.js";
import { normalizeSearchText } from "#lib/shared/text.js";
import type { Db } from "./client.js";
import {
	biblio,
	calendarEvent,
	classGroup,
	classGroupLevel,
	item,
	loan,
	loanEvent,
	note,
	patron,
	printList,
	printListEntry,
	staffUser,
	wish,
} from "./schema.js";
import { ensureAtLeast } from "./sequence.js";

export interface SeedOptions {
	seed?: number;
	patrons?: number;
	teachers?: number;
	biblios?: number;
	items?: number;
	loans?: number;
	/** "today" for due-date arithmetic, YYYY-MM-DD */
	today?: string;
	/** The structure of the school (default: an Italian primaria, levels `1`…`5`, `3 B`). */
	school?: SchoolStructure;
	/**
	 * The classes to make, in this order (a pluriclasse hosts several levels); default one per
	 * level of the school and name of `groupNames`.
	 */
	groups?: { name: string; levels: string[] }[];
	/** The names of the default classes (`A`…`D`: `1 A`, …, `5 D`). */
	groupNames?: string[];
	teacherGroupName?: string;
	/** The reading levels of fiction (default `1`…`5`; none: fiction without a level). */
	readingLevels?: string[];
	/** The item types of the configuration: the copies use `libro`, `dvd` and a not-for-loan one when they exist. */
	itemTypes?: { code: string; notForLoan: boolean }[];
	/** The country of the school (ISO code): the names of the patrons follow its language. */
	country?: string;
	genres?: string[];
	classCodes?: string[];
	/** The formats of the generated codes (the configuration's; the default formats otherwise). */
	codes?: CodeTable;
	/** The scheme of the segnatura and where the level is (the configuration's; the default otherwise). */
	callNumber?: CallNumberScheme;
	classPerItem?: boolean;
}

export interface SeedSummary {
	patrons: number;
	biblios: number;
	items: number;
	loans: number;
	openLoans: number;
	overdueLoans: number;
}

/** The primaria of the default configuration. */
export const DEFAULT_SEED_SCHOOL: SchoolStructure = {
	stages: [{ code: "primaria", name: "Primaria" }],
	levels: ["Prima", "Seconda", "Terza", "Quarta", "Quinta"].map((n, i) => ({
		code: String(i + 1),
		label: String(i + 1),
		name: `${n} primaria`,
		stage: "primaria",
	})),
	classLabel: "{level} {group}",
	groupWord: "Sezione",
	cardClass: "{word} {group}",
	promotion: { withinStage: "keep", acrossStages: "ask" },
};

const FAKERS: Readonly<Record<string, Faker>> = {
	IT: fakerIT,
	FR: fakerFR,
	DE: fakerDE,
	ES: fakerES,
	PL: fakerPL,
	GB: fakerEN_GB,
	US: fakerEN_US,
};

const DEFAULTS: Required<Omit<SeedOptions, "codes" | "groups">> = {
	seed: 20260919,
	patrons: 270,
	teachers: 30,
	biblios: 4000,
	items: 5000,
	loans: 4000,
	today: "2026-09-19",
	school: DEFAULT_SEED_SCHOOL,
	groupNames: ["A", "B", "C", "D"],
	teacherGroupName: "Docenti",
	readingLevels: ["1", "2", "3", "4", "5"],
	itemTypes: [
		{ code: "libro", notForLoan: false },
		{ code: "dvd", notForLoan: false },
	],
	country: "IT",
	callNumber: callNumberScheme("genreLevel", "author"),
	classPerItem: false,
	genres: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "L", "M", "N", "P", "R"],
	classCodes: [
		"001",
		"030",
		"292",
		"390",
		"510",
		"520",
		"560",
		"590",
		"610",
		"641",
		"702",
		"780",
		"796",
		"910",
		"920",
		"940",
		"MMM",
	],
};

function must<T>(value: T | undefined, what: string): T {
	if (value === undefined) {
		throw new Error(`seed: missing ${what}`);
	}
	return value;
}

function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/** Letters that lose no accent when normalised, written as in an address. */
const LETTERS: Record<string, string> = { ł: "l", đ: "d", ø: "o", ß: "ss", æ: "ae", œ: "oe" };

/**
 * The synthetic school address of a patron (step 9.22): `nome.cognome@<domain>` in lower case,
 * letters and digits only, a number added when the address is already taken.
 */
export function schoolEmail(
	firstName: string,
	lastName: string,
	domain: string,
	taken: Set<string>,
): string {
	const part = (name: string): string =>
		normalizeSearchText(name)
			.replace(/[łđøßæœ]/g, (c) => LETTERS[c] ?? "")
			.replace(/[^a-z0-9]/g, "");
	const base = `${part(firstName)}.${part(lastName)}`;
	let local = base;
	for (let n = 2; taken.has(local); n++) {
		local = `${base}${n}`;
	}
	taken.add(local);
	return `${local}@${domain}`;
}

/** Fills an empty database. Idempotent guard: refuses when patrons already exist. */
export function seedDatabase(db: Db, options: SeedOptions = {}): SeedSummary {
	const { codes = buildCodeTable(DEFAULT_CODE_FORMATS), groups, ...rest } = options;
	const o = { ...DEFAULTS, ...rest };
	const faker = FAKERS[o.country] ?? fakerEN;
	const school = o.school;
	// the default classes: one per level and name, level after level (`1 A`, `1 B`, …)
	const classes =
		groups ??
		school.levels.flatMap((l) => o.groupNames.map((name) => ({ name, levels: [l.code] })));
	// the materials: books and a few DVDs; reference works are books whose copies are not lent
	const types = o.itemTypes.map((t) => t.code);
	const bookType = types.includes("libro") ? "libro" : (types[0] ?? "libro");
	const dvdType = types.includes("dvd") ? "dvd" : bookType;
	const cardFormat = codes.card.current;
	const itemFormat = codes.item.current;
	const seedYear = Number(o.today.slice(0, 4));
	const existing = db.$client.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM patron").get();
	if (existing && existing.n > 0) {
		throw new Error("seed: the database already contains patrons");
	}
	faker.seed(o.seed);

	const summary: SeedSummary = {
		patrons: 0,
		biblios: 0,
		items: 0,
		loans: 0,
		openLoans: 0,
		overdueLoans: 0,
	};

	// the shared accounts of the configuration, when they already exist (notes and lists are theirs)
	const account = (username: string): number | null =>
		db
			.select({ id: staffUser.id })
			.from(staffUser)
			.where(eq(staffUser.username, username))
			.get()?.id ?? null;

	db.transaction(() => {
		// --- Classes (Phase 12): one per level and name, and the teachers group
		const stamp = `${o.today}T07:00:00.000Z`;
		// the places of the pupils: every (class, level) pair, by class name then level, so the
		// pupils spread over every class (`1 A`, `2 A`, …, `5 A`, `1 B`, …)
		const slots: { groupId: number; name: string; level: string }[] = [];
		const nameOrder: string[] = [];
		for (const g of classes) {
			const row = db
				.insert(classGroup)
				.values({ kind: "students", name: g.name, createdAt: stamp, updatedAt: stamp })
				.returning({ id: classGroup.id })
				.get();
			for (const level of g.levels) {
				db.insert(classGroupLevel).values({ groupId: row.id, levelCode: level }).run();
				slots.push({ groupId: row.id, name: g.name, level });
			}
			if (!nameOrder.includes(g.name)) {
				nameOrder.push(g.name);
			}
		}
		slots.sort(
			(a, b) =>
				nameOrder.indexOf(a.name) - nameOrder.indexOf(b.name) ||
				levelPosition(school, a.level) - levelPosition(school, b.level),
		);
		const teacherGroup = db
			.insert(classGroup)
			.values({
				kind: "teachers",
				name: o.teacherGroupName,
				createdAt: stamp,
				updatedAt: stamp,
			})
			.returning({ id: classGroup.id })
			.get().id;

		// --- Patrons: students (levels × classes) and teachers, cards in the configured format
		// (9.12, Phase 12); legacy numbers stay supported but are not seeded
		const patronIds: {
			id: number;
			type: "student" | "teacher";
			level: string | null;
			group: string | null;
			groupId: number | null;
		}[] = [];
		let newCounter = 0;
		const patronRows: (typeof patron.$inferInsert)[] = [];
		for (let i = 0; i < o.patrons; i++) {
			const slot = must(slots[i % slots.length], "class");
			const firstName = faker.person.firstName();
			const lastName = faker.person.lastName();
			const cardNumber = generateCode(cardFormat, { counter: ++newCounter, year: seedYear });
			patronRows.push({
				cardNumber,
				firstName,
				lastName,
				searchName: normalizeSearchText(`${lastName} ${firstName}`),
				patronType: "student",
				levelCode: slot.level,
				classGroupId: slot.groupId,
				status: "active",
			});
		}
		for (let i = 0; i < o.teachers; i++) {
			const firstName = faker.person.firstName();
			const lastName = faker.person.lastName();
			patronRows.push({
				cardNumber: generateCode(cardFormat, { counter: ++newCounter, year: seedYear }),
				firstName,
				lastName,
				searchName: normalizeSearchText(`${lastName} ${firstName}`),
				patronType: "teacher",
				classGroupId: teacherGroup,
			});
		}
		// the school's addresses, built from the names without faker calls (9.22), so the rest of
		// the synthetic data stays the same
		const emailDomain = o.country === "IT" ? "scuola.example" : "school.example";
		const emails = new Set<string>();
		for (const row of patronRows) {
			row.email = schoolEmail(row.firstName, row.lastName, emailDomain, emails);
		}
		patronRows.forEach((row, i) => {
			const r = must(
				db.insert(patron).values(row).returning({ id: patron.id }).all()[0],
				"patron id",
			);
			const slot = row.patronType === "student" ? slots[i % slots.length] : undefined;
			patronIds.push({
				id: r.id,
				type: row.patronType as "student" | "teacher",
				level: row.levelCode ?? null,
				group: slot ? slot.name : o.teacherGroupName,
				groupId: row.classGroupId ?? null,
			});
		});
		ensureAtLeast(db, sequenceName("card", cardFormat, seedYear), newCounter);
		summary.patrons = patronIds.length;

		// --- Biblios: 70 % fiction with a genre and a reading level, 30 % non-fiction with a class code
		const biblioIds: {
			id: number;
			kind: "fiction" | "nonfiction";
			genre: string | null;
			readingLevel: string | null;
			classCode: string | null;
			author: string;
			series: string | null;
			seriesNumber: number | null;
			itemType: string;
			/** A reference work: its copies are kept from loans. */
			reference: boolean;
		}[] = [];
		const usedIsbn = new Set<string>();
		// one fiction record in twenty belongs to an invented series, numbered in order; no faker
		// call, so the rest of the synthetic data stays the same as before the series existed
		const seriesNames = [
			"Le avventure di Pepe Lampo",
			"I misteri di Villa Aurora",
			"Capitan Scintilla",
			"Le cronache di Borgonebbia",
		];
		const seriesCount = new Map<string, number>();
		// a few translations with their original title (9.23), in place of the invented title and
		// author, still drawn so the rest of the synthetic data stays the same
		const translations = [
			["Il piccolo principe", "Le petit prince", "Saint-Exupéry, Antoine de"],
			["La fabbrica di cioccolato", "Charlie and the chocolate factory", "Dahl, Roald"],
			["Il giardino segreto", "The secret garden", "Burnett, Frances Hodgson"],
			["Piccole donne", "Little women", "Alcott, Louisa May"],
			["L'isola del tesoro", "Treasure island", "Stevenson, Robert Louis"],
			["Il richiamo della foresta", "The call of the wild", "London, Jack"],
			["Pippi Calzelunghe", "Pippi Långstrump", "Lindgren, Astrid"],
			["La storia infinita", "Die unendliche Geschichte", "Ende, Michael"],
		] as const;
		for (let i = 0; i < o.biblios; i++) {
			const fiction = i % 10 < 7;
			let isbn: string | null = faker.commerce.isbn({ variant: 13, separator: "" });
			if (usedIsbn.has(isbn) || i % 25 === 0) {
				isbn = null;
			} // some records without ISBN
			if (isbn) {
				usedIsbn.add(isbn);
			}
			const translation = fiction && i % 50 === 6 ? translations[(i / 50) | 0] : undefined;
			// stored as the catalogue writes it, "Surname, Name" (9.44)
			const drawnAuthor = invertAuthorName(faker.book.author());
			const author = translation?.[2] ?? drawnAuthor;
			const series =
				fiction && i % 20 === 3
					? seriesNames[((i / 20) % seriesNames.length) | 0]
					: undefined;
			const seriesNumber = series ? (seriesCount.get(series) ?? 0) + 1 : null;
			if (series && seriesNumber) {
				seriesCount.set(series, seriesNumber);
			}
			const drawnTitle = faker.book.title();
			const values: typeof biblio.$inferInsert = {
				title: translation?.[0] ?? drawnTitle,
				originalTitle: translation?.[1] ?? null,
				author,
				publisher: faker.book.publisher(),
				publicationPlace: i % 7 === 0 ? null : faker.location.city(),
				publicationYear: faker.number.int({ min: 1985, max: 2026 }),
				isbn,
				physicalDescription: `${faker.number.int({ min: 24, max: 480 })} p. : ill. ; ${faker.number.int({ min: 17, max: 30 })} cm`,
				series: series ?? null,
				seriesNumber: seriesNumber === null ? null : String(seriesNumber),
				kind: fiction ? "fiction" : "nonfiction",
				genreCode: fiction ? faker.helpers.arrayElement(o.genres) : null,
				readingLevel:
					fiction && o.readingLevels.length > 0
						? must(
								o.readingLevels[
									faker.number.int({ min: 0, max: o.readingLevels.length - 1 })
								],
								"reading level",
							)
						: null,
				classCode: fiction ? null : faker.helpers.arrayElement(o.classCodes),
				// the type is the record's (9.45): a few DVDs and reference books
				itemType: i % 40 === 5 ? dvdType : bookType,
				dewey: fiction
					? null
					: String(faker.number.int({ min: 1, max: 999 })).padStart(3, "0"),
				subjects: fiction ? [] : [faker.word.noun(), faker.word.noun()],
				source: "import",
			};
			const r = must(
				db.insert(biblio).values(values).returning({ id: biblio.id }).all()[0],
				"biblio id",
			);
			biblioIds.push({
				id: r.id,
				kind: values.kind as "fiction" | "nonfiction",
				genre: values.genreCode ?? null,
				readingLevel: values.readingLevel ?? null,
				classCode: values.classCode ?? null,
				author,
				series: series ?? null,
				seriesNumber,
				itemType: values.itemType ?? bookType,
				reference: i % 41 === 7,
			});
		}
		summary.biblios = biblioIds.length;

		// --- Items: at least one per biblio, extras on random titles; barcodes in the configured
		// format with the acquisition year (9.12, Phase 12)
		const itemIds: { id: number; biblioId: number; labelsPending: boolean }[] = [];
		// one counter per year when the pattern has a year, one for all otherwise
		const counters = new Map<number | null, number>();
		const pushItem = (
			b: (typeof biblioIds)[number],
			index: number,
			readingLevelOverride?: string,
		): void => {
			const year = 2019 + (index % 8);
			const key = itemFormat.year ? year : null;
			const n = (counters.get(key) ?? 0) + 1;
			counters.set(key, n);
			const barcode = generateCode(itemFormat, { counter: n, year });
			// a few recent copies still wait for their labels
			const labelsPending = year === 2026 && index % 5 === 0;
			const r = must(
				db
					.insert(item)
					.values({
						biblioId: b.id,
						barcode,
						notForLoan: b.reference ? 1 : 0,
						readingLevel: readingLevelOverride ?? null,
						status:
							index % 97 === 0 ? "lost" : index % 89 === 0 ? "damaged" : "available",
						acquisitionDate: `${year}-${String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0")}-15`,
						barcodeLabelPrintedAt: labelsPending ? null : "2026-01-10T10:00:00Z",
						spineLabelPrintedAt: labelsPending ? null : "2026-01-10T10:00:00Z",
					})
					.returning({ id: item.id })
					.all()[0],
				"item id",
			);
			itemIds.push({ id: r.id, biblioId: b.id, labelsPending });
		};
		let index = 0;
		for (const b of biblioIds) {
			pushItem(b, index++);
		}
		while (itemIds.length < o.items) {
			const b = faker.helpers.arrayElement(biblioIds);
			// a few titles have copies in two different class shelves (classPerItem question, Q72)
			const override =
				b.kind === "fiction" && index % 50 === 0 && o.readingLevels.length > 0
					? must(
							o.readingLevels[
								(o.readingLevels.indexOf(b.readingLevel ?? "") + 1) %
									o.readingLevels.length
							],
							"reading level",
						)
					: undefined;
			pushItem(b, index++, override);
		}
		// the segnatura computed from the scheme, as the server does after every change (Q143)
		refreshCallNumbers(db, { callNumber: o.callNumber, classPerItem: o.classPerItem }, "all");
		for (const [year, n] of counters) {
			ensureAtLeast(db, sequenceName("item", itemFormat, year), n);
		}
		summary.items = itemIds.length;

		// --- Loans across two school years: most returned, some open, some overdue (> 5 days)
		const students = patronIds.filter((p) => p.type === "student");
		const loanable = itemIds.filter((_, i) => i % 41 !== 0 && i % 97 !== 0);
		const openItems = new Set<number>();
		const openByPatron = new Map<number, number>();
		type SeedPatron = (typeof patronIds)[number];
		type SeedItem = (typeof loanable)[number];
		/** One loan with its snapshots and events (`at`: the issue's time, ISO). */
		const addLoan = (
			p: SeedPatron,
			it: SeedItem,
			at: string,
			dueDate: string,
			returnedAt: string | null,
			renewals: number,
		): number => {
			const issuedDate = at.slice(0, 10);
			const l = must(
				db
					.insert(loan)
					.values({
						itemId: it.id,
						patronId: p.id,
						issuedAt: at,
						dueDate,
						returnedAt,
						renewals,
						patronTypeSnapshot: p.type,
						levelSnapshot: p.level,
						levelPositionSnapshot:
							p.level === null ? null : levelPosition(school, p.level),
						stageSnapshot: levelOf(school, p.level)?.stage ?? null,
						groupIdSnapshot: p.groupId,
						groupSnapshot: p.group,
						classLabelSnapshot:
							p.group === null
								? null
								: classLabel(
										school,
										{
											name: p.group,
											kind: p.type === "student" ? "students" : "teachers",
										},
										p.level,
									),
						schoolYear: schoolYearFor(issuedDate),
					})
					.returning({ id: loan.id })
					.all()[0],
				"loan id",
			);
			db.insert(loanEvent).values({ loanId: l.id, type: "issue", at }).run();
			if (returnedAt) {
				db.insert(loanEvent).values({ loanId: l.id, type: "return", at: returnedAt }).run();
			}
			return l.id;
		};
		const openOnTime: { loanId: number; itemId: number; patronId: number }[] = [];
		for (let i = 0; i < o.loans; i++) {
			const p =
				i % 9 === 0
					? faker.helpers.arrayElement(patronIds.filter((x) => x.type === "teacher"))
					: faker.helpers.arrayElement(students);
			const it = faker.helpers.arrayElement(loanable);
			const inPast = i < o.loans * 0.9; // 90 % returned
			const issued = inPast
				? faker.date.between({ from: "2025-09-15", to: addDays(o.today, -20) })
				: faker.date.between({ from: addDays(o.today, -40), to: o.today });
			const issuedDate = issued.toISOString().slice(0, 10);
			const loanDays = p.type === "teacher" ? 15 : 15;
			const dueDate = addDays(issuedDate, loanDays);
			let returnedAt: string | null = null;
			if (inPast) {
				returnedAt = `${addDays(issuedDate, faker.number.int({ min: 1, max: 22 }))}T11:00:00Z`;
			} else {
				if (openItems.has(it.id)) {
					continue;
				}
				const max = p.type === "teacher" ? 4 : 1;
				if ((openByPatron.get(p.id) ?? 0) >= max) {
					continue;
				}
				openItems.add(it.id);
				openByPatron.set(p.id, (openByPatron.get(p.id) ?? 0) + 1);
			}
			const loanId = addLoan(
				p,
				it,
				`${issuedDate}T09:30:00Z`,
				dueDate,
				returnedAt,
				i % 11 === 0 ? 1 : 0,
			);
			if (!returnedAt && dueDate >= o.today && issuedDate < o.today) {
				openOnTime.push({ loanId, itemId: it.id, patronId: p.id });
			}
			summary.loans++;
			if (!returnedAt) {
				summary.openLoans++;
				if (dueDate < addDays(o.today, -5)) {
					summary.overdueLoans++;
				}
			}
		}

		// --- Today at the desk: a few loans and returns made this morning, so the dashboard's
		// tiles and today's activity are not empty when the demo opens (picked by position, no
		// faker call, so the rest of the data stays as it was)
		const idle = students.filter((p) => !openByPatron.has(p.id));
		const free = loanable.filter((it) => !openItems.has(it.id));
		const TODAY_LOANS = 6;
		for (let k = 0; k < TODAY_LOANS && k < idle.length && k < free.length; k++) {
			const p = idle[(k * 37) % idle.length];
			// from the end of the catalogue: the first copies are the ones the tests pick
			const it = free[free.length - 1 - ((k * 53) % free.length)];
			if (!p || !it || openItems.has(it.id) || openByPatron.has(p.id)) {
				continue;
			}
			const time = `${String(7 + Math.floor(k / 2)).padStart(2, "0")}:${k % 2 === 0 ? "10" : "40"}:00Z`;
			addLoan(p, it, `${o.today}T${time}`, addDays(o.today, 15), null, 0);
			openItems.add(it.id);
			openByPatron.set(p.id, 1);
			summary.loans++;
			summary.openLoans++;
		}
		const TODAY_RETURNS = 4;
		for (const r of openOnTime.slice(0, TODAY_RETURNS)) {
			const at = `${o.today}T${String(7 + openOnTime.indexOf(r)).padStart(2, "0")}:25:00Z`;
			db.update(loan).set({ returnedAt: at }).where(eq(loan.id, r.loanId)).run();
			db.insert(loanEvent).values({ loanId: r.loanId, type: "return", at }).run();
			openItems.delete(r.itemId);
			summary.openLoans--;
		}

		// --- Print lists (step 2.8, 3.8): three of patrons and two of copies, so the lists, the
		// basket and printing from a list can be tried at once; picked by position, no faker call.
		// Each one prints within the public demo's cap of sheets (9.13, round 24): at most 15 cards
		// (five a sheet side by side) and 27 pairs of labels (nine a sheet)
		const lists: {
			kind: "patrons" | "items";
			name: string;
			by: string;
			ids: number[];
			daysAgo: number;
			printed?: boolean;
		}[] = [
			{
				kind: "patrons",
				name: "Tessere da ristampare",
				by: "tessere",
				ids: students
					.filter((_, i) => i % 31 === 7)
					.slice(0, 8)
					.map((p) => p.id),
				daysAgo: 6,
			},
			{
				kind: "patrons",
				name: "Gruppo di lettura",
				by: "prestiti",
				ids: students
					.filter((_, i) => i % 19 === 4)
					.slice(0, 12)
					.map((p) => p.id),
				daysAgo: 12,
				printed: true,
			},
			{
				kind: "patrons",
				name: "Tessere dei docenti",
				by: "tessere",
				ids: patronIds
					.filter((p) => p.type === "teacher")
					.slice(0, 10)
					.map((p) => p.id),
				daysAgo: 20,
				printed: true,
			},
			{
				kind: "items",
				name: "Etichette nuovi arrivi",
				by: "catalogo",
				ids: itemIds
					.filter((it) => it.labelsPending)
					.slice(0, 15)
					.map((it) => it.id),
				daysAgo: 3,
			},
			{
				kind: "items",
				name: `Serie «${must(seriesNames[0], "series")}»`,
				by: "catalogo",
				ids: biblioIds
					.filter((b) => b.series === seriesNames[0])
					.sort((a, b) => (a.seriesNumber ?? 0) - (b.seriesNumber ?? 0))
					.flatMap((b) => itemIds.filter((it) => it.biblioId === b.id).slice(0, 1))
					.slice(0, 24)
					.map((it) => it.id),
				daysAgo: 9,
				printed: true,
			},
		];
		for (const l of lists) {
			if (l.ids.length === 0) {
				continue;
			}
			const when = `${addDays(o.today, -l.daysAgo)}T08:00:00.000Z`;
			const id = db
				.insert(printList)
				.values({
					kind: l.kind,
					name: l.name,
					createdBy: account(l.by),
					lastPrintedAt: l.printed
						? `${addDays(o.today, -l.daysAgo + 1)}T10:30:00.000Z`
						: null,
					createdAt: when,
					updatedAt: when,
				})
				.returning({ id: printList.id })
				.get().id;
			db.insert(printListEntry)
				.values(
					l.ids.map((entityId, i) => ({
						listId: id,
						entityId,
						position: i + 1,
						addedAt: when,
					})),
				)
				.run();
		}
	});

	// a few invented wishes (step 9.15), without requesters and without faker calls (the rest of
	// the synthetic data stays the same)
	db.insert(wish)
		.values([
			{ title: "Il mistero del faro spento", author: "Neri, Carla", requests: 3 },
			{ series: "Le avventure di Pepe Lampo", seriesNumber: "12", requests: 2 },
			{ title: "Atlante dei draghi", note: "Edizione illustrata" },
			{ author: "Bianchi, Marco", note: "Qualunque romanzo per ragazzi" },
			{
				title: "Capitan Scintilla e la luna",
				series: "Capitan Scintilla",
				seriesNumber: "7",
			},
			{ title: "Piccola guida agli insetti", author: "Verdi, Elena", requests: 4 },
		])
		.run();

	// a few invented staff notes (step 9.18), one pinned to the dashboard and one archived, written
	// by the shared accounts when they already exist
	const desk = account("prestiti");
	const admin = account("admin");
	const at = (days: number, time: string): string => `${addDays(o.today, -days)}T${time}.000Z`;
	db.insert(note)
		.values([
			{
				body: "Venerdì la biblioteca chiude alle 12: riunione del collegio docenti.",
				color: "orange",
				pinned: 1,
				createdBy: admin,
				createdAt: at(1, "07:40:00"),
			},
			{
				body: "Lo scanner del banco a volte non legge le tessere vecchie: provare a inclinarle.",
				createdBy: desk,
				createdAt: at(2, "10:15:00"),
			},
			{
				body: "Trovata una copia con la copertina strappata sullo scaffale dei gialli.\nL'ho messa sulla scrivania.",
				color: "pink",
				createdBy: desk,
				createdAt: at(3, "11:05:00"),
			},
			{
				body: "Il toner della stampante delle etichette sta finendo.",
				color: "blue",
				createdBy: account("catalogo"),
				createdAt: at(4, "09:30:00"),
			},
			{
				body: "Sostituite le batterie del lettore di codici.",
				color: "green",
				createdBy: desk,
				createdAt: at(9, "08:20:00"),
				archivedAt: at(8, "13:00:00"),
				archivedBy: admin,
			},
		])
		.run();

	// a few notable dates of the calendar (step 9.25), around the seed's today and without faker
	// calls; the World Book Day of the school year (23 April)
	const bookDayYear = Number(o.today.slice(0, 4)) + (Number(o.today.slice(5, 7)) >= 9 ? 1 : 0);
	db.insert(calendarEvent)
		.values([
			{
				title: "Lettura in classe: «Il piccolo principe»",
				notes: "Classi terze, in biblioteca alle 10.",
				startsOn: addDays(o.today, 3),
				createdBy: desk,
				updatedBy: desk,
			},
			{
				title: "Concorso del segnalibro: consegna dei disegni",
				startsOn: addDays(o.today, 12),
				createdBy: desk,
				updatedBy: desk,
			},
			{
				title: "Incontro con l'autore",
				notes: "Aula magna, classi quarte e quinte.",
				startsOn: addDays(o.today, 20),
				createdBy: admin,
				updatedBy: admin,
			},
			{
				title: "Mostra del libro",
				startsOn: addDays(o.today, 25),
				endsOn: addDays(o.today, 29),
				createdBy: admin,
				updatedBy: admin,
			},
			{
				title: "Concorso del segnalibro: premiazione",
				startsOn: addDays(o.today, 40),
				createdBy: desk,
				updatedBy: desk,
			},
			{
				title: "Giornata mondiale del libro",
				startsOn: `${String(bookDayYear)}-04-23`,
				createdBy: admin,
				updatedBy: admin,
			},
		])
		.run();

	db.run(sql`INSERT INTO biblio_fts(biblio_fts) VALUES ('rebuild')`);
	return summary;
}
