// SPDX-License-Identifier: GPL-3.0-or-later
// Patrons (PLAN.md step 2.1, Phase 12): validation with the configured levels and the classes of the
// database (groups), search by
// normalised name prefix, create/update. Card numbers are assigned in step 2.2. The search is in
// `patron-search.ts`, the census in `patron-census.ts`, the loan history in `loan-lists.ts`.
import { NotFoundError } from "#lib/server/errors.js";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import {
	biblio,
	classGroup,
	classGroupLevel,
	item,
	loan,
	loanEvent,
	patron,
	patronClass,
} from "#lib/server/db/schema.js";
import type { PatronFormInput, PatronType } from "#lib/shared/patron-schema.js";
import { blankToNull, normalizeSearchText } from "#lib/shared/text.js";
import { nextCardNumber, type CardCounterStart } from "#lib/server/barcodes/cards.js";
import { schoolOf } from "#lib/server/school/structure.js";
import { type GroupKind, type SchoolStructure } from "#lib/shared/school.js";
import { defaultTeacherGroup } from "./class-groups.js";
import { isCopyBarcode } from "#lib/server/barcodes/guard.js";
import { codeTable } from "#lib/server/barcodes/table.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { CodeTable } from "#lib/shared/barcodes/table.js";
import { normalizeScan, recognise } from "#lib/shared/scan.js";
import { demoPatron, demoText } from "#lib/server/demo/content.js";
import { audit, type AuditActor } from "./audit.js";
import { libraryYear } from "./calendar.js";

export interface PatronRules {
	/** The levels of the school (the classes are groups of the database, Phase 12). */
	school: SchoolStructure;
	/** The teachers group a teacher joins when none is chosen (made if missing, Q102). */
	teacherGroupName: string;
	/** The format table: new card numbers, and typed ones checked against it (Phase 12). */
	codes: CodeTable;
	/** `barcodes.patron.counterStart`; a new patron without a card number gets the next one. */
	cardCounterStart: CardCounterStart;
	/** The library's current year (card patterns with a year). */
	year: number;
}

/** The rules of the configuration (the year in the library's time zone). */
export function patronRules(config: AppConfig, now = new Date()): PatronRules {
	return {
		school: schoolOf(config),
		teacherGroupName: config.school.teacherGroupName,
		codes: codeTable(config),
		cardCounterStart: config.barcodes.patron.counterStart,
		year: libraryYear(config, now),
	};
}

export type PatronIssueCode =
	| "levelRequired"
	| "levelUnknown"
	| "levelNotForTeachers"
	| "groupRequired"
	| "groupUnknown"
	| "levelNotInGroup"
	| "emailInvalid"
	| "cardNumberInvalid"
	| "cardNumberTaken"
	| "cardNumberIsCopy"
	| "externalIdTaken";

export interface PatronIssue {
	field: keyof PatronFormInput;
	code: PatronIssueCode;
}

export class PatronValidationError extends Error {
	constructor(readonly issues: PatronIssue[]) {
		super(`invalid patron: ${issues.map((i) => `${i.field}:${i.code}`).join(", ")}`);
		this.name = "PatronValidationError";
	}
}

export class PatronNotFoundError extends NotFoundError {
	constructor(readonly id: number) {
		super("patron", `patron ${id} not found`);
		this.name = "PatronNotFoundError";
	}
}

export interface PatronData {
	patronType: PatronType;
	firstName: string;
	lastName: string;
	classGroupId: number | null;
	levelCode: string | null;
	cardNumber: string | null;
	externalId: string | null;
	email: string | null;
	circulationNote: string | null;
	notes: string | null;
}

export function searchNameOf(lastName: string, firstName: string): string {
	return normalizeSearchText(`${lastName} ${firstName}`);
}

/** The active group an input names: by id, or by name (and level, for a class). */
function groupOfInput(
	db: DbOrTx,
	input: PatronFormInput,
	kind: GroupKind,
	levelCode: string | null,
): { id: number; levels: string[] } | null | "unknown" {
	const conditions = [eq(classGroup.kind, kind), isNull(classGroup.archivedAt)];
	let rows: { id: number }[];
	if (input.groupId !== "") {
		rows = db
			.select({ id: classGroup.id })
			.from(classGroup)
			.where(and(...conditions, eq(classGroup.id, Number(input.groupId))))
			.all();
	} else if (input.groupName.trim() !== "") {
		rows = db
			.select({ id: classGroup.id })
			.from(classGroup)
			.where(
				and(
					...conditions,
					sql`lower(${classGroup.name}) = lower(${input.groupName.trim()})`,
					levelCode === null
						? undefined
						: sql`exists (select 1 from class_group_level gl where gl.group_id = ${classGroup.id} and gl.level_code = ${levelCode})`,
				),
			)
			.all();
	} else {
		return null;
	}
	const found = rows[0];
	if (!found || rows.length > 1) {
		return "unknown";
	}
	const levels = db
		.select({ code: classGroupLevel.levelCode })
		.from(classGroupLevel)
		.where(eq(classGroupLevel.groupId, found.id))
		.all()
		.map((r) => r.code);
	return { id: found.id, levels };
}

