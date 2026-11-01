// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { checkReportSql, stripSql } from "./safety.js";

const codes = (sql: string, declared: string[] = []): string[] =>
	checkReportSql(sql, declared).map((p) => (p.detail ? `${p.code}:${p.detail}` : p.code));

describe("report SQL checks", () => {
	it("strips comments and empties string literals", () => {
		expect(stripSql("SELECT 'a;b' -- x; DELETE\n, /* DROP */ \"delete\" FROM t")).toBe(
			"SELECT ''  ,    \"x\"  FROM t",
		);
		expect(stripSql("SELECT 'it''s'")).toBe("SELECT ''");
	});

	it("accepts a single SELECT or WITH with the declared parameters", () => {
		expect(codes("SELECT COUNT(*) AS n FROM loan WHERE issued_at >= :from", ["from"])).toEqual(
			[],
		);
		expect(
			codes(
				"WITH x AS (SELECT 1 AS a) SELECT a, strftime('%H:%M', 'now') AS t FROM x -- ; delete",
			),
		).toEqual([]);
		// keywords inside strings and quoted names are not statements
		expect(codes("SELECT 'DELETE FROM patron' AS \"update\" FROM loan")).toEqual([]);
	});

	it("refuses anything that is not one read-only statement", () => {
		expect(codes("DELETE FROM loan")).toEqual(["not_select", "forbidden_keyword:DELETE"]);
		expect(codes("WITH x AS (SELECT 1) DELETE FROM loan")).toEqual([
			"forbidden_keyword:DELETE",
		]);
		expect(codes("SELECT 1; SELECT 2")).toEqual(["multiple_statements"]);
		expect(codes("SELECT * FROM pragma_table_info('loan'); PRAGMA query_only = 0")).toContain(
			"forbidden_keyword:PRAGMA",
		);
		expect(codes("SELECT load_extension('x')")).toEqual(["forbidden_keyword:LOAD_EXTENSION"]);
		expect(codes("ATTACH 'x.db' AS y")).toContain("forbidden_keyword:ATTACH");
		expect(codes("  -- only a comment")).toEqual(["empty"]);
	});

	it("allows only declared :name parameters, each used", () => {
		expect(codes("SELECT ? AS a")).toEqual(["positional_parameter"]);
		expect(codes("SELECT @a AS a")).toEqual(["positional_parameter"]);
		expect(codes("SELECT :a AS a")).toEqual(["undeclared_parameter:a"]);
		expect(codes("SELECT 1 AS a", ["b"])).toEqual(["unused_parameter:b"]);
		expect(codes("SELECT CAST(x AS TEXT)::int FROM t")).toEqual([]);
	});
	it("sees through case, spacing, comments and quotes used to hide a second statement", () => {
		expect(codes("sElEcT 1\n;\n dElEtE FROM loan")).toEqual([
			"multiple_statements",
			"forbidden_keyword:DELETE",
		]);
		expect(codes("SELECT 1 /* ; */ ; DROP TABLE item")).toContain("multiple_statements");
		expect(codes("SELECT * FROM item WHERE barcode = ''';DELETE FROM item;--'")).toEqual([]);
		expect(codes("SELECT '' ';' ; DELETE FROM item")).toContain("forbidden_keyword:DELETE");
		expect(
			codes("WITH RECURSIVE r(n) AS (SELECT 1) INSERT INTO item SELECT * FROM r"),
		).toContain("forbidden_keyword:INSERT");
		expect(codes("SELECT * FROM patron; VACUUM")).toContain("forbidden_keyword:VACUUM");
		expect(codes("REPLACE INTO item VALUES (1)")).toContain("not_select");
	});
});
