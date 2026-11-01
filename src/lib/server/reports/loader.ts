// SPDX-License-Identifier: GPL-3.0-or-later
// Report files (PLAN.md §3.11, ADR-014): the built-ins shipped in `config/reports/` and the
// school's own in `CONFIG_DIR/reports/`, which replace a built-in with the same `id`. A file that
// is not valid JSON, fails the schema or the SQL checks is reported and skipped; it never stops
// the others.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as v from "valibot";
import { compileQuery, QueryCompileError } from "./builder/compile.js";
import {
	boundNames,
	IMPLICIT_PARAMS,
	reportDefinitionSchema,
	reportFileSchema,
	type ReportDefinition,
} from "./definition.js";
import { checkReportSql } from "./safety.js";

export interface LoadedReport extends ReportDefinition {
	source: "builtin" | "config";
	file: string;
}

export interface ReportFileProblem {
	file: string;
	source: "builtin" | "config";
	message: string;
}

export interface ReportLibrary {
	reports: LoadedReport[];
	problems: ReportFileProblem[];
}

const issueText = (issues: readonly v.BaseIssue<unknown>[]): string[] =>
	issues.map((i) => {
		const path = (i.path ?? []).map((p) => String((p as { key: unknown }).key)).join(".");
		return path ? `${path}: ${i.message}` : i.message;
	});

/**
 * Parses and checks one definition — a guided one is compiled first (9.20) and keeps its
 * `query` — and returns the report or the problems found.
 */
export function parseReport(raw: unknown): { report: ReportDefinition } | { problems: string[] } {
	const file = v.safeParse(reportFileSchema, raw);
	if (!file.success) {
		return { problems: issueText(file.issues) };
	}
	let full: unknown = file.output;
	if (file.output.query) {
		try {
			const compiled = compileQuery(file.output.query);
			full = {
				...file.output,
				sql: compiled.sql,
				columns: compiled.columns,
				params: compiled.params,
				pivot: compiled.pivot,
				chart: compiled.chart,
			};
		} catch (e) {
			if (e instanceof QueryCompileError) {
				return { problems: e.problems.map((p) => `query: ${p}`) };
			}
			throw e;
		}
	}
	const parsed = v.safeParse(reportDefinitionSchema, full);
	if (!parsed.success) {
		return { problems: issueText(parsed.issues) };
	}
	const report = parsed.output;
	const declared = report.params.flatMap(boundNames);
	const clash = declared.filter((n) => (IMPLICIT_PARAMS as readonly string[]).includes(n));
	if (clash.length > 0) {
		return { problems: clash.map((n) => `params: "${n}" is reserved`) };
	}
	const sqlProblems = checkReportSql(report.sql, declared, IMPLICIT_PARAMS);
	if (sqlProblems.length > 0) {
		return {
			problems: sqlProblems.map((p) => `sql: ${p.code}${p.detail ? ` (${p.detail})` : ""}`),
		};
	}
	return { report };
}

export function loadReports(configDir: string, builtinRoot = "config"): ReportLibrary {
	const byId = new Map<string, LoadedReport>();
	const problems: ReportFileProblem[] = [];
	const scan = (dir: string, source: LoadedReport["source"]): void => {
		if (!existsSync(dir)) {
			return;
		}
		for (const name of readdirSync(dir).sort()) {
			if (!name.endsWith(".json")) {
				continue;
			}
			const file = join(dir, name);
			let raw: unknown;
			try {
				raw = JSON.parse(readFileSync(file, "utf8"));
			} catch (e) {
				problems.push({ file: name, source, message: `JSON: ${(e as Error).message}` });
				continue;
			}
			const result = parseReport(raw);
			if ("problems" in result) {
				problems.push({ file: name, source, message: result.problems.join("; ") });
				continue;
			}
			byId.set(result.report.id, { ...result.report, source, file: name });
		}
	};
	scan(join(builtinRoot, "reports"), "builtin");
	scan(join(configDir, "reports"), "config");
	return {
		reports: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
		problems,
	};
}
