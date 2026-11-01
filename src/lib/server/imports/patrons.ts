// SPDX-License-Identifier: GPL-3.0-or-later
// Student and teacher imports (PLAN.md steps 2.6, 9.19; Q31, Q76, Q115): two imports, one per
// patron type, with the English columns of `#lib/shared/import-columns.ts` (the class of a student
// in one column `class` or in `level` + `section`, the group of a teacher); format detection,
// column mapping, the validate phase (pure over a snapshot of the patrons) and the commit phase
// (one transaction, `import_batch` row) of the pipeline in §3.22.
import { eq, ne } from "drizzle-orm";
import { isCopyBarcode } from "#lib/server/barcodes/guard.js";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { patron, patronClass } from "#lib/server/db/schema.js";
import {
	STUDENT_IMPORT,
	TEACHER_IMPORT,
	type ImportSpec,
	type StudentField,
	type TeacherField,
} from "#lib/shared/import-columns.js";
import {
	classLabel,
	classLabels,
	findClass,
	findLevel,
	type ClassGroupInfo,
} from "#lib/shared/school.js";
import {
	patronFormSchema,
	type PatronFormInput,
	type PatronType,
} from "#lib/shared/patron-schema.js";
import { maxLengths } from "#lib/shared/text-limits.js";
import {
	anonymizePatron,
	coverRemovedFaces,
	openLoanCount,
} from "#lib/server/services/anonymize.js";
import type { AuditActor } from "#lib/server/services/audit.js";
import { groupsById } from "#lib/server/services/class-groups.js";
import {
	applyPatronUpdate,
	changedPatronFields,
	insertPatron,
	PatronValidationError,
	searchNameOf,
	validatePatron,
	type PatronData,
	type PatronRules,
} from "#lib/server/services/patrons.js";
import {
	canCommit,
	countRows,
	detectFormat,
	ImportNotReadyError,
	mapRows,
	type DetectedFormat,
	type ImportCounts,
	type ImportRow,
	type RowReason,
	tooLongReasons,
	withImportBatch,
} from "./pipeline.js";

/** The caps of the patron form, applied to the cells of a file too. */
const PATRON_LIMITS = maxLengths<PatronImportColumn>({
	firstName: patronFormSchema.entries.firstName,
	lastName: patronFormSchema.entries.lastName,
	section: patronFormSchema.entries.groupName,
	group: patronFormSchema.entries.groupName,
	cardNumber: patronFormSchema.entries.cardNumber,
	externalId: patronFormSchema.entries.externalId,
	email: patronFormSchema.entries.email,
});

/** The two patron imports: students (with their class) and teachers (with their group). */
export const PATRON_AUDIENCES = ["students", "teachers"] as const;
export type PatronAudience = (typeof PATRON_AUDIENCES)[number];

export const PATRON_IMPORT_COLUMNS = [
	"firstName",
	"lastName",
	"class",
	"level",
	"section",
	"group",
	"cardNumber",
	"externalId",
	"email",
] as const;
export type PatronImportColumn = StudentField | TeacherField;
/** One entry per CSV column: the field it feeds, or null to ignore it. */
export type ColumnMapping = (PatronImportColumn | null)[];

export function patronSpec(audience: PatronAudience): ImportSpec<PatronImportColumn> {
	return audience === "students" ? STUDENT_IMPORT : TEACHER_IMPORT;
}

export const patronTypeOf = (audience: PatronAudience): PatronType =>
	audience === "students" ? "student" : "teacher";

/**
 * `simple`: `first_name;last_name;level;section`; `combined`: `first_name;last_name;class`;
 * `names`: a teachers file `first_name;last_name`; `custom`: any other header.
 */
export type ImportFormat = "simple" | "combined" | "names" | "custom" | "unknown";

export interface FormatDetection extends DetectedFormat<PatronImportColumn> {
	format: ImportFormat;
}

export function standardMapping(format: "simple" | "combined" | "names"): ColumnMapping {
	switch (format) {
		case "simple":
			return ["firstName", "lastName", "level", "section"];
		case "combined":
			return ["firstName", "lastName", "class"];
		case "names":
			return ["firstName", "lastName"];
	}
}

