// SPDX-License-Identifier: GPL-3.0-or-later
// The reports library from the admin UI (PLAN.md step 11.9): every definition with where it comes
// from (shipped, customised copy in CONFIG_DIR/reports/ replacing a built-in, added) and the files
// that are skipped with their problem; a definition uploaded as JSON is checked like the loader
// checks it — schema, reserved names, the SQL safety rules — and tried on the read-only report
// connection, compiled and run with its default parameters (an SQL that SQLite refuses is never
// installed), then written as
// `reports/<id>.json` in one configuration change; a file of CONFIG_DIR removed (a built-in with the
// same id comes back); any definition downloaded to be customised; and the editor of 9.20: the
// file of a definition read as a draft, a draft saved (customising a built-in with the same id, or
// adding a new one) through the same checks.
import { ServiceError } from "#lib/server/errors.js";
import { assertNotDemo } from "#lib/server/demo/public.js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DbOrTx } from "#lib/server/db/client.js";
import { localize, type ReportDefinition } from "#lib/server/reports/definition.js";
import { loadReports, parseReport } from "#lib/server/reports/loader.js";
import type { AuditActor } from "./audit.js";
import type { ConfigChange, FileWrite } from "./config-edit.js";
import { saveConfigWrites } from "./config-sections.js";

export const REPORTS_DIR = "reports";
export const MAX_REPORT_BYTES = 256 * 1024;
const FILE_NAME = /^[\w.-]{1,100}\.json$/;

export class ReportLibraryError extends ServiceError {
	constructor(
		override readonly code:
			"tooLarge" | "badJson" | "invalid" | "sql" | "notFound" | "reservedId",
		readonly details: string[] = [],
	) {
		super(
			code,
			`report library: ${code}${details.length > 0 ? ` (${details.join("; ")})` : ""}`,
		);
		this.name = "ReportLibraryError";
	}
}

export interface ReportEntry {
	id: string;
	title: string;
	category: string;
	restricted: boolean;
	/** `builtin`: shipped; `customised`: a file of CONFIG_DIR replacing a built-in; `added`. */
	origin: "builtin" | "customised" | "added";
	/** The file of CONFIG_DIR (customised and added reports). */
	file: string | null;
}

export interface ReportLibraryView {
	reports: ReportEntry[];
	/** Files skipped because of a problem, the school's own first. */
	problems: { file: string; source: "builtin" | "config"; message: string }[];
}

export function reportLibraryView(
	configDir: string,
	locale: string,
	builtinRoot = "config",
): ReportLibraryView {
	const library = loadReports(configDir, builtinRoot);
	const builtin = new Set(loadReports(builtinRoot, builtinRoot).reports.map((r) => r.id));
	return {
		reports: library.reports.map((r) => ({
			id: r.id,
			title: localize(r.title, locale),
			category: r.category,
			restricted: r.restricted,
			origin: r.source === "builtin" ? "builtin" : builtin.has(r.id) ? "customised" : "added",
			file: r.source === "config" ? r.file : null,
		})),
		problems: [...library.problems].sort((a, b) =>
			a.source === b.source ? a.file.localeCompare(b.file) : a.source === "config" ? -1 : 1,
		),
	};
}

/** The files of CONFIG_DIR/reports/ holding a definition with this id. */
function filesWithId(configDir: string, id: string): string[] {
	const dir = join(configDir, REPORTS_DIR);
	if (!existsSync(dir)) {
		return [];
	}
	return readdirSync(dir).filter((f) => {
		if (!FILE_NAME.test(f)) {
			return false;
		}
		try {
			const raw = JSON.parse(readFileSync(join(dir, f), "utf8")) as { id?: unknown };
			return raw.id === id;
		} catch {
			return false;
		}
	});
}

/**
 * Tries a parsed report before it is saved: `tryReport` on the read-only connection, compiled and
 * run with its defaults; throws when SQLite refuses it.
 */
export type ReportCheck = (report: ReportDefinition) => void;

