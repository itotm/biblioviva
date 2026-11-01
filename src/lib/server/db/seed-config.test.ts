// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import { loadSchoolPresets, presetGroups, type SchoolPreset } from "#lib/server/school/presets.js";
import { buildCodeTable } from "#lib/shared/barcodes/table.js";
import { recognise } from "#lib/shared/scan.js";
import { wizardCodeFormats } from "#lib/shared/setup-school.js";
import { mirrorConfigTables } from "./config-mirror.js";
import type { Db } from "./client.js";
import { seedDatabase } from "./seed.js";
import { seedOptionsFromConfig } from "./seed-config.js";

const base = parseConfig(exampleRaw()).config;
const SMALL = { patrons: 60, teachers: 4, biblios: 40, items: 50, loans: 80 };

/** The example configuration with the school of a preset, as the wizard writes it. */
function configFor(p: SchoolPreset): AppConfig {
	return {
		...base,
		school: {
			...base.school,
			...p.school,
			preset: p.id,
			teacherGroupName: p.teacherGroup,
		},
		classification: { ...base.classification, readingLevels: p.readingLevels },
	};
}

const rows = <T>(db: Db, sql: string): T[] => db.$client.query<T, []>(sql).all();

describe("demo data from the configuration", () => {
	it.each(loadSchoolPresets().map((p) => [p.id, p] as const))(
		"%s: classes, levels, labels and reading levels follow the preset",
		(_id, preset) => {
			const config = configFor(preset);
			const db = createTestDb();
			mirrorConfigTables(db, config);
			seedDatabase(db, { ...seedOptionsFromConfig(config), ...SMALL });
			// every class of the preset, and the teachers group
			const groups = rows<{ kind: string; n: number }>(
				db,
				"SELECT kind, COUNT(*) AS n FROM class_group GROUP BY kind ORDER BY kind",
			);
			expect(groups).toEqual([
				{ kind: "students", n: presetGroups(preset).length },
				{ kind: "teachers", n: 1 },
			]);
			// every pupil has a level their class hosts; every teacher is in the teachers group
			expect(
				rows<{ n: number }>(
					db,
					`SELECT COUNT(*) AS n FROM patron p WHERE p.patron_type = 'student' AND NOT EXISTS (
						SELECT 1 FROM class_group_level l WHERE l.group_id = p.class_group_id AND l.level_code = p.level_code)`,
				)[0]?.n,
			).toBe(0);
			expect(
				rows<{ n: number }>(
					db,
					"SELECT COUNT(*) AS n FROM patron p JOIN class_group g ON g.id = p.class_group_id WHERE p.patron_type = 'teacher' AND g.kind <> 'teachers'",
				)[0]?.n,
			).toBe(0);
			// the loans' photo of the class matches the class now (nobody moved yet)
			expect(
				rows<{ n: number }>(
					db,
					`SELECT COUNT(*) AS n FROM loan l JOIN patron_class c ON c.patron_id = l.patron_id
						WHERE l.class_label_snapshot IS NOT c.class_label OR l.stage_snapshot IS NOT c.stage`,
				)[0]?.n,
			).toBe(0);
			// the reading levels are the configuration's, or none
			const codes = new Set(config.classification.readingLevels.map((l) => l.code));
			const used = rows<{ r: string | null }>(
				db,
				"SELECT DISTINCT reading_level AS r FROM biblio",
			);
			expect(used.every((u) => u.r === null || codes.has(u.r))).toBe(true);
			if (codes.size === 0) {
				expect(used.every((u) => u.r === null)).toBe(true);
			}
		},
	);

	it("generates the codes of the chosen formats and stays deterministic", () => {
		const comprensivo = loadSchoolPresets().find((p) => p.id === "it-comprensivo");
		expect(comprensivo).toBeDefined();
		if (!comprensivo) {
			return;
		}
		const { formats } = wizardCodeFormats({
			item: "prefix",
			card: "prefix",
			check: "damm",
			layout: "it",
		});
		const codes = buildCodeTable(formats);
		const make = (): Db => {
			const db = createTestDb();
			seedDatabase(db, { ...seedOptionsFromConfig(configFor(comprensivo)), codes, ...SMALL });
			return db;
		};
		const a = make();
		const cards = rows<{ c: string }>(a, "SELECT card_number AS c FROM patron");
		expect(
			cards.every((r) => r.c.startsWith("T") && recognise(r.c, codes).kind === "card"),
		).toBe(true);
		const items = rows<{ b: string }>(a, "SELECT barcode AS b FROM item");
		expect(
			items.every((r) => r.b.startsWith("L-") && recognise(r.b, codes).kind === "item"),
		).toBe(true);
		const names = (db: Db): unknown[] =>
			rows(db, "SELECT last_name, level_code FROM patron ORDER BY id");
		expect(names(make())).toEqual(names(a));
	});

	it("names the patrons in the language of the school's country", () => {
		const presets = new Map(loadSchoolPresets().map((p) => [p.id, p]));
		const fr = presets.get("fr-elementaire");
		const generic = presets.get("generic");
		expect(fr && seedOptionsFromConfig(configFor(fr)).country).toBe("FR");
		// a preset without a country: the installation's language
		const config = generic ? configFor(generic) : base;
		expect(
			seedOptionsFromConfig({ ...config, ui: { ...config.ui, locale: "de" } }).country,
		).toBe("DE");
	});
});