/** A code: digits, or letters and digits without spaces (`2024A017`), never a plain name. */
const looksLikeCode = (cell: string): boolean => /^[A-Za-z0-9._/-]+$/.test(cell) && /\d/.test(cell);
const looksLikeLevel = (cell: string): boolean => /^\d{1,2}$/.test(cell);

/**
 * Detects header and format from the first rows: a header row has the English names of the
 * import; without a header the shapes of the documented formats are recognised by their number of
 * columns (students: four columns with a level, or three with the class; teachers: two), anything
 * else is mapped by hand.
 */
export function detectPatronFormat(
	rows: readonly string[][],
	audience: PatronAudience,
): FormatDetection {
	const detection = detectFormat(patronSpec(audience), rows);
	const { columns } = detection;
	if (detection.header) {
		const known = (["simple", "combined", "names"] as const).find(
			(f) =>
				(audience === "teachers") === (f === "names") &&
				sameMapping(detection.mapping, standardMapping(f)),
		);
		return { ...detection, format: known ?? "custom" };
	}
	const sample = rows.slice(0, 20);
	const shaped = (
		format: "simple" | "combined" | "names",
		certain: boolean,
	): FormatDetection => ({
		header: false,
		format,
		mapping: standardMapping(format),
		certain,
		columns,
	});
	if (audience === "teachers" && columns === 2) {
		return shaped("names", true);
	}
	if (audience === "students" && columns === 4) {
		return shaped(
			"simple",
			sample.every((r) => looksLikeLevel(r[2] ?? "") && !looksLikeCode(r[0] ?? "")),
		);
	}
	if (audience === "students" && columns === 3) {
		return shaped(
			"combined",
			sample.every((r) => (r[2] ?? "") !== "" && !looksLikeCode(r[0] ?? "")),
		);
	}
	return { ...detection, format: "unknown" };
}

function sameMapping(a: ColumnMapping, b: ColumnMapping): boolean {
	return a.length === b.length && a.every((v, i) => v === b[i]);
}

export interface PatronImportInput {
	line: number;
	patronType: PatronType;
	firstName: string;
	lastName: string;
	/** The class in one cell (`3A`, `3 A`). */
	class: string;
	level: string;
	section: string;
	/** A teachers group. */
	group: string;
	externalId: string;
	cardNumber: string;
	email: string;
}

/** Applies the mapping; rows carry their line in the file (`lines` from the parser, header included). */
export function mapPatronRows(
	rows: readonly string[][],
	mapping: readonly (PatronImportColumn | null)[],
	header: boolean,
	audience: PatronAudience,
	lines?: readonly number[],
): PatronImportInput[] {
	const patronType = patronTypeOf(audience);
	return mapRows(rows, mapping, header, PATRON_IMPORT_COLUMNS, lines).map((row) => ({
		...row,
		patronType,
	}));
}

export type ImportMode = "upsert" | "sync";
export type DuplicatePolicy = "update" | "skip" | "create";

export interface PatronImportOptions {
	audience: PatronAudience;
	mode: ImportMode;
	duplicatePolicy: DuplicatePolicy;
	rules: PatronRules;
	/** Which columns the file provides: only those optional ones are compared and written. */
	columns: readonly PatronImportColumn[];
	/** Homonyms picked by hand in the preview: line → existing patron id, or 'create'. */
	resolutions?: Record<number, number | "create">;
	/** The operator holds `anonymize`: the removal question may be offered. */
	canRemove: boolean;
}

export interface Candidate {
	id: number;
	lastName: string;
	firstName: string;
	/** The class now (`3 B`, Phase 12). */
	classLabel: string;
	groupId: number | null;
	levelCode: string | null;
	patronType: string;
}