/**
 * Applies the rules of §3.5 with the classes of Phase 12: a student needs a class (a students
 * group, by id or by name) and a level among its levels — taken from the class when it hosts one
 * only —; a teacher has no level and may name a teachers group (the default one otherwise).
 */
export function validatePatron(db: DbOrTx, input: PatronFormInput, rules: PatronRules): PatronData {
	const issues: PatronIssue[] = [];
	let levelCode = blankToNull(input.levelCode);
	let classGroupId: number | null = null;
	if (input.patronType === "student") {
		if (levelCode !== null && !rules.school.levels.some((l) => l.code === levelCode)) {
			issues.push({ field: "levelCode", code: "levelUnknown" });
		}
		const group = groupOfInput(db, input, "students", levelCode);
		if (group === null) {
			issues.push({ field: "groupId", code: "groupRequired" });
		} else if (group === "unknown") {
			issues.push({ field: "groupId", code: "groupUnknown" });
		} else {
			classGroupId = group.id;
			if (levelCode === null && group.levels.length === 1) {
				levelCode = group.levels[0] ?? null;
			}
			if (levelCode === null) {
				issues.push({ field: "levelCode", code: "levelRequired" });
			} else if (!group.levels.includes(levelCode)) {
				issues.push({ field: "levelCode", code: "levelNotInGroup" });
			}
		}
	} else {
		if (levelCode !== null) {
			issues.push({ field: "levelCode", code: "levelNotForTeachers" });
		}
		const group = groupOfInput(db, input, "teachers", null);
		if (group === "unknown") {
			issues.push({ field: "groupId", code: "groupUnknown" });
		} else {
			classGroupId = group?.id ?? null;
		}
	}
	const email = blankToNull(input.email);
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		issues.push({ field: "email", code: "emailInvalid" });
	}
	const typed = blankToNull(input.cardNumber);
	const cardNumber = typed === null ? null : normalizeScan(typed, rules.codes);
	if (cardNumber) {
		const kind = recognise(cardNumber, rules.codes);
		if (!/^[0-9A-Z-]{1,20}$/.test(cardNumber) || kind.reason === "card_check_digit") {
			issues.push({ field: "cardNumber", code: "cardNumberInvalid" });
		} else if (
			kind.kind === "item" ||
			kind.kind === "legacy_item" ||
			kind.kind === "isbn" ||
			kind.reason === "item_check_digit"
		) {
			// never a code that reads as a copy (the rule of Q90)
			issues.push({ field: "cardNumber", code: "cardNumberIsCopy" });
		}
	}
	if (issues.length > 0) {
		throw new PatronValidationError(issues);
	}
	return {
		patronType: input.patronType,
		firstName: input.firstName.trim(),
		lastName: input.lastName.trim(),
		classGroupId,
		levelCode,
		cardNumber,
		externalId: blankToNull(input.externalId),
		email,
		circulationNote: blankToNull(input.circulationNote),
		notes: blankToNull(input.notes),
	};
}

function assertUnique(db: DbOrTx, data: PatronData, exceptId?: number): void {
	const issues: PatronIssue[] = [];
	const clash = (column: typeof patron.cardNumber, value: string): { id: number } | undefined =>
		db
			.select({ id: patron.id })
			.from(patron)
			.where(
				and(
					eq(column, value),
					exceptId === undefined ? undefined : ne(patron.id, exceptId),
				),
			)
			.get();
	if (data.cardNumber && clash(patron.cardNumber, data.cardNumber)) {
		issues.push({ field: "cardNumber", code: "cardNumberTaken" });
	} else if (data.cardNumber && isCopyBarcode(db, data.cardNumber)) {
		issues.push({ field: "cardNumber", code: "cardNumberIsCopy" });
	}
	if (data.externalId && clash(patron.externalId, data.externalId)) {
		issues.push({ field: "externalId", code: "externalIdTaken" });
	}
	if (issues.length > 0) {
		throw new PatronValidationError(issues);
	}
}

export function createPatron(
	db: Db,
	input: PatronFormInput,
	actor: AuditActor,
	rules: PatronRules,
): number {
	// the public demo stores fake names and no contacts (Q121); the import commit (the demo's
	// example file only) goes through insertPatron
	return db.transaction((tx) =>
		insertPatron(tx, validatePatron(tx, demoPatron(input), rules), actor, rules),
	);
}

