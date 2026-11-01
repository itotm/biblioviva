// SPDX-License-Identifier: GPL-3.0-or-later
// SQL checks of a report definition (PLAN.md §3.11), applied when the file is loaded: one
// statement starting with SELECT or WITH, no statement separator, no keyword that writes or
// changes the connection, only `:name` parameters and only the declared ones. The read-only
// connection (`connection.ts`) is the second line of defence.
const FORBIDDEN = [
	"insert",
	"update",
	"delete",
	"replace",
	"upsert",
	"create",
	"drop",
	"alter",
	"attach",
	"detach",
	"pragma",
	"vacuum",
	"reindex",
	"analyze",
	"begin",
	"commit",
	"rollback",
	"savepoint",
	"release",
	"load_extension",
];

/** The statement without comments and with every string literal emptied (`'…'` → `''`). */
export function stripSql(sql: string): string {
	let out = "";
	let i = 0;
	while (i < sql.length) {
		const c = sql[i] ?? "";
		const next = sql[i + 1] ?? "";
		if (c === "-" && next === "-") {
			const end = sql.indexOf("\n", i);
			i = end === -1 ? sql.length : end + 1;
			out += " ";
		} else if (c === "/" && next === "*") {
			const end = sql.indexOf("*/", i + 2);
			i = end === -1 ? sql.length : end + 2;
			out += " ";
		} else if (c === "'" || c === '"' || c === "`" || c === "[") {
			const close = c === "[" ? "]" : c;
			let j = i + 1;
			while (j < sql.length) {
				if (sql[j] === close) {
					if (close !== "]" && sql[j + 1] === close) {
						j += 2;
						continue;
					}
					break;
				}
				j++;
			}
			// string literals are emptied; quoted identifiers become a neutral name, since a quoted
			// keyword ("delete" as a column alias) is only a name
			out += c === "'" ? "''" : ` ${close === "]" ? "[x]" : `${c}x${c}`} `;
			i = j + 1;
		} else {
			out += c;
			i++;
		}
	}
	return out;
}

export interface SqlProblem {
	code:
		| "empty"
		| "not_select"
		| "multiple_statements"
		| "forbidden_keyword"
		| "positional_parameter"
		| "undeclared_parameter"
		| "unused_parameter";
	detail?: string;
}

/** The problems of a report's SQL; an empty list means it may be loaded. */
export function checkReportSql(
	sql: string,
	declared: readonly string[],
	implicit: readonly string[] = [],
): SqlProblem[] {
	const stripped = stripSql(sql).trim();
	if (!stripped) {
		return [{ code: "empty" }];
	}
	const problems: SqlProblem[] = [];
	if (!/^(select|with)\b/i.test(stripped)) {
		problems.push({ code: "not_select" });
	}
	if (stripped.includes(";")) {
		problems.push({ code: "multiple_statements" });
	}
	const words = new Set(stripped.toLowerCase().match(/[a-z_]+/g) ?? []);
	for (const word of FORBIDDEN) {
		if (words.has(word)) {
			problems.push({ code: "forbidden_keyword", detail: word.toUpperCase() });
		}
	}
	if (/\?\d*|[@$][a-zA-Z_]/.test(stripped)) {
		problems.push({ code: "positional_parameter" });
	}
	const used = new Set(
		[...stripped.matchAll(/(?<![:\w]):([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1] ?? ""),
	);
	for (const name of used) {
		if (!declared.includes(name) && !implicit.includes(name)) {
			problems.push({ code: "undeclared_parameter", detail: name });
		}
	}
	for (const name of declared) {
		if (!used.has(name)) {
			problems.push({ code: "unused_parameter", detail: name });
		}
	}
	return problems;
}
