// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { resetConfigCache } from "#lib/server/config/index.js";
import type { Db } from "#lib/server/db/client.js";
import { staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { revertConfigChange, setUiTheme } from "../../../../tests/helpers/config.js";
import { tryReport } from "#lib/server/reports/probe.js";
import type { ReportContext } from "#lib/server/reports/run.js";
import {
	installReport,
	type ReportCheck,
	removeReportFile,
	reportFileContent,
	reportLibraryView,
	ReportLibraryError,
} from "./report-library.js";

const CONTEXT: ReportContext = {
	today: "2026-09-25",
	schoolYearStart: "2026-09-01",
	levels: ["1"],
	stages: ["primaria"],
	itemTypes: ["libro"],
	classificationCodes: ["A"],
};

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-report-library-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
	setUiTheme(dir, "ocean");
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

function database(): { db: Db; actor: { id: number }; compile: ReportCheck } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	// the check of the app: compiled and run with the defaults (here on the test database)
	return { db, actor, compile: (report) => tryReport(db.$client, report, CONTEXT) };
}

const builtin = JSON.parse(
	readFileSync("config/reports/lost-damaged-items.json", "utf8"),
) as Record<string, unknown>;
const bytes = (value: unknown): Uint8Array =>
	new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));

describe("report library", () => {
	it("lists the built-ins, adds, customises and removes definitions", () => {
		const { db, actor, compile } = database();
		const view = reportLibraryView(dir, "it");
		expect(view.reports.find((r) => r.id === "lost-damaged-items")).toMatchObject({
			origin: "builtin",
			title: "Copie smarrite, danneggiate o in riparazione",
			file: null,
		});

		installReport(
			db,
			dir,
			bytes({ ...builtin, id: "copie-e2e", title: "Copie (mia)" }),
			compile,
			actor,
		);
		expect(
			reportLibraryView(dir, "it").reports.find((r) => r.id === "copie-e2e"),
		).toMatchObject({
			origin: "added",
			file: "copie-e2e.json",
		});

		// the same id as a built-in: the school's copy replaces it
		const custom = installReport(
			db,
			dir,
			bytes({ ...builtin, title: "Copie smarrite (scuola)" }),
			compile,
			actor,
		);
		expect(custom.replaced).toBe(false);
		expect(
			reportLibraryView(dir, "it").reports.find((r) => r.id === "lost-damaged-items"),
		).toMatchObject({
			origin: "customised",
			title: "Copie smarrite (scuola)",
		});
		expect(reportFileContent(dir, "lost-damaged-items").content).toContain("(scuola)");
		removeReportFile(db, dir, "lost-damaged-items.json", actor);
		expect(
			reportLibraryView(dir, "it").reports.find((r) => r.id === "lost-damaged-items")?.origin,
		).toBe("builtin");
		const removed = removeReportFile(db, dir, "copie-e2e.json", actor);
		revertConfigChange(dir, removed.id);
		expect(existsSync(join(dir, "reports", "copie-e2e.json"))).toBe(true);
	});

	it("replaces a file with the same id written under another name", () => {
		const { db, actor, compile } = database();
		mkdirSync(join(dir, "reports"), { recursive: true });
		writeFileSync(
			join(dir, "reports", "vecchio.json"),
			JSON.stringify({ ...builtin, id: "mio" }),
		);
		const result = installReport(db, dir, bytes({ ...builtin, id: "mio" }), compile, actor);
		expect(result.replaced).toBe(true);
		expect(existsSync(join(dir, "reports", "vecchio.json"))).toBe(false);
		expect(existsSync(join(dir, "reports", "mio.json"))).toBe(true);
	});

	it("refuses broken JSON, invalid definitions, unsafe or unknown SQL, and lists broken files", () => {
		const { db, actor, compile } = database();
		const code = (value: unknown): string | undefined => {
			try {
				installReport(db, dir, bytes(value), compile, actor);
			} catch (e) {
				return e instanceof ReportLibraryError ? e.code : "other";
			}
			return undefined;
		};
		expect(code("{")).toBe("badJson");
		expect(code({ ...builtin, id: "Bad Id" })).toBe("invalid");
		expect(code({ ...builtin, id: "x", sql: "DELETE FROM item" })).toBe("invalid");
		expect(
			code({ ...builtin, id: "x", sql: "SELECT nope AS status, 1 AS copies FROM item" }),
		).toBe("sql");
		// it compiles, but it fails as soon as it runs: tried before saving (bug: it was saved)
		expect(
			code({
				...builtin,
				id: "x",
				sql: "SELECT json_extract('not json', '$.a') AS status, 1 AS copies",
			}),
		).toBe("sql");
		expect(code("x".repeat(300 * 1024))).toBe("tooLarge");
		expect(existsSync(join(dir, "reports", "x.json"))).toBe(false);

		mkdirSync(join(dir, "reports"), { recursive: true });
		writeFileSync(join(dir, "reports", "rotto.json"), "{");
		expect(reportLibraryView(dir, "it").problems[0]).toMatchObject({
			file: "rotto.json",
			source: "config",
		});
		removeReportFile(db, dir, "rotto.json", actor);
		expect(() => removeReportFile(db, dir, "rotto.json", actor)).toThrow(ReportLibraryError);
	});
});