/** Inserts validated data inside the caller's transaction (also used by the import commit). */
export function insertPatron(
	tx: DbOrTx,
	data: PatronData,
	actor: AuditActor,
	rules: PatronRules,
	now = new Date(),
): number {
	assertUnique(tx, data);
	const classGroupId =
		data.patronType === "teacher" && data.classGroupId === null
			? defaultTeacherGroup(tx, rules.teacherGroupName, now)
			: data.classGroupId;
	const cardNumber =
		data.cardNumber ?? nextCardNumber(tx, rules.codes, rules.cardCounterStart, rules.year);
	const row = tx
		.insert(patron)
		.values({
			...data,
			classGroupId,
			cardNumber,
			searchName: searchNameOf(data.lastName, data.firstName),
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
		})
		.returning({ id: patron.id })
		.get();
	audit(
		tx,
		actor,
		"patron.create",
		"patron",
		row.id,
		{
			patronType: data.patronType,
			group: classGroupId,
			level: data.levelCode,
			cardAssigned: data.cardNumber === null,
		},
		now,
	);
	return row.id;
}

const TRACKED: (keyof PatronData)[] = [
	"patronType",
	"firstName",
	"lastName",
	"classGroupId",
	"levelCode",
	"cardNumber",
	"externalId",
	"email",
	"circulationNote",
	"notes",
];

/** Updates the patron and records which fields changed (never their values). */
export function updatePatron(
	db: Db,
	id: number,
	input: PatronFormInput,
	actor: AuditActor,
	rules: PatronRules,
): string[] {
	return db.transaction((tx) => {
		const stored = tx.select().from(patron).where(eq(patron.id, id)).get();
		const data = validatePatron(tx, demoPatron(input, stored), rules);
		if (data.patronType === "teacher" && data.classGroupId === null) {
			// a teacher keeps the teachers group they have, or joins the default one
			const current = tx
				.select({ id: classGroup.id, kind: classGroup.kind })
				.from(patron)
				.innerJoin(classGroup, eq(classGroup.id, patron.classGroupId))
				.where(eq(patron.id, id))
				.get();
			data.classGroupId =
				current?.kind === "teachers"
					? current.id
					: defaultTeacherGroup(tx, rules.teacherGroupName);
		}
		return applyPatronUpdate(tx, id, data, actor);
	});
}

/** Fields that differ between a stored patron and new data (null and '' are the same). */
export function changedPatronFields(
	existing: Partial<Record<keyof PatronData, unknown>>,
	data: Partial<PatronData>,
): (keyof PatronData)[] {
	return TRACKED.filter((k) => k in data && (existing[k] ?? null) !== (data[k] ?? null));
}

/**
 * Writes the given fields (a partial update leaves the others alone) inside the caller's
 * transaction and audits which fields changed, never their values.
 */
export function applyPatronUpdate(
	tx: DbOrTx,
	id: number,
	data: Partial<PatronData>,
	actor: AuditActor,
	now = new Date(),
): string[] {
	const existing = tx.select().from(patron).where(eq(patron.id, id)).get();
	if (!existing) {
		throw new PatronNotFoundError(id);
	}
	const merged: PatronData = {
		patronType: (data.patronType ?? existing.patronType) as PatronType,
		firstName: data.firstName ?? existing.firstName,
		lastName: data.lastName ?? existing.lastName,
		classGroupId: "classGroupId" in data ? (data.classGroupId ?? null) : existing.classGroupId,
		levelCode: "levelCode" in data ? (data.levelCode ?? null) : existing.levelCode,
		cardNumber: "cardNumber" in data ? (data.cardNumber ?? null) : existing.cardNumber,
		externalId: "externalId" in data ? (data.externalId ?? null) : existing.externalId,
		email: "email" in data ? (data.email ?? null) : existing.email,
		circulationNote:
			"circulationNote" in data ? (data.circulationNote ?? null) : existing.circulationNote,
		notes: "notes" in data ? (data.notes ?? null) : existing.notes,
	};
	assertUnique(tx, merged, id);
	const changed = changedPatronFields(existing, merged);
	if (changed.length === 0) {
		return [];
	}
	tx.update(patron)
		.set({
			...merged,
			searchName: searchNameOf(merged.lastName, merged.firstName),
			updatedAt: now.toISOString(),
		})
		.where(eq(patron.id, id))
		.run();
	audit(tx, actor, "patron.update", "patron", id, { changed }, now);
	return changed;
}

/**
 * "Riassegna tessera": a new number from the sequence; the old one is retired for good (the
 * counter never goes back) and `card_printed_at` is cleared so the new card gets printed.
 */
