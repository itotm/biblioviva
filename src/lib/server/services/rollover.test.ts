// SPDX-License-Identifier: GPL-3.0-or-later
import { classId, PATRON_RULES } from "../../../../tests/helpers/school.js";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, isNotNull } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "#lib/server/env.js";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { mirrorConfigTables } from "#lib/server/db/config-mirror.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { seedOptionsFromConfig } from "#lib/server/db/seed-config.js";
import { loadSchoolPresets } from "#lib/server/school/presets.js";
import type { Db } from "#lib/server/db/client.js";
import {
	auditLog,
	classGroup,
	classGroupLevel,
	classPhotoSheet,
	loan,
	patron,
	patronClass,
	staffUser,
} from "#lib/server/db/schema.js";
import { createBackup } from "./backup.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { addItems } from "./catalog-items.js";
import { checkinItem, checkoutItem } from "./circulation.js";
import { createPatron } from "./patrons.js";
import { quickSearchPatrons } from "./patron-search.js";
import {
	applyRollover,
	freshBackup,
	planRollover,
	RolloverError,
	rolloverPreview,
	type RolloverGroup,
	type RolloverStudent,
} from "./rollover.js";

const config = parseConfig(exampleRaw()).config;
const dirs: string[] = [];
const savedBackupDir = process.env.BACKUP_DIR;
afterEach(() => {
	if (savedBackupDir === undefined) {
		delete process.env.BACKUP_DIR;
	} else {
		process.env.BACKUP_DIR = savedBackupDir;
	}
	resetEnvCache();
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

type Pupil =
	"promote" | "repeat" | "move" | "bruno" | "quarta" | "leaver" | "stays" | "lender" | "teacher";

interface Fixture {
	db: Db;
	dataDir: string;
	actor: { id: number };
	s: Record<Pupil, number>;
	g: Record<"1A" | "2A" | "2B" | "4A" | "5A" | "5B", number>;
	itemIds: number[];
}

/** The class label of a patron now (the view of the reports). */
function labelOf(db: Db, id: number): string | null {
	return (
		db.select().from(patronClass).where(eq(patronClass.patronId, id)).get()?.classLabel ?? null
	);
}

function setup(): Fixture {
	const db = createTestDb();
	const dataDir = mkdtempSync(join(tmpdir(), "bv-rollover-"));
	dirs.push(dataDir);
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const g = {
		"1A": classId(db, "1", "A"),
		"2A": classId(db, "2", "A"),
		"2B": classId(db, "2", "B"),
		"4A": classId(db, "4", "A"),
		"5A": classId(db, "5", "A"),
		"5B": classId(db, "5", "B"),
	};
	const person = (lastName: string, level: string | null, group = "A"): number =>
		createPatron(
			db,
			{
				patronType: level === null ? "teacher" : "student",
				firstName: "Anna",
				lastName,
				levelCode: level ?? "",
				groupId: "",
				groupName: level === null ? "" : group,
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			PATRON_RULES,
		);
	const s = {
		promote: person("Sale", "1"),
		repeat: person("Ripete", "2"),
		move: person("Cambia", "2"),
		bruno: person("Bruno", "2", "B"),
		quarta: person("Quarta", "4"),
		leaver: person("Esce", "5"),
		stays: person("Resta", "5"),
		lender: person("Prestito", "5", "B"),
		teacher: person("Docente", null),
	};
	const rules = catalogRules(config);
	const biblio = createBiblio(
		db,
		{
			title: "Pinocchio",
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			author: "Collodi, Carlo",
			publisher: "Giunti",
			publicationPlace: "",
			publicationYear: "",
			isbn: "",
			issn: "",
			ean: "",
			physicalDescription: "",
			series: "",
			seriesNumber: "",
			dewey: "",
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
	const added = addItems(
		db,
		biblio,
		{
			readingLevel: "",
			enumeration: "",
			acquisitionDate: "",
			notes: "",
			notForLoan: false,
		},
		2,
		actor,
		rules,
	);
	const when = new Date("2026-06-01T08:00:00Z");
	checkoutItem(db, config, { patronId: s.lender, itemId: added.ids[0] ?? 0 }, actor, when);
	checkoutItem(db, config, { patronId: s.promote, itemId: added.ids[1] ?? 0 }, actor, when);
	return { db, dataDir, actor, s, g, itemIds: added.ids };
}

const NOW = new Date("2026-06-20T10:00:00Z");

describe("class upgrade", () => {
	it("previews the classes that move up, the leavers with their loans and the targets", () => {
		const { db, s, g } = setup();
		const preview = rolloverPreview(db, config, NOW);
		expect(
			preview.groups.map((x) => [x.label, x.nextLabel, x.fate, x.students.length]),
		).toEqual([
			["1 A", "2 A", "advances", 1],
			["2 A", "3 A", "advances", 2],
			["2 B", "3 B", "advances", 1],
			["4 A", "5 A", "advances", 1],
		]);
		expect(preview.leavers.map((l) => [l.id, l.classLabel, l.openLoans])).toEqual([
			[s.leaver, "5 A", 0],
			[s.lender, "5 B", 1],
			[s.stays, "5 A", 0],
		]);
		// the classes after the upgrade: the last year's ones close
		expect(preview.targets.map((t) => [t.id, t.label])).toEqual([
			[g["1A"], "2 A"],
			[g["2A"], "3 A"],
			[g["2B"], "3 B"],
			[g["4A"], "5 A"],
		]);
		const student = (id: number): RolloverStudent | undefined =>
			[...preview.groups.flatMap((x) => x.students), ...preview.leavers].find(
				(x) => x.id === id,
			);
		// a repeating pupil goes by default to the class of the same name hosting their year
		expect(student(s.repeat)).toMatchObject({
			nextLevel: "3",
			defaultGroupId: g["2A"],
			needsGroup: false,
			stayGroupId: g["1A"],
		});
		expect(student(s.stays)).toMatchObject({ nextLevel: null, stayGroupId: g["4A"] });
		expect(student(s.lender)?.stayGroupId).toBeNull();
		expect(preview.lastRunAt).toBeNull();
		expect(preview.recentRun).toBe(false);
	});

	it("plans promote, repeat, change of class, leaver confirmed, kept, blocked", () => {
		const { db, s, g } = setup();
		const preview = rolloverPreview(db, config, NOW);
		const plan = planRollover(preview, {
			[s.repeat]: { repeat: true },
			[s.move]: { group: g["2B"] },
			[s.stays]: { keep: true },
		});
		expect(plan.promote).toEqual([
			{ id: s.promote, levelCode: "2", groupId: g["1A"] },
			{ id: s.move, levelCode: "3", groupId: g["2B"] },
			{ id: s.bruno, levelCode: "3", groupId: g["2B"] },
			{ id: s.quarta, levelCode: "5", groupId: g["4A"] },
		]);
		expect(plan.repeat).toEqual([
			{ id: s.repeat, levelCode: "2", groupId: g["1A"] },
			{ id: s.stays, levelCode: "5", groupId: g["4A"] },
		]);
		expect(plan.remove).toEqual([s.leaver]);
		expect(plan.blocked.map((b) => b.id)).toEqual([s.lender]);
		expect(plan.unplaced).toEqual([]);
		expect(plan.groupChanges).toBe(3);
		// a class that will not host the pupil's year, or one that closes
		expect(() => planRollover(preview, { [s.move]: { group: g["1A"] } })).toThrow(
			expect.objectContaining({ code: "invalid_group" }) as Error,
		);
		expect(() => planRollover(preview, { [s.move]: { group: g["5A"] } })).toThrow(
			RolloverError,
		);
		// a kept leaver with no class of the same name waits for a choice
		expect(
			planRollover(preview, { [s.lender]: { keep: true } }).unplaced.map((x) => x.id),
		).toEqual([s.lender]);
	});

	it("needs a fresh backup, refuses while a leaver has books, then applies in one go", () => {
		const { db, dataDir, actor, s, g, itemIds } = setup();
		const decisions = {
			[s.repeat]: { repeat: true },
			[s.move]: { group: g["2B"] },
			[s.stays]: { keep: true },
		};
		expect(() =>
			applyRollover(
				{ db, config, dataDir },
				{ decisions, backup: "none.db", confirmRecent: false },
				actor,
				NOW,
			),
		).toThrow(expect.objectContaining({ code: "no_backup" }) as Error);
		// the backups folder of the test (BACKUP_DIR, a volume of its own in the container)
		process.env.BACKUP_DIR = mkdtempSync(join(tmpdir(), "bv-rollover-backups-"));
		dirs.push(process.env.BACKUP_DIR);
		resetEnvCache();
		const backup = createBackup(db, config.library.timezone, new Date()).name;
		expect(freshBackup(backup)).toBe(true);
		expect(() =>
			applyRollover(
				{ db, config, dataDir },
				{ decisions, backup, confirmRecent: false },
				actor,
				new Date(),
			),
		).toThrow(expect.objectContaining({ code: "blocked", detail: [s.lender] }) as Error);
		// the book comes back: the run can start
		checkinItem(db, config, itemIds[0] ?? 0, actor, NOW);
		const loanBefore = db.select().from(loan).where(eq(loan.patronId, s.promote)).get();
		// a class picture of the census goes with the year (Phase 13, Q106)
		const sheet = db
			.insert(classPhotoSheet)
			.values({
				classGroupId: g["2B"],
				path: "uploads/class-sheets/1/picture-1.jpg",
				width: 10,
				height: 10,
			})
			.returning({ id: classPhotoSheet.id })
			.get();
		mkdirSync(join(dataDir, "uploads", "class-sheets", String(sheet.id)), { recursive: true });
		writeFileSync(
			join(dataDir, "uploads", "class-sheets", String(sheet.id), "picture-1.jpg"),
			"x",
		);
		const result = applyRollover(
			{ db, config, dataDir },
			{ decisions, backup, confirmRecent: false },
			actor,
			new Date(),
		);
		expect(result).toEqual({
			promoted: 4,
			repeated: 2,
			removed: 2,
			groupChanges: 3,
			advanced: 4,
			archived: 2,
			classSheets: 1,
			backup,
		});
		expect(db.select().from(classPhotoSheet).all()).toEqual([]);
		expect(existsSync(join(dataDir, "uploads", "class-sheets"))).toBe(false);
		expect(labelOf(db, s.promote)).toBe("2 A");
		expect(labelOf(db, s.repeat)).toBe("2 A");
		expect(labelOf(db, s.move)).toBe("3 B");
		expect(labelOf(db, s.bruno)).toBe("3 B");
		expect(labelOf(db, s.quarta)).toBe("5 A");
		expect(labelOf(db, s.stays)).toBe("5 A");
		const row = (id: number): typeof patron.$inferSelect | undefined =>
			db.select().from(patron).where(eq(patron.id, id)).get();
		expect(row(s.stays)).toMatchObject({ levelCode: "5", status: "active" });
		expect(row(s.leaver)?.status).toBe("anonymized");
		expect(row(s.lender)?.status).toBe("anonymized");
		expect(labelOf(db, s.teacher)).toBe("Docenti");
		// the classes of the last year close; the others are the same groups, a year on
		const archived = db
			.select({ id: classGroup.id })
			.from(classGroup)
			.where(isNotNull(classGroup.archivedAt))
			.all()
			.map((r) => r.id);
		expect(archived.sort()).toEqual([g["5A"], g["5B"]].sort());
		// the open loan keeps its snapshot of the class at the time of the loan
		expect(db.select().from(loan).where(eq(loan.patronId, s.promote)).get()).toEqual(
			loanBefore,
		);
		expect(loanBefore?.classLabelSnapshot).toBe("1 A");
		expect(quickSearchPatrons(db, "esce", { locale: "it" })).toEqual([]);
		const logged = db
			.select()
			.from(auditLog)
			.where(eq(auditLog.action, "rollover.apply"))
			.get();
		expect(logged?.details).toEqual(result);
		// a second run within 180 days needs the extra confirmation
		expect(rolloverPreview(db, config).recentRun).toBe(true);
		expect(() =>
			applyRollover(
				{ db, config, dataDir },
				{ decisions: {}, backup, confirmRecent: false },
				actor,
				new Date(),
			),
		).toThrow(expect.objectContaining({ code: "recent" }) as Error);
	});

	it("keeps empty classes and pluriclassi, and asks the class into another stage", () => {
		const { db, s } = setup();
		const comprensivo = {
			...config,
			school: {
				...config.school,
				stages: [...config.school.stages, { code: "secondaria", name: "Secondaria" }],
				levels: [
					...config.school.levels,
					{ code: "S1", label: "1", name: "Prima secondaria", stage: "secondaria" },
					{ code: "S2", label: "2", name: "Seconda secondaria", stage: "secondaria" },
				],
				promotionAcrossStages: "ask" as const,
			},
		};
		// a new first class of the secondaria, still empty, and a pluriclasse 1-2 C
		const firstD = classId(db, "S1", "D");
		const mixed = classId(db, "1", "C");
		db.insert(classGroupLevel).values({ groupId: mixed, levelCode: "2" }).run();
		db.update(patron)
			.set({ classGroupId: mixed, levelCode: "2" })
			.where(eq(patron.id, s.bruno))
			.run();
		db.update(patron)
			.set({ classGroupId: mixed, levelCode: "1" })
			.where(eq(patron.id, s.promote))
			.run();
		const preview = rolloverPreview(db, comprensivo, NOW);
		const group = (id: number): RolloverGroup | undefined =>
			preview.groups.find((x) => x.id === id);
		expect(group(mixed)).toMatchObject({ label: "1-2 C", nextLabel: "1-2 C", fate: "stays" });
		expect(preview.targets.find((t) => t.id === firstD)?.levels).toEqual(["S1"]);
		const student = (id: number): RolloverStudent | undefined =>
			preview.groups.flatMap((x) => x.students).find((x) => x.id === id);
		// moving up inside the pluriclasse; out of it a class is needed
		expect(student(s.promote)).toMatchObject({ defaultGroupId: mixed, needsGroup: false });
		expect(student(s.bruno)).toMatchObject({ nextLevel: "3", needsGroup: true });
		// 5ª primaria → 1ª secondaria: the class is asked, nobody leaves
		expect(preview.leavers).toEqual([]);
		const quinta = preview.groups.flatMap((x) => x.students).filter((x) => x.levelCode === "5");
		expect(quinta.every((x) => x.crossing && x.needsGroup && x.nextLevel === "S1")).toBe(true);
		const plan = planRollover(preview, {});
		expect(plan.unplaced.map((x) => x.id).sort()).toEqual(
			[s.bruno, s.leaver, s.stays, s.lender].sort(),
		);
		const chosen = planRollover(
			preview,
			Object.fromEntries([s.leaver, s.stays, s.lender].map((id) => [id, { group: firstD }])),
		);
		expect(chosen.unplaced.map((x) => x.id)).toEqual([s.bruno]);
		expect(chosen.promote.filter((m) => m.groupId === firstD)).toHaveLength(3);
	});
});

// step 12.8 (left from 12.5): the upgrade on a generated istituto comprensivo
describe("class upgrade of a seeded comprensivo", () => {
	it("keeps the infanzia sections, asks the class across stages, lets the third media go", () => {
		const preset = loadSchoolPresets().find((p) => p.id === "it-comprensivo");
		expect(preset).toBeDefined();
		if (!preset) {
			return;
		}
		const comprensivo = {
			...config,
			school: { ...config.school, ...preset.school, preset: preset.id },
			classification: { ...config.classification, readingLevels: preset.readingLevels },
		};
		const db = createTestDb();
		mirrorConfigTables(db, comprensivo);
		seedDatabase(db, {
			...seedOptionsFromConfig(comprensivo),
			patrons: 120,
			teachers: 4,
			biblios: 20,
			items: 20,
			loans: 0,
		});
		// the new first class of the primaria, made before the upgrade: it waits for its pupils
		const newFirst = classId(db, "P1", "E");
		const preview = rolloverPreview(db, comprensivo, NOW);
		const fates = new Map(preview.groups.map((g) => [g.label, g.fate]));
		expect(fates.get("Infanzia A")).toBe("stays");
		expect(fates.get("1ª A")).toBe("advances");
		expect(fates.get("5ª A")).toBe("archived");
		expect(fates.get("2ª media A")).toBe("advances");
		const students = preview.groups.flatMap((g) => g.students);
		// the five-year-olds and the fifth class go to another stage: their class is asked
		const crossing = students.filter((s) => s.crossing);
		expect(new Set(crossing.map((s) => s.levelCode))).toEqual(new Set(["I5", "P5"]));
		expect(crossing.every((s) => s.needsGroup)).toBe(true);
		// the third media leaves the school
		expect(new Set(preview.leavers.map((s) => s.levelCode))).toEqual(new Set(["S3"]));
		// the younger children stay in their section, a year older
		const toddler = students.find((s) => s.levelCode === "I3");
		expect(toddler).toMatchObject({ nextLevel: "I4", needsGroup: false });
		expect(toddler?.defaultGroupId).toBe(toddler?.groupId);
		// the empty new class hosts the five-year-olds; nothing hosts the first media yet
		expect(preview.targets.find((t) => t.id === newFirst)?.levels).toEqual(["P1"]);
		expect(preview.targets.some((t) => t.levels.includes("S1"))).toBe(false);
		const fives = crossing.filter((s) => s.levelCode === "I5");
		const plan = planRollover(
			preview,
			Object.fromEntries(fives.map((s) => [s.id, { group: newFirst }])),
		);
		expect(plan.unplaced.map((s) => s.levelCode).every((l) => l === "P5")).toBe(true);
		expect(plan.promote.filter((m) => m.groupId === newFirst)).toHaveLength(fives.length);
	});
});

describe("class upgrade where the path splits (9.41)", () => {
	it("asks each pupil the way on: the class follows the first, the others find a class or leave", () => {
		// a Dutch brugklas: then havo (the default), vmbo or vwo; havo 2 ends the school here
		const dutch = {
			...config,
			school: {
				...config.school,
				stages: [
					{ code: "bk", name: "Brugklas" },
					{ code: "vo", name: "Voortgezet", classLabel: "{level}{group}" },
				],
				levels: [
					{
						code: "1",
						label: "1",
						name: "Brugklas",
						stage: "bk",
						next: ["H2", "M2", null],
					},
					{ code: "H2", label: "h2", name: "Havo 2", stage: "vo", next: null },
					{ code: "M2", label: "m2", name: "Vmbo 2", stage: "vo", next: null },
				],
				promotionWithinStage: "keep" as const,
				promotionAcrossStages: "keep" as const,
			},
		};
		const db = createTestDb();
		mirrorConfigTables(db, dutch);
		const brugA = classId(db, "1", "a");
		const vmboA = classId(db, "M2", "a");
		const now = new Date().toISOString();
		const pupil = (lastName: string): number =>
			db
				.insert(patron)
				.values({
					patronType: "student",
					firstName: "Anna",
					lastName,
					searchName: lastName.toLowerCase(),
					levelCode: "1",
					classGroupId: brugA,
					createdAt: now,
					updatedAt: now,
				})
				.returning({ id: patron.id })
				.get().id;
		const havo = pupil("Havo");
		const vmbo = pupil("Vmbo");
		const leaves = pupil("Weg");
		const preview = rolloverPreview(db, dutch, NOW);
		// the class goes on to the first choice, with its pupils
		const group = preview.groups.find((g) => g.id === brugA);
		expect(group?.nextLabel).toBe("h2a");
		const student = group?.students.find((s) => s.id === vmbo);
		expect(student?.choices.map((c) => c.level)).toEqual(["H2", "M2", null]);
		// another way: the class of the same name there (vmbo 2 a, made before the upgrade)
		expect(student?.choices[1]).toMatchObject({ defaultGroupId: vmboA, needsGroup: false });
		const plan = planRollover(preview, { [vmbo]: { next: "M2" }, [leaves]: { next: null } });
		expect(plan.promote).toEqual(
			expect.arrayContaining([
				{ id: havo, levelCode: "H2", groupId: brugA },
				{ id: vmbo, levelCode: "M2", groupId: vmboA },
			]),
		);
		expect(plan.remove).toEqual([leaves]);
		expect(() => planRollover(preview, { [vmbo]: { next: "X9" } })).toThrow(RolloverError);
		// a choice whose class is still to pick waits for it
		db.update(classGroup).set({ name: "z" }).where(eq(classGroup.id, vmboA)).run();
		const again = rolloverPreview(db, dutch, NOW);
		const waiting = planRollover(again, { [vmbo]: { next: "M2" } });
		expect(waiting.unplaced.map((s) => s.id)).toEqual([vmbo]);
		expect(planRollover(again, { [vmbo]: { next: "M2", group: vmboA } }).unplaced).toEqual([]);
		// into another stage with "ask": every way is asked, whatever the names of the classes
		db.update(classGroup).set({ name: "a" }).where(eq(classGroup.id, vmboA)).run();
		const asking = rolloverPreview(
			db,
			{ ...dutch, school: { ...dutch.school, promotionAcrossStages: "ask" as const } },
			NOW,
		);
		const asked = asking.groups.flatMap((g) => g.students).find((s) => s.id === vmbo);
		expect(asked?.choices.filter((c) => c.level !== null).every((c) => c.needsGroup)).toBe(
			true,
		);
	});
});
