// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { seedDatabase } from "./seed.js";
import {
	CENSUS_DEMO_CLASS,
	DEMO_PHOTOS_DIR,
	planDemoPhotos,
	readPortraits,
	seedPatronPhotos,
	type PatronRow,
} from "./seed-photos.js";

const settings = { width: 48, height: 64, quality: 60, maxUploadBytes: 1_000_000 };
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-seed-photos-"));
	dirs.push(d);
	return d;
};
const small = { patrons: 40, teachers: 6, biblios: 5, items: 5, loans: 0 };

describe("demo portraits", () => {
	it("ships 30 portraits, each listed once and present on disk", () => {
		const portraits = readPortraits(DEMO_PHOTOS_DIR);
		expect(portraits).toHaveLength(30);
		expect(new Set(portraits.map((p) => p.file)).size).toBe(30);
		for (const p of portraits) {
			expect(existsSync(join(DEMO_PHOTOS_DIR, p.file))).toBe(true);
		}
		// every pool used by the seed has faces of its own
		expect(portraits.some((p) => p.age !== "child" && p.sex !== "m")).toBe(true);
		expect(portraits.some((p) => p.age !== "child" && p.sex !== "f")).toBe(true);
	});

	it("plans faces by gender and age, shares them, skips every other patron and the demo class", () => {
		const portraits = readPortraits(DEMO_PHOTOS_DIR);
		const byFile = new Map(portraits.map((p) => [p.file, p]));
		const row = (id: number, extra: Partial<PatronRow>): PatronRow => ({
			id,
			firstName: "Marco",
			patronType: "student",
			level: "1",
			group: "A",
			photoPath: null,
			...extra,
		});
		const patrons: PatronRow[] = [
			...Array.from({ length: 40 }, (_, i) =>
				row(i + 1, { firstName: i % 4 === 0 ? "Giulia" : "Marco" }),
			),
			row(41, { ...CENSUS_DEMO_CLASS }),
			row(42, { firstName: "Paolo", patronType: "teacher", level: null, group: null }),
			row(43, { firstName: "Anna", patronType: "teacher", level: null, group: null }),
			row(44, { firstName: "Laura", patronType: "teacher", level: null, group: null }),
			row(45, { photoPath: "uploads/patrons/45/existing.webp" }),
		];
		const plan = planDemoPhotos(patrons, portraits);
		// every other eligible patron: 1, 3, …, 39, then 42 and 44 (41 is in the demo class)
		expect([...plan.keys()].filter((id) => id <= 40)).toEqual(
			Array.from({ length: 20 }, (_, i) => 2 * i + 1),
		);
		expect(plan.has(41)).toBe(false);
		expect(plan.has(43)).toBe(false);
		expect(plan.has(45)).toBe(false);
		const teacher = byFile.get(plan.get(42) ?? "");
		expect(teacher?.age).not.toBe("child");
		expect(teacher?.sex).not.toBe("f");
		const female = byFile.get(plan.get(44) ?? "");
		expect(female?.age).not.toBe("child");
		expect(female?.sex).not.toBe("m");
		for (const [id, file] of plan) {
			const portrait = byFile.get(file);
			expect(portrait?.age).not.toBe(id >= 42 ? "child" : "adult");
		}
		// with 20 students on fewer faces, faces are reused
		expect(new Set([...plan.values()]).size).toBeLessThan(plan.size);
	});
});

describe("seedPatronPhotos", () => {
	it("stores about half of the patrons' photos like real ones, deterministically", async () => {
		const runs = [];
		for (let i = 0; i < 2; i++) {
			const db = createTestDb();
			seedDatabase(db, small);
			const dataDir = temp();
			const stored = await seedPatronPhotos(db, dataDir, settings);
			const rows = db.$client
				.query<{ id: number; p: string | null; l: string | null; g: string | null }, []>(
					`SELECT p.id, p.photo_path AS p, p.level_code AS l, g.name AS g
					FROM patron p LEFT JOIN class_group g ON g.id = p.class_group_id ORDER BY p.id`,
				)
				.all();
			runs.push({ db, dataDir, stored, rows });
		}
		const [a, b] = runs;
		if (!a || !b) {
			throw new Error("two runs expected");
		}
		const total = small.patrons + small.teachers;
		expect(a.stored).toBeGreaterThan(total * 0.4);
		expect(a.stored).toBeLessThanOrEqual(total / 2);
		expect(a.rows.filter((r) => r.p).length).toBe(a.stored);
		expect(a.rows.map((r) => r.p)).toEqual(b.rows.map((r) => r.p));
		// the census demo class has no photo at all
		const demoClass = a.rows.filter(
			(r) => r.l === CENSUS_DEMO_CLASS.level && r.g === CENSUS_DEMO_CLASS.group,
		);
		expect(demoClass.length).toBeGreaterThan(0);
		expect(demoClass.every((r) => r.p === null)).toBe(true);
		// main and thumbnail in the configured format and size
		const first = a.rows.find((r) => r.p)?.p ?? "";
		const main = new Uint8Array(readFileSync(join(a.dataDir, first)));
		expect(await new Bun.Image(main).metadata()).toMatchObject({
			width: 48,
			height: 64,
			format: "webp",
		});
		const thumb = new Uint8Array(
			readFileSync(join(a.dataDir, first.replace("-main-", "-thumb-"))),
		);
		expect(await new Bun.Image(thumb).metadata()).toMatchObject({ width: 12, height: 16 });
		// a second run leaves the photos already there alone
		expect(await seedPatronPhotos(a.db, a.dataDir, settings)).toBe(0);
	});
});