export function reassignCard(db: Db, id: number, actor: AuditActor, rules: PatronRules): string {
	return db.transaction((tx) => {
		const existing = tx
			.select({ status: patron.status })
			.from(patron)
			.where(eq(patron.id, id))
			.get();
		if (!existing) {
			throw new PatronNotFoundError(id);
		}
		if (existing.status === "anonymized") {
			throw new PatronValidationError([]);
		}
		const cardNumber = nextCardNumber(tx, rules.codes, rules.cardCounterStart, rules.year);
		tx.update(patron)
			.set({ cardNumber, cardPrintedAt: null, updatedAt: new Date().toISOString() })
			.where(eq(patron.id, id))
			.run();
		audit(tx, actor, "patron.reassign_card", "patron", id);
		return cardNumber;
	});
}

export interface PatronOpenLoan {
	loanId: number;
	itemId: number;
	barcode: string;
	title: string;
	author: string;
	issuedAt: string;
	dueDate: string;
	renewals: number;
	overdue: boolean;
}

export interface PatronDetail {
	id: number;
	cardNumber: string | null;
	externalId: string | null;
	firstName: string;
	lastName: string;
	patronType: PatronType;
	classLabel: string;
	levelCode: string | null;
	groupId: number | null;
	email: string | null;
	hasPhoto: boolean;
	cardPrintedAt: string | null;
	status: "active" | "anonymized";
	circulationNote: string | null;
	notes: string | null;
	anonymizedAt: string | null;
	createdAt: string;
	updatedAt: string;
	openLoans: PatronOpenLoan[];
	/** Copies marked lost during one of the patron's loans and still lost (Q42, step 4.8). */
	lostItems: { loanId: number; itemId: number; barcode: string; title: string; lostAt: string }[];
	totalLoans: number;
}

export function getPatron(
	db: Db,
	id: number,
	/** Today in the library's time zone (`libraryToday`): decides which loans are overdue. */
	today: string,
): PatronDetail {
	const row = db.select().from(patron).where(eq(patron.id, id)).get();
	if (!row) {
		throw new PatronNotFoundError(id);
	}
	const openLoans = db
		.select({
			loanId: loan.id,
			itemId: item.id,
			barcode: item.barcode,
			title: biblio.title,
			author: biblio.author,
			issuedAt: loan.issuedAt,
			dueDate: loan.dueDate,
			renewals: loan.renewals,
		})
		.from(loan)
		.innerJoin(item, eq(item.id, loan.itemId))
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(and(eq(loan.patronId, id), sql`${loan.returnedAt} is null`))
		.orderBy(asc(loan.dueDate))
		.all()
		.map((l) => ({ ...l, overdue: l.dueDate < today }));
	const lostItems = db
		.select({
			loanId: loan.id,
			itemId: item.id,
			barcode: item.barcode,
			title: biblio.title,
			lostAt: loanEvent.at,
		})
		.from(loanEvent)
		.innerJoin(loan, eq(loan.id, loanEvent.loanId))
		.innerJoin(item, eq(item.id, loan.itemId))
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(and(eq(loan.patronId, id), eq(loanEvent.type, "lost"), eq(item.status, "lost")))
		.orderBy(desc(loanEvent.at))
		.all();
	const totalLoans =
		db
			.select({ n: sql<number>`count(*)` })
			.from(loan)
			.where(eq(loan.patronId, id))
			.get()?.n ?? 0;
	const { photoPath, searchName: _searchName, classGroupId, ...rest } = row;
	const label =
		db
			.select({ label: patronClass.classLabel })
			.from(patronClass)
			.where(eq(patronClass.patronId, id))
			.get()?.label ?? "";
	return {
		...rest,
		groupId: classGroupId,
		classLabel: label,
		patronType: rest.patronType as PatronType,
		status: rest.status as PatronDetail["status"],
		hasPhoto: photoPath !== null,
		openLoans,
		lostItems,
		totalLoans,
	};
}

/** Edits the two free-text notes (the circulation note is shown at the desk). */
export function updatePatronNotes(
	db: Db,
	id: number,
	notes: { circulationNote: string; notes: string },
	actor: AuditActor,
): string[] {
	return db.transaction((tx) => {
		const stored = tx
			.select({ circulationNote: patron.circulationNote, notes: patron.notes })
			.from(patron)
			.where(eq(patron.id, id))
			.get();
		return applyPatronUpdate(
			tx,
			id,
			{
				circulationNote: blankToNull(
					demoText("comment", notes.circulationNote, stored?.circulationNote),
				),
				notes: blankToNull(demoText("comment", notes.notes, stored?.notes)),
			},
			actor,
		);
	});
}