/** Checks an uploaded definition; returns it parsed with its id. */
export function checkReportUpload(
	bytes: Uint8Array,
	check: ReportCheck,
): { id: string; raw: unknown } {
	if (bytes.byteLength > MAX_REPORT_BYTES) {
		throw new ReportLibraryError("tooLarge");
	}
	let raw: unknown;
	try {
		raw = JSON.parse(new TextDecoder().decode(bytes));
	} catch (e) {
		throw new ReportLibraryError("badJson", [(e as Error).message]);
	}
	const result = parseReport(raw);
	if ("problems" in result) {
		throw new ReportLibraryError("invalid", result.problems);
	}
	// a statement written by hand is never tried in the public demo: it could run for ever (9.17)
	if (result.report.query === undefined) {
		assertNotDemo("sqlReports");
	}
	try {
		check(result.report);
	} catch (e) {
		throw new ReportLibraryError("sql", [(e as Error).message]);
	}
	return { id: result.report.id, raw };
}

/** Installs an uploaded definition as `reports/<id>.json` (other files with that id go). */
export function installReport(
	db: DbOrTx,
	configDir: string,
	bytes: Uint8Array,
	check: ReportCheck,
	actor: AuditActor,
	now = new Date(),
): { id: string; replaced: boolean; change: ConfigChange } {
	const { id, raw } = checkReportUpload(bytes, check);
	const file = `${id}.json`;
	const others = filesWithId(configDir, id).filter((f) => f !== file);
	const replaced = others.length > 0 || existsSync(join(configDir, REPORTS_DIR, file));
	const writes: FileWrite[] = [
		{ path: `${REPORTS_DIR}/${file}`, content: `${JSON.stringify(raw, null, "\t")}\n` },
		...others.map((f) => ({ path: `${REPORTS_DIR}/${f}`, content: null })),
	];
	const change = saveConfigWrites(
		db,
		configDir,
		"reports",
		writes,
		actor,
		{ report: id, installed: true, replaced },
		now,
	);
	return { id, replaced, change };
}

/** Removes a file of CONFIG_DIR/reports/ (a definition, or a file that does not load). */
export function removeReportFile(
	db: DbOrTx,
	configDir: string,
	file: string,
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	if (!FILE_NAME.test(file) || !existsSync(join(configDir, REPORTS_DIR, file))) {
		throw new ReportLibraryError("notFound", [file]);
	}
	return saveConfigWrites(
		db,
		configDir,
		"reports",
		[{ path: `${REPORTS_DIR}/${file}`, content: null }],
		actor,
		{ reportFile: file, removed: true },
		now,
	);
}

/** The file of the definition in use with this id (CONFIG_DIR first), for the download. */
export function reportFileContent(
	configDir: string,
	id: string,
	builtinRoot = "config",
): { name: string; content: string } {
	const report = loadReports(configDir, builtinRoot).reports.find((r) => r.id === id);
	if (!report) {
		throw new ReportLibraryError("notFound", [id]);
	}
	const dir =
		report.source === "config" ? join(configDir, REPORTS_DIR) : join(builtinRoot, REPORTS_DIR);
	return { name: report.file, content: readFileSync(join(dir, report.file), "utf8") };
}

/** The file of the definition in use, as a draft for the editor (9.20), with where it comes from. */
export function reportDraft(
	configDir: string,
	id: string,
	builtinRoot = "config",
): { draft: Record<string, unknown>; origin: ReportEntry["origin"] } {
	const { content } = reportFileContent(configDir, id, builtinRoot);
	const entry = reportLibraryView(configDir, "en", builtinRoot).reports.find((r) => r.id === id);
	return {
		draft: JSON.parse(content) as Record<string, unknown>,
		origin: entry?.origin ?? "added",
	};
}

/**
 * Saves a draft of the editor as `reports/<id>.json` (9.20): the same checks as an upload; a
 * built-in's id makes the customised copy, a new id a new report. `new` is the editor's address of
 * a new report, never an id.
 */
export function saveReportDraft(
	db: DbOrTx,
	configDir: string,
	draft: unknown,
	check: ReportCheck,
	actor: AuditActor,
	now = new Date(),
): { id: string; replaced: boolean; change: ConfigChange } {
	if ((draft as { id?: unknown } | null)?.id === "new") {
		throw new ReportLibraryError("reservedId", ["new"]);
	}
	return installReport(
		db,
		configDir,
		new TextEncoder().encode(JSON.stringify(draft)),
		check,
		actor,
		now,
	);
}