export interface PatronImportRow extends ImportRow<PatronImportInput> {
	/** The class (or the teachers group) of the row, labelled as the school labels its classes. */
	classLabel: string;
	/** Existing patron the row updates (or leaves unchanged). */
	matchId: number | null;
	/** Fields that will change on an update. */
	changed: string[];
	/** Homonyms to choose from when the match is ambiguous. */
	candidates?: Candidate[];
}

export interface MissingPatron extends Candidate {
	openLoans: number;
}

export interface PatronImportResult {
	rows: PatronImportRow[];
	counts: ImportCounts;
	/** Sync mode: active patrons of the import's type absent from the file. */
	missing: MissingPatron[];
	/** Sync mode with `anonymize`: the operator may confirm the removal of the missing patrons. */
	offerRemoval: boolean;
	/** New patrons without a card number in the file: the card is generated (Q8). */
	generatedCards: number;
	canCommit: boolean;
}

interface Snapshot extends Candidate {
	searchName: string;
	cardNumber: string | null;
	externalId: string | null;
	email: string | null;
	status: string;
}

function loadSnapshot(db: DbOrTx): Snapshot[] {
	return db
		.select({
			id: patron.id,
			lastName: patron.lastName,
			firstName: patron.firstName,
			searchName: patron.searchName,
			classLabel: patronClass.classLabel,
			groupId: patron.classGroupId,
			levelCode: patron.levelCode,
			patronType: patron.patronType,
			cardNumber: patron.cardNumber,
			externalId: patron.externalId,
			email: patron.email,
			status: patron.status,
		})
		.from(patron)
		.leftJoin(patronClass, eq(patronClass.patronId, patron.id))
		.where(ne(patron.status, "anonymized"))
		.all()
		.map((r) => ({ ...r, classLabel: r.classLabel ?? "" }));
}

const candidateOf = (s: Snapshot): Candidate => ({
	id: s.id,
	lastName: s.lastName,
	firstName: s.firstName,
	classLabel: s.classLabel,
	groupId: s.groupId,
	levelCode: s.levelCode,
	patronType: s.patronType,
});

/** The classes and groups of the school, read once per validation. */
type Groups = readonly ClassGroupInfo[];

function loadGroups(db: DbOrTx, rules: PatronRules): Groups {
	return [...groupsById(db, rules.school).values()];
}

/** The form input of a row: the class from one cell or from level + section (Q115); never created. */
function formInputOf(
	input: PatronImportInput,
	rules: PatronRules,
	groups: Groups,
): { form: PatronFormInput; reason?: RowReason } {
	const form: PatronFormInput = {
		patronType: input.patronType,
		firstName: input.firstName,
		lastName: input.lastName,
		levelCode: "",
		groupId: "",
		groupName: "",
		cardNumber: input.cardNumber,
		externalId: input.externalId,
		email: input.email,
		circulationNote: "",
		notes: "",
	};
	if (input.patronType === "teacher") {
		return { form: { ...form, groupName: input.group } };
	}
	if (input.class !== "") {
		const found = findClass(rules.school, groups, input.class);
		if (!found) {
			return {
				form,
				reason: {
					code: "classUnknown",
					params: {
						value: input.class,
						classes: classLabels(rules.school, groups).join(", "),
					},
				},
			};
		}
		return { form: { ...form, groupId: String(found.groupId), levelCode: found.levelCode } };
	}
	const level = findLevel(rules.school, input.level);
	return {
		form: {
			...form,
			levelCode: level?.code ?? input.level.trim(),
			groupName: input.section.trim(),
		},
	};
}

/**
 * The class of a row as the preview shows it: the class it resolves to, labelled by the school's
 * template; a class the school lacks as the file names it (one cell, or level and section through
 * the template); the teachers group as written.
 */
function rowClassLabel(
	input: PatronImportInput,
	data: PatronData | null,
	rules: PatronRules,
	groups: Groups,
): string {
	if (input.patronType === "teacher") {
		return input.group;
	}
	const group = data ? groups.find((g) => g.id === data.classGroupId) : undefined;
	if (group) {
		return classLabel(rules.school, group, data?.levelCode ?? null);
	}
	if (input.class !== "") {
		return input.class;
	}
	// a level the school lacks keeps the file's text in the label
	const level = findLevel(rules.school, input.level) ?? {
		code: input.level,
		label: input.level,
		name: input.level,
		stage: "",
	};
	return classLabel(
		// the level's stage may write the class its own way (9.41)
		{ stages: rules.school.stages, levels: [level], classLabel: rules.school.classLabel },
		{ name: input.section, kind: "students" },
		level.code,
	);
}

