// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, sequenceValue } from "../../../../tests/helpers/db.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import { loadConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, biblio, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { addItems } from "./catalog-items.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import {
	barcodePreview,
	CodesNotReadyError,
	itemTypeUsage,
	planItemTypes,
	saveCounterStart,
	saveItemTypes,
	symbologyOverrides,
	type ItemTypeDraft,
} from "./library-codes.js";
import { cardCode } from "../../../../tests/helpers/codes.js";

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-library-codes-"));
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

const NOW = new Date("2026-09-25T10:15:00Z");

function fixture(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const copy = {
		callNumber: "",
		readingLevel: "",
		enumeration: "",
		acquisitionDate: "2020-01-01",
		notes: "",
		notForLoan: false,
	};
	const rules = catalogRules(getConfig());
	// two DVDs and a book, one copy each: the type is the record's (9.45)
	for (const [title, itemType] of [
		["Il gatto", "dvd"],
		["Il cane", "dvd"],
		["Il topo", "libro"],
	] as const) {
		const id = createBiblio(
			db,
			{
				title,
				subtitle: "",
				originalTitle: "",
				responsibility: "",
				author: "Perrault, Charles",
				publisher: "Einaudi",
				publicationPlace: "",
				publicationYear: "",
				isbn: "",
				issn: "",
				ean: "",
				physicalDescription: "",
				series: "",
				seriesNumber: "",
				dewey: "",
				itemType,
				kind: "fiction",
				genreCode: "B",
				classCode: "",
				readingLevel: "",
				subjects: "",
				notes: "",
			},
			actor,
			rules,
		);
		addItems(db, id, copy, 1, actor, rules, NOW);
	}
	return { db, actor };
}

const types = (): ItemTypeDraft[] =>
	getConfig().library.itemTypes.map((t) => ({
		code: t.code,
		label: t.label,
		notForLoan: t.notForLoan,
	}));

describe("item types", () => {
	it("counts the copies and asks where the copies of a removed type go", () => {
		const { db } = fixture();
		expect(itemTypeUsage(db)).toEqual({ dvd: 2, libro: 1 });
		const draft = types().filter((t) => t.code !== "dvd");
		const plan = planItemTypes({ db, config: getConfig(), configDir: dir }, draft);
		expect(plan).toMatchObject({
			changed: true,
			ready: false,
			removed: [{ code: "dvd", count: 2, replacement: null }],
		});
		expect(
			planItemTypes({ db, config: getConfig(), configDir: dir }, draft, { dvd: "libro" })
				.ready,
		).toBe(true);
		expect(
			planItemTypes({ db, config: getConfig(), configDir: dir }, draft, {
				dvd: "nope",
			}).issues.some((i) => i.message.includes('"dvd" cannot move to "nope"')),
		).toBe(true);
		expect(planItemTypes({ db, config: getConfig(), configDir: dir }, types())).toMatchObject({
			changed: false,
			ready: false,
		});
		// an invalid draft is reported by the schema
		const bad = planItemTypes({ db, config: getConfig(), configDir: dir }, [
			{ code: "a b", label: "", notForLoan: false },
		]);
		expect(bad.issues.some((i) => i.level === "error")).toBe(true);
	});

	it("renames a type: its copies and its loan rule follow, in one change", () => {
		const { db, actor } = fixture();
		const draft = types().map((t) => (t.code === "dvd" ? { ...t, code: "video" } : t));
		const { change, copies } = saveItemTypes(
			{ db, config: getConfig(), configDir: dir },
			draft,
			{ dvd: "video" },
			actor,
			NOW,
		);
		expect(copies).toBe(2);
		expect(change.action).toBe("config.library");
		expect(getConfig().library.itemTypes.map((t) => t.code)).toContain("video");
		expect(getConfig().circulation.itemTypeOverrides).toEqual({
			video: { loanDays: 5, maxRenewals: 1, renewalDays: 5 },
		});
		expect(db.select().from(biblio).where(eq(biblio.itemType, "video")).all()).toHaveLength(2);
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "config.library")).get()?.details,
		).toMatchObject({ moved: { dvd: "video" }, copies: 2 });
	});

	it("removes a type moving its copies to another, dropping its loan rule", () => {
		const { db, actor } = fixture();
		const draft = types().filter((t) => t.code !== "dvd");
		expect(() =>
			saveItemTypes({ db, config: getConfig(), configDir: dir }, draft, {}, actor),
		).toThrow(CodesNotReadyError);
		saveItemTypes(
			{ db, config: getConfig(), configDir: dir },
			draft,
			{ dvd: "libro" },
			actor,
			NOW,
		);
		expect(getConfig().circulation.itemTypeOverrides).toEqual({});
		expect(itemTypeUsage(db)).toEqual({ libro: 3 });
	});
});

describe("barcode counters", () => {
	it("previews the next card and copy without using them, and saves the counter start", () => {
		const { db, actor } = fixture();
		const first = barcodePreview(db, getConfig(), "afterLegacyMax", NOW);
		expect(barcodePreview(db, getConfig(), "afterLegacyMax", NOW)).toEqual(first);
		expect(first.item).toMatch(/^2026-[A-Z]\d{4}$/);
		expect(first.card).toMatch(/^[A-Z]\d{6}$/);
		const sequence = sequenceValue(db, "card:CNNNNNN");
		const from = barcodePreview(db, getConfig(), 5000, NOW);
		expect(from.card).toBe(cardCode(5000));
		expect(sequenceValue(db, "card:CNNNNNN")).toBe(sequence);

		saveCounterStart(db, dir, 5000, actor, NOW);
		expect(getConfig().barcodes.patron.counterStart).toBe(5000);
		expect(
			JSON.parse(readFileSync(join(dir, "config.json"), "utf8")).barcodes.patron.counterStart,
		).toBe(5000);
	});

	it("names the templates in use that force their own barcode type", () => {
		expect(symbologyOverrides(getConfig(), dir)).toEqual([]);
		const template = join(dir, "cards", "templates", "default", "template.json");
		const raw = JSON.parse(readFileSync(template, "utf8")) as {
			barcode: Record<string, unknown>;
		};
		raw.barcode.symbology = "code39";
		writeFileSync(template, JSON.stringify(raw));
		expect(symbologyOverrides(loadConfig(dir).config, dir)).toEqual([
			{ kind: "cards", name: "default", symbology: "code39" },
		]);
		mkdirSync(join(dir, "labels", "templates", "broken"), { recursive: true });
	});
});
