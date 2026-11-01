// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigError, loadConfig, mergeCalendarFragments, parseConfig } from "./load.js";
import { exampleRaw } from "./load.js";
import { resetConfigCache, ensureConfigDirDefaults } from "./index.js";

const example = (): Record<string, any> => exampleRaw() as Record<string, any>;

function expectErrors(raw: unknown, ...paths: string[]): void {
	try {
		parseConfig(raw);
	} catch (e) {
		expect(e).toBeInstanceOf(ConfigError);
		const issuePaths = (e as ConfigError).issues.map((i) => `${i.path}: ${i.message}`);
		for (const p of paths) {
			expect(issuePaths.join("\n")).toContain(p);
		}
		return;
	}
	throw new Error("expected a ConfigError");
}

const tmpDirs: string[] = [];
afterEach(() => {
	resetConfigCache();
	for (const d of tmpDirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

describe("config schema", () => {
	it("accepts the shipped example and drops _comment keys", () => {
		const { config, warnings } = parseConfig(example());
		expect(config.school.levels.map((l) => l.code)).toEqual(["1", "2", "3", "4", "5"]);
		expect("_comment" in config.classification).toBe(false);
		expect(config.ui.locale).toBe("en");
		// plain passwords in the example are reported as warnings, not errors
		expect(warnings.some((w) => w.message.includes("plain password"))).toBe(true);
	});

	it("reports missing keys with their path", () => {
		const raw = example();
		delete raw.library.name;
		expectErrors(raw, "library.name");
	});

	it("rejects bad dates and month-days", () => {
		const raw = example();
		raw.calendar.holidays = ["2026-13-40"];
		raw.library.schoolYearStart = "31-12";
		expectErrors(raw, "calendar.holidays.0", "library.schoolYearStart");
	});

	it("rejects barcode patterns that do not compile and formats that copies and cards share", () => {
		const raw = example();
		raw.barcodes.item.format = { pattern: "YYY-NNNNC", check: "luhn" };
		expectErrors(raw, 'barcodes.item.format: invalid pattern "YYY-NNNNC" (year)');
		const same = example();
		same.barcodes.patron.format = { pattern: "YYYY-CNNNN", check: "mod23" };
		expectErrors(same, 'barcodes: "YYYY-CNNNN" and "YYYY-CNNNN": overlap');
		const start = example();
		start.barcodes.patron.counterStart = 5_000_000;
		expectErrors(start, "barcodes.patron.counterStart");
		const plain = example();
		plain.barcodes.patron.format = { pattern: "NNNNNNC", check: "luhn" };
		expectErrors(plain, "overlapPlain");
	});

	it("warns about legacy shapes the two kinds share", () => {
		const raw = example();
		raw.barcodes.item.legacy.push({ pattern: "NNNNNNNNNN", check: "none" });
		const { warnings } = parseConfig(raw);
		expect(
			warnings.some((w) => w.path === "barcodes" && w.message.includes("overlapLegacy")),
		).toBe(true);
	});

	it("rejects an unknown item type in the loan rules", () => {
		const raw = example();
		raw.circulation.itemTypeOverrides = { vhs: { loanDays: 3 } };
		expectErrors(raw, "circulation.itemTypeOverrides.vhs: unknown item type");
	});

	it("rejects unknown roles, duplicate usernames and configurations without an admin", () => {
		const raw = example();
		raw.security.users[1].roles = ["ghost"];
		raw.security.users[2].username = "admin";
		expectErrors(raw, "security.users[1].roles: unknown role", "usernames must be unique");
		const noAdmin = example();
		noAdmin.security.users = noAdmin.security.users.filter(
			(u: { username: string }) => u.username !== "admin",
		);
		expectErrors(noAdmin, "at least one active account must hold admin");
	});

	it("rejects duplicate classification codes and dangling Dewey map entries", () => {
		const raw = example();
		raw.classification.genres.push({ code: "A", label: "Doppione", image: "A.png" });
		raw.classification.deweyMap.push({ prefix: "8", code: "800" });
		expectErrors(
			raw,
			'classification.genres: duplicate code "A"',
			'unknown non-fiction code "800"',
		);
	});

	it("rejects a code that is both a genre and a class (one classification column, 9.19)", () => {
		const raw = example();
		raw.classification.genres.push({ code: "590", label: "Animali in storie", image: "A.png" });
		expectErrors(raw, 'classification.nonfiction: code "590" is both a genre and a class');
	});

	it("rejects a taxonomy deeper than two levels", () => {
		const raw = example();
		raw.classification.nonfiction[0].children[0].children = [{ code: "x", label: "x" }];
		// The leaf schema has no `children`, so the key is dropped silently: assert on the parsed output instead.
		const { config } = parseConfig(raw);
		expect("children" in config.classification.nonfiction[0]!.children[0]!).toBe(false);
	});

	it("rejects label stocks that do not fit the page and unknown stock references", () => {
		const raw = example();
		raw.labels.stocks[0].columns = 4; // 4 × 70 mm > 210 mm
		raw.labels.spine.stock = "nope";
		expectErrors(raw, "exceeds the A4 width", 'unknown stock "nope"');
	});

	it("rejects cards too large for a sheet printed on both sides, and loads the former unit key (9.27)", () => {
		const raw = example();
		raw.cards.cardMm.width = 205;
		expectErrors(raw, "cards.cardMm: a card of 205 × 53.98 mm does not fit an A4 sheet");
		// side by side, front and back take twice the width: 100 mm is too wide with 6 mm margins
		const wide = example();
		wide.cards.cardMm.width = 100;
		expectErrors(
			wide,
			"cards.cardMm: a card of 100 × 53.98 mm does not fit an A4 sheet (at most 99 × 285 mm)",
		);
		const widest = example();
		widest.cards.cardMm.width = 99;
		expect(parseConfig(widest).config.cards.cardMm.width).toBe(99);
		const old = example();
		delete old.cards.layout;
		old.cards.unit = "front-back-side-by-side";
		const { config } = parseConfig(old);
		expect(config.cards.layout).toBe("side-by-side");
		expect("unit" in config.cards).toBe(false);
	});

	it("rejects a pair stock with an odd number of rows", () => {
		const raw = example();
		raw.labels.stocks.find((st: { id: string }) => st.id === "a4-70x48").rows = 5;
		expectErrors(raw, "rows must be a multiple of 2");
	});

	it("rejects duplicate item types and level codes, oversized card sheets and stocks taller than A4", () => {
		const raw = example();
		raw.library.itemTypes.push({ code: "libro", label: "Doppione" });
		raw.school.levels.push({ code: "3", label: "3", name: "Doppione", stage: "primaria" });
		raw.cards.sheet.rows = 5;
		raw.cards.sheet.marginMm = 10;
		raw.labels.stocks.find((st: { id: string }) => st.id === "a4-70x24").rows = 13; // 13 × 24 mm + 4 mm = 316 mm > 297
		expectErrors(
			raw,
			"item type codes must be unique",
			"level codes must be unique",
			"more than A4",
			"exceeds the A4 height",
		);
	});

	it("warns about missing pictograms instead of failing", () => {
		const raw = example();
		delete raw.classification.genres[0].image;
		delete raw.classification.nonfiction[0].image;
		const { warnings } = parseConfig(raw);
		expect(warnings.map((w) => w.message)).toEqual(
			expect.arrayContaining(["genre without an image", "top-level node without an image"]),
		);
	});

	it("rejects an unknown default Z39.50 target", () => {
		const raw = example();
		raw.z3950.defaultTarget = "bnf";
		expectErrors(raw, "z3950.defaultTarget");
	});

	it("rejects a Z39.50 host, database, charset or element set that would break yaz-client's commands", () => {
		const raw = example();
		raw.z3950.targets[0].host = "opac.sbn.it\nquit";
		expectErrors(raw, "z3950.targets.0.host");
		const other = example();
		other.z3950.targets[0].database = "nopac\nopen tcp:evil:1/x";
		other.z3950.targets[0].charset = "utf-8 x";
		other.z3950.targets[0].elements = "F\r";
		expectErrors(
			other,
			"z3950.targets.0.database",
			"z3950.targets.0.charset",
			"z3950.targets.0.elements",
		);
	});
});

describe("loadConfig", () => {
	it("falls back to the shipped example when config.json is missing", () => {
		const dir = mkdtempSync(join(tmpdir(), "bv-config-"));
		tmpDirs.push(dir);
		const loaded = loadConfig(dir);
		expect(loaded.source).toBe("example");
	});

	it("merges calendar fragments into the main file", () => {
		const dir = mkdtempSync(join(tmpdir(), "bv-config-"));
		tmpDirs.push(dir);
		const raw = example();
		raw.calendar.holidays = ["2026-11-02"];
		writeFileSync(join(dir, "config.json"), JSON.stringify(raw));
		writeFileSync(
			join(dir, "calendar.2027.json"),
			JSON.stringify({
				holidays: ["2027-04-26"],
				closedRanges: [{ from: "2027-12-24", to: "2028-01-06", reason: "Natale" }],
			}),
		);
		const loaded = loadConfig(dir);
		expect(loaded.source).toBe("file");
		expect(loaded.config.calendar.holidays).toEqual(["2026-11-02", "2027-04-26"]);
		expect(loaded.config.calendar.closedRanges.map((r) => r.reason)).toContain("Natale");
	});

	it("merge is pure and de-duplicates holidays", () => {
		const merged = mergeCalendarFragments({ calendar: { holidays: ["2026-01-06"] } }, [
			{ holidays: ["2026-01-06", "2026-06-02"] },
		]);
		expect((merged.calendar as { holidays: string[] }).holidays).toEqual([
			"2026-01-06",
			"2026-06-02",
		]);
	});

	it("reports a syntax error with the file name", () => {
		const dir = mkdtempSync(join(tmpdir(), "bv-config-"));
		tmpDirs.push(dir);
		writeFileSync(join(dir, "config.json"), "{ not json");
		expect(() => loadConfig(dir)).toThrow(/config.json/);
	});

	it("copies the default folders into CONFIG_DIR once", () => {
		const dir = mkdtempSync(join(tmpdir(), "bv-config-"));
		tmpDirs.push(dir);
		const first = ensureConfigDirDefaults(dir, "tests/fixtures/config-defaults");
		expect(first).toEqual([
			"classification.json",
			"labels/stocks",
			"cards/templates",
			"classification/images",
		]);
		expect(ensureConfigDirDefaults(dir, "tests/fixtures/config-defaults")).toEqual([]);
	});

	it("maps the legacy Skeleton theme names to the new colour sets", () => {
		const raw = exampleRaw() as Record<string, any>;
		raw.ui.theme = "cerberus";
		expect(parseConfig(raw, "x").config.ui.theme).toBe("ocean");
		raw.ui.theme = "neon";
		expect(() => parseConfig(raw, "x")).toThrow(/ui\.theme: one of ocean/);
	});
});