/** The reasons of a refused row, with what helps to fix it (the valid classes or groups). */
function reasonsOf(
	e: PatronValidationError,
	input: PatronImportInput,
	form: PatronFormInput,
	rules: PatronRules,
	groups: Groups,
): RowReason[] {
	return e.issues.map((issue): RowReason => {
		if (issue.code === "groupUnknown" || issue.code === "levelNotInGroup") {
			const valid =
				input.patronType === "teacher"
					? groups.filter((g) => g.kind === "teachers" && !g.archived).map((g) => g.name)
					: classLabels(
							rules.school,
							groups,
							rules.school.levels.some((l) => l.code === form.levelCode)
								? form.levelCode
								: null,
						);
			return {
				code:
					input.patronType === "teacher" && issue.code === "groupUnknown"
						? "teacherGroupUnknown"
						: issue.code,
				params: {
					value: input.patronType === "teacher" ? input.group : input.section,
					classes: valid.join(", "),
				},
			};
		}
		if (issue.code === "levelUnknown") {
			return { code: issue.code, params: { value: input.level } };
		}
		return { code: issue.code };
	});
}

/**
 * The data a row writes: the mandatory fields plus the optional columns the file provides; an empty
 * cell of an optional column keeps what the patron has (a file never erases a card, step 9.19).
 */
export function rowData(
	data: PatronData,
	columns: readonly PatronImportColumn[],
): Partial<PatronData> {
	const out: Partial<PatronData> = {
		patronType: data.patronType,
		firstName: data.firstName,
		lastName: data.lastName,
		levelCode: data.levelCode,
	};
	// a teacher without a group in the file keeps the teachers group they have
	if (data.patronType === "student" || data.classGroupId !== null) {
		out.classGroupId = data.classGroupId;
	}
	if (columns.includes("externalId") && data.externalId !== null) {
		out.externalId = data.externalId;
	}
	if (columns.includes("cardNumber") && data.cardNumber !== null) {
		out.cardNumber = data.cardNumber;
	}
	if (columns.includes("email") && data.email !== null) {
		out.email = data.email;
	}
	return out;
}

/**
 * The validate phase: every row gets a status and reasons; nothing is written. Matching order:
 * card number, external id, then surname + first name with the class as tie-breaker;
 * unresolved homonyms are errors until the operator picks one in the preview.
 */
