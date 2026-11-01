// SPDX-License-Identifier: GPL-3.0-or-later
// The steps every CSV import takes (§3.22) through the real import kinds: the upload refusals and
// the remembered mapping, the validate and commit phases over the stored file, and what they say
// when the mapping is incomplete, the file gone or errors left.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { classId, mirrorTestSchool, TEST_SCHOOL } from "../../../../tests/helpers/school.js";
import type { AuthUser } from "#lib/server/auth/types.js";
import type { ServerContext } from "#lib/server/context.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { auditLog, importBatch, patron, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { CATALOG_FIELDS } from "#lib/shared/import-columns.js";
import { commitImport, receiveUpload, validateImport, type UploadRefusal } from "./handlers.js";
import { CATALOG_IMPORT_KIND, LOAN_IMPORT_KIND, PATRON_IMPORT_KINDS } from "./kinds.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const parsed = parseConfig(exampleRaw()).config;
/** The example configuration with the school of the test helpers (years 1–5, `3 B` labels). */
const config = {
	...parsed,
	school: {
		...parsed.school,
		stages: TEST_SCHOOL.stages,
		levels: TEST_SCHOOL.levels,
		classLabel: TEST_SCHOOL.classLabel,
	},
};

function setup(permissions: AuthUser["permissions"] = ["admin"]): {
	ctx: ServerContext;
	actor: AuthUser;
} {
	const db = createTestDb();
	mirrorTestSchool(db);
	const { id } = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const dataDir = mkdtempSync(join(tmpdir(), "bv-import-steps-"));
	dirs.push(dataDir);
	return {
		ctx: { db, dataDir, configDir: join(dataDir, "config"), config },
		actor: { id, username: "u", displayName: "U", roles: [], permissions },
	};
}

const file = (text: string, name?: string): Blob =>
	name === undefined ? new Blob([text]) : new File([text], name);

function stored<T>(outcome: UploadRefusal | T): T {
	if (typeof outcome === "object" && outcome !== null && "refused" in outcome) {
		throw new Error(`refused: ${outcome.refused.key}`);
	}
	return outcome;
}

const CATALOG = "title;author;publisher\nIl barone rampante;Calvino, Italo;Einaudi\n";

describe("upload", () => {
	it("refuses an empty file, a file too large and a file without rows", async () => {
		const { ctx } = setup();
		expect(await receiveUpload(CATALOG_IMPORT_KIND, ctx.dataDir, file(""))).toEqual({
			refused: { key: "common.import.errors.empty", params: undefined },
		});
		const small = { ...CATALOG_IMPORT_KIND, maxBytes: 10 };
		expect(await receiveUpload(small, ctx.dataDir, file(CATALOG))).toEqual({
			refused: { key: "common.import.errors.tooLarge", params: { mb: 0.00001 } },
		});
		expect(await receiveUpload(CATALOG_IMPORT_KIND, ctx.dataDir, file("\n;\n\n"))).toEqual({
			refused: { key: "common.import.errors.noRows", params: undefined },
		});
	});

	it("refuses on the file field what the public demo does not import", async () => {
		const { ctx } = setup();
		const saved = { DEMO_PUBLIC: process.env.DEMO_PUBLIC, DATA_DIR: process.env.DATA_DIR };
		process.env.DEMO_PUBLIC = "1";
		process.env.DATA_DIR = ctx.dataDir;
		resetEnvCache();
		try {
			expect(await receiveUpload(CATALOG_IMPORT_KIND, ctx.dataDir, file(CATALOG))).toEqual({
				refused: { key: "common.demoPublic.blocked.importExample", params: undefined },
			});
		} finally {
			for (const [key, value] of Object.entries(saved)) {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			}
			resetEnvCache();
		}
	});

	it("stores the file, detects its format and offers the mapping remembered for its header", async () => {
		const { ctx, actor } = setup();
		const first = stored(
			await receiveUpload(CATALOG_IMPORT_KIND, ctx.dataDir, file(CATALOG, "libri.csv")),
		);
		expect(first).toMatchObject({
			filename: "libri.csv",
			encoding: "utf-8",
			delimiter: ";",
			rowCount: 1,
			mapping: ["title", "author", "publisher"],
			remembered: false,
		});
		expect(first.sample).toHaveLength(2);
		// the operator maps the columns another way: the next file of the same source gets it
		const mapping = ["title", "publisher", "author"] as const;
		const run = { uploadId: first.uploadId, header: true, useSpecialValues: false };
		expect(
			validateImport(CATALOG_IMPORT_KIND, ctx, { ...run, mapping: [...mapping] }, actor),
		).toMatchObject({ ok: true });
		const again = stored(await receiveUpload(CATALOG_IMPORT_KIND, ctx.dataDir, file(CATALOG)));
		expect(again).toMatchObject({ filename: "catalog.csv", mapping, remembered: true });
	});

	it("keeps the detected mapping when the remembered one no longer fits the file", async () => {
		const { ctx, actor } = setup();
		const first = stored(await receiveUpload(CATALOG_IMPORT_KIND, ctx.dataDir, file(CATALOG)));
		const run = { uploadId: first.uploadId, header: true, useSpecialValues: false };
		validateImport(
			CATALOG_IMPORT_KIND,
			ctx,
			{ ...run, mapping: ["title", "author", "publisher", null] },
			actor,
		);
		const again = stored(await receiveUpload(CATALOG_IMPORT_KIND, ctx.dataDir, file(CATALOG)));
		expect(again).toMatchObject({
			mapping: ["title", "author", "publisher"],
			remembered: false,
		});
	});
});

