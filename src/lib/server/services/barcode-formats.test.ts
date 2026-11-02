// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { itemCode } from "../../../../tests/helpers/codes.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, biblio, item, patron, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { presetFormats } from "#lib/shared/barcodes/presets.js";
import {
	BarcodeFormatsNotReadyError,
	currentBarcodeDraft,
	planBarcodeFormats,
	saveBarcodeFormats,
	type BarcodeFormatsDraft,
} from "./barcode-formats.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-barcode-formats-"));
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

const NOW = new Date("2026-10-05T10:00:00Z");

function fixture(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const biblioId = db
		.insert(biblio)
		.values({ title: "T", author: "A", publisher: "P", kind: "fiction" })
		.returning({ id: biblio.id })
		.get().id;
	for (const barcode of ["2025-0042", "2026-0001", "12345", itemCode(2026, 1)]) {
		db.insert(item).values({ biblioId, barcode }).run();
	}
	db.insert(patron)
		.values({ firstName: "a", lastName: "b", patronType: "teacher", cardNumber: "0000001240" })
		.run();
	return { db, actor };
}

function draft(change: (d: BarcodeFormatsDraft) => void = () => undefined): BarcodeFormatsDraft {
	const d = structuredClone(currentBarcodeDraft(getConfig()));
	change(d);
	return d;
}

describe("planBarcodeFormats", () => {
	it("describes the saved formats: usage, examples and the verdict", () => {
		const { db } = fixture();
		const plan = planBarcodeFormats(db, getConfig(), draft(), 2026);
		expect(plan).toMatchObject({ ready: true, changed: false, patterns: [], removals: [] });
		expect(plan.issues.filter((i) => i.severity === "error")).toEqual([]);
		expect(plan.item?.current.count).toBe(1);
		expect(plan.item?.legacy).toEqual([
			{ format: { pattern: "YYYY-NNNN", check: "none" }, count: 2 },
		]);
		expect(plan.card?.legacy[0]?.count).toBe(1);
		expect(plan.item?.examples).toHaveLength(10);
		expect(plan.item?.examples[0]).toBe(itemCode(2026, 1));
		expect(plan.card?.examples).toHaveLength(10);
		expect(plan.plainLongest).toBe(5);
	});

	it("moves a replaced format to the retired ones", () => {
		const { db } = fixture();
		const { item: classic } = presetFormats("classic", "luhn");
		const plan = planBarcodeFormats(
			db,
			getConfig(),
			draft((d) => {
				d.item.format = classic;
			}),
			2026,
		);
		expect(plan.changed).toBe(true);
		expect(plan.draft.item.retired).toEqual([{ pattern: "YYYY-CNNNN", check: "mod23" }]);
		expect(plan.item?.retired[0]?.count).toBe(1);
		expect(plan.ready).toBe(true);
	});

	it("refuses broken patterns, confusable formats and the removal of formats in use", () => {
		const { db } = fixture();
		const broken = planBarcodeFormats(
			db,
			getConfig(),
			draft((d) => {
				d.patron.format = { pattern: "NNNN", check: "luhn" };
			}),
			2026,
		);
		expect(broken.patterns).toEqual([
			{ kind: "card", role: "current", pattern: "NNNN", code: "algorithmWithoutCheck" },
		]);
		expect(broken.ready).toBe(false);
		expect(broken.item).toBeNull();

		const confusable = planBarcodeFormats(
			db,
			getConfig(),
			draft((d) => {
				d.patron.format = { pattern: "YYYY-CNNNN", check: "mod23" };
			}),
			2026,
		);
		expect(confusable.issues.some((i) => i.code === "overlap" && i.severity === "error")).toBe(
			true,
		);
		expect(confusable.ready).toBe(false);

		const removing = planBarcodeFormats(
			db,
			getConfig(),
			draft((d) => {
				d.item.legacy = [];
			}),
			2026,
		);
		expect(removing.removals).toEqual([
			{
				kind: "item",
				role: "legacy",
				format: { pattern: "YYYY-NNNN", check: "none" },
				count: 2,
			},
		]);
		expect(removing.ready).toBe(false);
	});
});

describe("saveBarcodeFormats", () => {
	it("writes the formats as one audited change", () => {
		const { db, actor } = fixture();
		const { item: prefixed, card } = presetFormats("prefix", "damm");
		saveBarcodeFormats(
			{ db, config: getConfig(), configDir: dir },
			draft((d) => {
				d.item.format = prefixed;
				d.patron.format = card;
			}),
			2026,
			actor,
			NOW,
		);
		const config = getConfig();
		expect(config.barcodes.item.format).toEqual(prefixed);
		expect(config.barcodes.item.retired).toEqual([{ pattern: "YYYY-CNNNN", check: "mod23" }]);
		expect(config.barcodes.patron.retired).toEqual([{ pattern: "CNNNNNN", check: "mod23" }]);
		const written = JSON.parse(readFileSync(join(dir, "config.json"), "utf8")) as {
			barcodes: { item: { format: unknown } };
		};
		expect(written.barcodes.item.format).toEqual(prefixed);
		const row = db.select().from(auditLog).where(eq(auditLog.action, "config.barcodes")).get();
		expect(row?.details).toMatchObject({ item: "'L'-YYNNNNC", cardCheck: "damm" });
	});

	it("refuses a draft that is not ready", () => {
		const { db, actor } = fixture();
		expect(() =>
			saveBarcodeFormats(
				{ db, config: getConfig(), configDir: dir },
				draft((d) => {
					d.patron.format = { pattern: "YYYY-CNNNN", check: "mod23" };
				}),
				2026,
				actor,
				NOW,
			),
		).toThrow(BarcodeFormatsNotReadyError);
	});
});