export function validatePatronImport(
	db: DbOrTx,
	inputs: readonly PatronImportInput[],
	options: PatronImportOptions,
): PatronImportResult {
	const snapshot = loadSnapshot(db);
	const groups = loadGroups(db, options.rules);
	const byCard = new Map<string, Snapshot>();
	const byExternal = new Map<string, Snapshot>();
	const byName = new Map<string, Snapshot[]>();
	for (const s of snapshot) {
		if (s.cardNumber) {
			byCard.set(s.cardNumber, s);
		}
		if (s.externalId) {
			byExternal.set(s.externalId, s);
		}
		const list = byName.get(s.searchName) ?? [];
		list.push(s);
		byName.set(s.searchName, list);
	}
	const seenKeys = new Map<string, number>();
	const matched = new Set<number>();
	const rows: PatronImportRow[] = [];

	for (const input of inputs) {
		const reasons: RowReason[] = [];
		const row: PatronImportRow = {
			line: input.line,
			status: "new",
			data: input,
			reasons,
			matchId: null,
			changed: [],
			classLabel: "",
		};
		rows.push(row);
		if (input.firstName === "" || input.lastName === "") {
			reasons.push({ code: "nameRequired" });
		}
		reasons.push(...tooLongReasons(input, PATRON_LIMITS, patronSpec(options.audience)));
		const { form, reason } = formInputOf(input, options.rules, groups);
		if (reason) {
			reasons.push(reason);
		}
		let data: PatronData | null = null;
		if (reasons.length === 0) {
			try {
				data = validatePatron(db, form, options.rules);
			} catch (e) {
				if (!(e instanceof PatronValidationError)) {
					throw e;
				}
				reasons.push(...reasonsOf(e, input, form, options.rules, groups));
			}
		}
		row.classLabel = rowClassLabel(input, data, options.rules, groups);
		if (!data) {
			row.status = "error";
			continue;
		}
		// the same person twice in the file
		const key =
			data.cardNumber && options.columns.includes("cardNumber")
				? `card:${data.cardNumber}`
				: data.externalId && options.columns.includes("externalId")
					? `ext:${data.externalId}`
					: `name:${searchNameOf(data.lastName, data.firstName)}:${data.classGroupId ?? ""}:${data.levelCode ?? ""}`;
		const firstLine = seenKeys.get(key);
		if (firstLine !== undefined) {
			reasons.push({ code: "duplicateInFile", params: { line: firstLine } });
			row.status = "error";
			continue;
		}
		seenKeys.set(key, input.line);

		// match an existing patron
		let match: Snapshot | undefined;
		if (data.cardNumber && options.columns.includes("cardNumber")) {
			match = byCard.get(data.cardNumber);
		}
		if (!match && data.externalId && options.columns.includes("externalId")) {
			match = byExternal.get(data.externalId);
		}
		if (!match) {
			let candidates = byName.get(searchNameOf(data.lastName, data.firstName)) ?? [];
			if (candidates.length > 1) {
				const same = candidates.filter(
					(c) => c.groupId === data.classGroupId && c.levelCode === data.levelCode,
				);
				if (same.length === 1) {
					candidates = same;
				}
			}
			if (candidates.length === 1) {
				match = candidates[0];
			} else if (candidates.length > 1) {
				const choice = options.resolutions?.[input.line];
				if (choice === "create") {
					match = undefined;
				} else if (typeof choice === "number" && candidates.some((c) => c.id === choice)) {
					match = candidates.find((c) => c.id === choice);
				} else {
					row.candidates = candidates.map(candidateOf);
					reasons.push({ code: "homonym", params: { count: candidates.length } });
					row.status = "error";
					continue;
				}
			}
		}
		if (match && options.duplicatePolicy === "create") {
			match = undefined;
		}

		if (!match) {
			// a new patron must not reuse a card or an external id of somebody else
			if (data.cardNumber && byCard.has(data.cardNumber)) {
				reasons.push({ code: "cardNumberTaken" });
			} else if (data.cardNumber && isCopyBarcode(db, data.cardNumber)) {
				reasons.push({ code: "cardNumberIsCopy" });
			}
			if (data.externalId && byExternal.has(data.externalId)) {
				reasons.push({ code: "externalIdTaken" });
			}
			row.status = reasons.length > 0 ? "error" : "new";
			continue;
		}
		if (matched.has(match.id)) {
			reasons.push({ code: "matchedTwice", params: { id: match.id } });
			row.status = "error";
			continue;
		}
		matched.add(match.id);
		row.matchId = match.id;
		if (options.duplicatePolicy === "skip") {
			row.status = "unchanged";
			reasons.push({ code: "skipped" });
			continue;
		}
		const next = rowData(data, options.columns);
		const cardOwner = next.cardNumber ? byCard.get(next.cardNumber) : undefined;
		if (cardOwner && cardOwner.id !== match.id) {
			reasons.push({ code: "cardNumberTaken" });
			row.status = "error";
			continue;
		}
		if (next.cardNumber && isCopyBarcode(db, next.cardNumber)) {
			reasons.push({ code: "cardNumberIsCopy" });
			row.status = "error";
			continue;
		}
		const externalOwner = next.externalId ? byExternal.get(next.externalId) : undefined;
		if (externalOwner && externalOwner.id !== match.id) {
			reasons.push({ code: "externalIdTaken" });
			row.status = "error";
			continue;
		}
		// the snapshot names the class `groupId` (as the preview shows it); the patron, `classGroupId`
		row.changed = changedPatronFields({ ...match, classGroupId: match.groupId }, next);
		row.status = row.changed.length > 0 ? "update" : "unchanged";
	}

	const type = patronTypeOf(options.audience);
	const missing: MissingPatron[] =
		options.mode === "sync"
			? snapshot
					.filter((s) => s.patronType === type && !matched.has(s.id))
					.map((s) => ({ ...candidateOf(s), openLoans: openLoanCount(db, s.id) }))
			: [];
	const counts = countRows(rows);
	return {
		rows,
		counts,
		missing,
		offerRemoval: options.mode === "sync" && options.canRemove && missing.length > 0,
		generatedCards: rows.filter((r) => r.status === "new" && r.data.cardNumber === "").length,
		canCommit: canCommit(counts),
	};
}