describe("validate and commit", () => {
	it("names the missing columns and says when the file is gone", async () => {
		const { ctx, actor } = setup();
		const { uploadId } = stored(
			await receiveUpload(CATALOG_IMPORT_KIND, ctx.dataDir, file(CATALOG)),
		);
		const run = { uploadId, header: true, useSpecialValues: false };
		const incomplete = { ...run, mapping: ["title", null, null] as ("title" | null)[] };
		expect(validateImport(CATALOG_IMPORT_KIND, ctx, incomplete, actor)).toEqual({
			ok: false,
			error: "mappingIncomplete",
			columns: "author, publisher",
		});
		expect(commitImport(CATALOG_IMPORT_KIND, ctx, incomplete, actor)).toMatchObject({
			error: "mappingIncomplete",
		});
		const gone = { ...run, uploadId: "0123456789abcdef", mapping: [...CATALOG_FIELDS] };
		expect(validateImport(CATALOG_IMPORT_KIND, ctx, gone, actor)).toEqual({
			ok: false,
			error: "uploadGone",
		});
		expect(commitImport(CATALOG_IMPORT_KIND, ctx, gone, actor)).toEqual({
			ok: false,
			error: "uploadGone",
		});
	});

	it("imports the catalogue and keeps the file with its batch", async () => {
		const { ctx, actor } = setup();
		const upload = stored(await receiveUpload(CATALOG_IMPORT_KIND, ctx.dataDir, file(CATALOG)));
		const run = {
			uploadId: upload.uploadId,
			mapping: upload.mapping,
			header: true,
			useSpecialValues: false,
		};
		expect(validateImport(CATALOG_IMPORT_KIND, ctx, run, actor)).toMatchObject({
			ok: true,
			counts: { new: 1, error: 0 },
			canCommit: true,
		});
		const done = commitImport(CATALOG_IMPORT_KIND, ctx, run, actor);
		expect(done).toMatchObject({ ok: true, titlesCreated: 1, copiesCreated: 1 });
		const batch = ctx.db.select().from(importBatch).get();
		expect(batch).toMatchObject({ kind: "catalog", filename: "catalog.csv", mode: null });
		expect(batch?.storedPath).toBe(join("imports", String(batch?.id), "catalog.csv"));
		// the file moved with its batch: the same upload cannot be committed twice
		expect(commitImport(CATALOG_IMPORT_KIND, ctx, run, actor)).toEqual({
			ok: false,
			error: "uploadGone",
		});
	});

	it("refuses the commit of a file with errors", async () => {
		const { ctx, actor } = setup();
		const upload = stored(
			await receiveUpload(
				LOAN_IMPORT_KIND,
				ctx.dataDir,
				file("card_number;barcode\nC000001;2026-0001\n"),
			),
		);
		const run = { uploadId: upload.uploadId, mapping: upload.mapping, header: true };
		expect(validateImport(LOAN_IMPORT_KIND, ctx, run, actor)).toMatchObject({
			ok: true,
			counts: { error: 1 },
			canCommit: false,
		});
		expect(commitImport(LOAN_IMPORT_KIND, ctx, run, actor)).toEqual({
			ok: false,
			error: "notReady",
		});
		expect(ctx.db.select().from(importBatch).all()).toEqual([]);
	});

	it("imports students with the answers of the wizard and labels their classes", async () => {
		const { ctx, actor } = setup(["patrons.import"]);
		classId(ctx.db, "3", "A");
		const kind = PATRON_IMPORT_KINDS.students;
		const upload = stored(
			await receiveUpload(
				kind,
				ctx.dataDir,
				file("first_name;last_name;level;section\nAnna;Rossi;3;A\nLuca;Bianchi;9;B\n"),
			),
		);
		expect(upload.detection).toMatchObject({ format: "simple", header: true });
		const run = {
			audience: "students" as const,
			uploadId: upload.uploadId,
			mapping: upload.mapping,
			header: true,
			mode: "upsert" as const,
			duplicatePolicy: "update" as const,
			resolutions: {},
		};
		const checked = validateImport(kind, ctx, run, actor);
		expect(checked).toMatchObject({ ok: true, offerRemoval: false });
		if (!checked.ok) {
			throw new Error("not validated");
		}
		expect(checked.rows.map((r) => [r.status, r.classLabel])).toEqual([
			["new", "3 A"],
			["error", "9 B"],
		]);

		const fixed = stored(
			await receiveUpload(
				kind,
				ctx.dataDir,
				file("first_name;last_name;class\nAnna;Rossi;3A\nLuca;Bianchi;3 A\n"),
			),
		);
		const done = commitImport(
			kind,
			ctx,
			{ ...run, uploadId: fixed.uploadId, mapping: fixed.mapping, mode: "sync" },
			actor,
		);
		expect(done).toMatchObject({ ok: true, created: 2, removed: 0 });
		expect(ctx.db.select().from(patron).all()).toHaveLength(2);
		expect(ctx.db.select().from(importBatch).get()).toMatchObject({
			kind: "patrons",
			mode: "sync",
		});
		const logged = ctx.db
			.select()
			.from(auditLog)
			.where(eq(auditLog.action, "import.patrons"))
			.get();
		expect(logged?.details).toEqual({
			audience: "students",
			mode: "sync",
			created: 2,
			updated: 0,
			unchanged: 0,
			removed: 0,
		});
	});

	it("imports teachers and answers a homonym picked by hand", async () => {
		const { ctx, actor } = setup(["patrons.import", "anonymize"]);
		const kind = PATRON_IMPORT_KINDS.teachers;
		const upload = stored(
			await receiveUpload(kind, ctx.dataDir, file("first_name;last_name\nMarco;Verdi\n")),
		);
		const run = {
			audience: "teachers" as const,
			uploadId: upload.uploadId,
			mapping: upload.mapping,
			header: true,
			mode: "sync" as const,
			duplicatePolicy: "update" as const,
			resolutions: { "2": "create" as const },
			removeMissing: true,
		};
		expect(validateImport(kind, ctx, run, actor)).toMatchObject({
			ok: true,
			counts: { new: 1, error: 0 },
		});
		expect(commitImport(kind, ctx, run, actor)).toMatchObject({ ok: true, created: 1 });
	});
});