export interface PatronImportSummary {
	batchId: number;
	created: number;
	updated: number;
	unchanged: number;
	removed: number;
	/** Missing patrons kept because they still have open loans. */
	notRemoved: number[];
	createdIds: number[];
}

export interface CommitOptions extends PatronImportOptions {
	actor: AuditActor;
	filename: string;
	/** Where the original file was kept (`DATA_DIR/imports/<batch-id>/…` after the commit). */
	storeFile: (batchId: number) => string | null;
	removeMissing: boolean;
	dataDir: string;
	now?: Date;
}

/**
 * The commit phase: validates again (the data may have changed since the preview), refuses any
 * error, then writes everything in one transaction with an `import_batch` row.
 */
export function commitPatronImport(
	db: Db,
	inputs: readonly PatronImportInput[],
	options: CommitOptions,
): PatronImportSummary {
	const now = options.now ?? new Date();
	const summary = db.transaction((tx) => {
		const result = validatePatronImport(tx, inputs, options);
		if (!result.canCommit) {
			throw new ImportNotReadyError();
		}
		return withImportBatch(
			tx,
			{ ...options, kind: "patrons", now },
			() => writePatrons(tx, result, options, now),
			(summary) => ({
				audience: options.audience,
				mode: options.mode,
				created: summary.created,
				updated: summary.updated,
				unchanged: summary.unchanged,
				removed: summary.removed,
			}),
		);
	});
	if (summary.removed > 0) {
		// the faces of the students removed by the synchronisation, covered once committed (Q106)
		void coverRemovedFaces(db, options.dataDir);
	}
	return summary;
}

/** The patrons of a validated file (and the removals of the synchronisation), inside the commit's transaction. */
function writePatrons(
	tx: DbOrTx,
	result: PatronImportResult,
	options: CommitOptions,
	now: Date,
): Omit<PatronImportSummary, "batchId"> {
	const createdIds: number[] = [];
	let updated = 0;
	let unchanged = 0;
	const groups = loadGroups(tx, options.rules);
	for (const row of result.rows) {
		const data = validatePatron(
			tx,
			formInputOf(row.data, options.rules, groups).form,
			options.rules,
		);
		if (row.status === "new") {
			// optional fields the file does not provide are empty in `data` already
			createdIds.push(insertPatron(tx, data, options.actor, options.rules, now));
		} else if (row.status === "update" && row.matchId !== null) {
			applyPatronUpdate(tx, row.matchId, rowData(data, options.columns), options.actor, now);
			updated++;
		} else {
			unchanged++;
		}
	}
	let removed = 0;
	const notRemoved: number[] = [];
	if (options.mode === "sync" && options.removeMissing && options.canRemove) {
		for (const m of result.missing) {
			if (m.openLoans > 0) {
				notRemoved.push(m.id);
			} else if (anonymizePatron(tx, options.dataDir, m.id, options.actor, now)) {
				removed++;
			}
		}
	}
	return {
		created: createdIds.length,
		updated,
		unchanged,
		removed,
		notRemoved,
		createdIds,
	};
}
