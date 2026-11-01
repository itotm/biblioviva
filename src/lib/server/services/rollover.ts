// SPDX-License-Identifier: GPL-3.0-or-later
// "Avanza di classe" (PLAN.md step 7.1, Phase 12.5, Q32/Q47/Q94/Q100): started by the administrator,
// never by a date. Every pupil moves to the next level of the school (`school.levels`), and the
// classes follow the configured rule: within a stage a class advances with its pupils (`3 B` becomes
// `4 B`, the same group) or lets them go (`clear`); into another stage (5ª primaria → 1ª media in an
// istituto comprensivo) the pupils stay in the school and keep their class, lose it, or wait for the
// operator to choose (`ask`). A pluriclasse keeps its levels: its pupils move up inside it while it
// hosts their new level, otherwise they are placed in another class. Pupils of a last level leave
// the school — anonymized at once (2.9) — unless unticked; a leaver who still has books blocks the
// run. A repeating pupil stays at the level and joins the class that will host it (by default the
// one with the same name). An empty class stays at its level (a new first class waits for its
// pupils). Classes left empty by the upgrade are archived. One transaction, an
// audit row with counts only, a fresh backup required first, an extra confirmation when the last
// upgrade ran less than 180 days ago. Teachers and their groups are never touched. Where the path
// splits (9.41: a level whose next is a list of choices) every pupil is asked which: the class
// advances to the first choice, a pupil who takes another is placed in a class hosting it (or left
// without one by the promotion rules), and the choice "leaves" makes a leaver.
import { openLoansOfPatronSql } from "#lib/server/db/conditions.js";
import { ServiceError } from "#lib/server/errors.js";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { ServerContext } from "#lib/server/context.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { auditLog, classGroup, classGroupLevel, patron } from "#lib/server/db/schema.js";
import { schoolOf } from "#lib/server/school/structure.js";
import {
	classLabel,
	compareGroups,
	groupLabel,
	levelOf,
	nextChoices,
	nextLevel,
	type ClassGroupInfo,
	type SchoolStructure,
} from "#lib/shared/school.js";
import { anonymizePatron } from "./anonymize.js";
import { deleteAllSheets } from "./class-sheet-erasure.js";
import { audit, type AuditActor } from "./audit.js";
import { listBackups } from "./backup.js";
import { groupsById } from "./class-groups.js";

export const RECENT_DAYS = 180;
/** The backup taken in step 1 must be this recent when the upgrade is applied. */
export const BACKUP_MAX_AGE_MINUTES = 120;

export interface RolloverStudent {
	id: number;
	firstName: string;
	lastName: string;
	levelCode: string;
	groupId: number;
	/** The class now (`3 B`). */
	classLabel: string;
	openLoans: number;
	/** The level of the next school year; null when the pupil leaves the school. */
	nextLevel: string | null;
	/** The next level is in another stage (5ª primaria → 1ª media). */
	crossing: boolean;
	/** Where the pupil goes by default: the class (after the upgrade), or null (no class, or a choice). */
	defaultGroupId: number | null;
	/** A choice of class is needed (`ask`, or a pluriclasse that does not host the new level). */
	needsGroup: boolean;
	/**
	 * The class if the pupil repeats the year (or a leaver stays): the one hosting the level after
	 * the upgrade with the same name as theirs (`3 B` repeats in the new `3 B`); null when none.
	 */
	stayGroupId: number | null;
	/**
	 * Where the path splits (9.41), each choice with where it places the pupil, the default first
	 * (`nextLevel`); empty where it does not.
	 */
	choices: RolloverChoice[];
}

/** One way on after a level where the path splits; `level` null: the pupil leaves the school. */
export interface RolloverChoice {
	level: string | null;
	crossing: boolean;
	defaultGroupId: number | null;
	needsGroup: boolean;
}

export interface RolloverGroup {
	id: number;
	/** The class now and after the upgrade (`3 B` → `4 B`; the same when it stays). */
	label: string;
	nextLabel: string;
	/** What happens to the class: it advances, keeps its levels, or empties and is archived. */
	fate: "advances" | "stays" | "archived";
	students: RolloverStudent[];
}

/** A class a pupil can be placed in, as it will be after the upgrade. */
export interface RolloverTarget {
	id: number;
	/** The group's name (`B`): a repeating pupil goes by default to the class with the same name. */
	name: string;
	label: string;
	levels: string[];
}

export interface RolloverPreview {
	/** Classes whose pupils move up (leavers excluded), in class order. */
	groups: RolloverGroup[];
	/** Pupils of a last level: they leave unless unticked. */
	leavers: RolloverStudent[];
	/** The classes after the upgrade (the choices for repeating pupils and changes of class). */
	targets: RolloverTarget[];
	lastRunAt: string | null;
	/** The last upgrade ran less than 180 days ago: an extra confirmation is asked. */
	recentRun: boolean;
	/** The years of the school by code, for the choices of a path that splits. */
	levels: { code: string; name: string }[];
}

/**
 * Per-pupil exceptions: `repeat` keeps the level, `keep` keeps a leaver (repeating the last
 * level), `group` places the pupil in a class (one of the targets), `next` takes one of the
 * choices of a path that splits (9.41; `null`: leaves the school).
 */
export type RolloverDecisions = Readonly<
	Record<number, { repeat?: boolean; keep?: boolean; group?: number; next?: string | null }>
>;

export interface RolloverMove {
	id: number;
	levelCode: string;
	groupId: number | null;
}

export interface RolloverPlan {
	promote: RolloverMove[];
	repeat: RolloverMove[];
	remove: number[];
	/** Leavers to remove who still have books: the run cannot start. */
	blocked: RolloverStudent[];
	/** Pupils who need a class and have none chosen: the run cannot start. */
	unplaced: RolloverStudent[];
	groupChanges: number;
}

export class RolloverError extends ServiceError {
	constructor(
		override readonly code:
			"blocked" | "recent" | "no_backup" | "invalid_group" | "invalid_level" | "unplaced",
		readonly detail?: unknown,
	) {
		super(code, `rollover: ${code}`);
		this.name = "RolloverError";
	}
}

/**
 * The levels a class hosts after the upgrade, and whether it advances: a class of one level with
 * pupils in it. An empty class stays as it is (a new first-year class made before the upgrade
 * waits for its pupils), and so does a pluriclasse.
 */
function nextOfGroup(
	school: SchoolStructure,
	group: ClassGroupInfo,
	occupied: ReadonlySet<number>,
): { levels: string[]; fate: RolloverGroup["fate"] } {
	if (group.levels.length !== 1 || !occupied.has(group.id)) {
		return { levels: group.levels, fate: "stays" };
	}
	const level = group.levels[0] ?? "";
	if (school.promotion.withinStage === "clear") {
		return { levels: group.levels, fate: "stays" };
	}
	const next = nextLevel(school, level);
	const crossing =
		next !== null && levelOf(school, next)?.stage !== levelOf(school, level)?.stage;
	if (next === null || (crossing && school.promotion.acrossStages !== "keep")) {
		// its pupils leave or go to another stage: the class empties and is archived
		return { levels: [], fate: "archived" };
	}
	return { levels: [next], fate: "advances" };
}

/** The classes with active pupils in them. */
function occupiedGroups(db: DbOrTx): Set<number> {
	return new Set(
		db
			.selectDistinct({ id: patron.classGroupId })
			.from(patron)
			.where(and(eq(patron.status, "active"), eq(patron.patronType, "student")))
			.all()
			.map((r) => r.id)
			.filter((id): id is number => id !== null),
	);
}

export function rolloverPreview(db: DbOrTx, config: AppConfig, now = new Date()): RolloverPreview {
	const school = schoolOf(config);
	const groups = groupsById(db, school);
	const occupied = occupiedGroups(db);
	const after = new Map<number, { levels: string[]; fate: RolloverGroup["fate"] }>();
	for (const g of groups.values()) {
		if (g.kind === "students" && !g.archived) {
			after.set(g.id, nextOfGroup(school, g, occupied));
		}
	}
	const targets: RolloverTarget[] = [...groups.values()]
		.filter((g) => g.kind === "students" && !g.archived && after.get(g.id)?.fate !== "archived")
		.map((g) => ({ ...g, levels: after.get(g.id)?.levels ?? g.levels }))
		.sort((a, b) => compareGroups(school, a, b))
		.map((g) => ({ id: g.id, name: g.name, label: groupLabel(school, g), levels: g.levels }));
	const hosts = (groupId: number, level: string): boolean =>
		(after.get(groupId)?.levels ?? []).includes(level);

	const rows = db
		.select({
			id: patron.id,
			firstName: patron.firstName,
			lastName: patron.lastName,
			levelCode: patron.levelCode,
			groupId: patron.classGroupId,
			openLoans: openLoansOfPatronSql,
		})
		.from(patron)
		.where(and(eq(patron.status, "active"), eq(patron.patronType, "student")))
		.orderBy(patron.searchName)
		.all();
	const byGroup = new Map<number, RolloverGroup>();
	const leavers: RolloverStudent[] = [];
	for (const r of rows) {
		const group = r.groupId === null ? undefined : groups.get(r.groupId);
		if (r.levelCode === null || r.groupId === null || group?.kind !== "students") {
			continue;
		}
		const name = group.name.toLowerCase();
		const sameName = (level: string): RolloverTarget[] =>
			targets.filter((t) => t.levels.includes(level) && t.name.toLowerCase() === name);
		const groupId = r.groupId;
		const from = r.levelCode;
		/** Where a level of the next year places the pupil: their class, none, or a choice. */
		const placement = (next: string | null): RolloverChoice => {
			const crossing =
				next !== null && levelOf(school, next)?.stage !== levelOf(school, from)?.stage;
			if (next === null) {
				return { level: null, crossing, defaultGroupId: null, needsGroup: false };
			}
			if (hosts(groupId, next)) {
				return { level: next, crossing, defaultGroupId: groupId, needsGroup: false };
			}
			if (
				(crossing && school.promotion.acrossStages === "clear") ||
				(!crossing && school.promotion.withinStage === "clear")
			) {
				return { level: next, crossing, defaultGroupId: null, needsGroup: false };
			}
			// another way of a path that splits: the class of the same name there, if one —
			// unless the class into another stage is asked, as for the default way
			const same = sameName(next);
			const asked = crossing && school.promotion.acrossStages === "ask";
			return same.length === 1 && !asked && next !== nextLevel(school, from)
				? { level: next, crossing, defaultGroupId: same[0]?.id ?? null, needsGroup: false }
				: { level: next, crossing, defaultGroupId: null, needsGroup: true };
		};
		const next = nextLevel(school, r.levelCode);
		const { crossing, defaultGroupId, needsGroup } = placement(next);
		const ways = nextChoices(school, r.levelCode);
		const same = sameName(r.levelCode);
		const student: RolloverStudent = {
			id: r.id,
			firstName: r.firstName,
			lastName: r.lastName,
			levelCode: r.levelCode,
			groupId: r.groupId,
			classLabel: classLabel(school, group, r.levelCode),
			openLoans: r.openLoans,
			nextLevel: next,
			crossing,
			defaultGroupId,
			needsGroup,
			stayGroupId: same.length === 1 ? (same[0]?.id ?? null) : null,
			choices: ways.length > 1 ? ways.map(placement) : [],
		};
		if (next === null) {
			leavers.push(student);
			continue;
		}
		const fate = after.get(r.groupId);
		const entry = byGroup.get(r.groupId) ?? {
			id: r.groupId,
			label: groupLabel(school, group),
			nextLabel:
				fate?.fate === "archived"
					? groupLabel(school, group)
					: groupLabel(school, { ...group, levels: fate?.levels ?? group.levels }),
			fate: fate?.fate ?? "stays",
			students: [],
		};
		entry.students.push(student);
		byGroup.set(r.groupId, entry);
	}
	const order = [...groups.values()].sort((a, b) => compareGroups(school, a, b)).map((g) => g.id);
	const last = db
		.select({ at: auditLog.at })
		.from(auditLog)
		.where(eq(auditLog.action, "rollover.apply"))
		.orderBy(desc(auditLog.at))
		.get()?.at;
	return {
		groups: [...byGroup.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
		leavers,
		targets,
		levels: school.levels.map((l) => ({ code: l.code, name: l.name })),
		lastRunAt: last ?? null,
		recentRun:
			last !== undefined &&
			now.getTime() - new Date(last).getTime() < RECENT_DAYS * 24 * 3_600_000,
	};
}

/** What the upgrade will do with the given exceptions (pure). */
export function planRollover(preview: RolloverPreview, decisions: RolloverDecisions): RolloverPlan {
	const plan: RolloverPlan = {
		promote: [],
		repeat: [],
		remove: [],
		blocked: [],
		unplaced: [],
		groupChanges: 0,
	};
	const check = (s: RolloverStudent, groupId: number | null, level: string): number | null => {
		if (groupId === null) {
			return null;
		}
		const target = preview.targets.find((t) => t.id === groupId);
		if (!target?.levels.includes(level)) {
			throw new RolloverError("invalid_group", { id: s.id, group: groupId });
		}
		if (groupId !== s.groupId) {
			plan.groupChanges++;
		}
		return groupId;
	};
	const stay = (s: RolloverStudent): void => {
		const groupId = decisions[s.id]?.group ?? s.stayGroupId;
		if (groupId === null) {
			plan.unplaced.push(s);
			return;
		}
		plan.repeat.push({
			id: s.id,
			levelCode: s.levelCode,
			groupId: check(s, groupId, s.levelCode),
		});
	};
	/** The way on: the default, or the choice taken where the path splits (9.41). */
	const wayOf = (s: RolloverStudent): RolloverChoice => {
		const wanted = decisions[s.id]?.next;
		const fallback: RolloverChoice = {
			level: s.nextLevel,
			crossing: s.crossing,
			defaultGroupId: s.defaultGroupId,
			needsGroup: s.needsGroup,
		};
		if (wanted === undefined) {
			return s.choices[0] ?? fallback;
		}
		const way = s.choices.find((c) => c.level === wanted);
		if (!way) {
			throw new RolloverError("invalid_level", { id: s.id, level: wanted });
		}
		return way;
	};
	for (const s of [...preview.groups.flatMap((g) => g.students), ...preview.leavers]) {
		const d = decisions[s.id];
		if (d?.repeat || d?.keep) {
			stay(s);
			continue;
		}
		const way = wayOf(s);
		if (way.level === null) {
			// leaves the school: whoever still has books blocks the run
			if (s.openLoans > 0) {
				plan.blocked.push(s);
			} else {
				plan.remove.push(s.id);
			}
			continue;
		}
		const chosen = d?.group;
		if (chosen === undefined && way.needsGroup) {
			plan.unplaced.push(s);
			continue;
		}
		plan.promote.push({
			id: s.id,
			levelCode: way.level,
			groupId: check(s, chosen ?? way.defaultGroupId, way.level),
		});
	}
	return plan;
}

export interface RolloverResult {
	promoted: number;
	repeated: number;
	removed: number;
	groupChanges: number;
	/** Classes that advanced to their next level, and classes archived because they emptied. */
	advanced: number;
	archived: number;
	/** Class pictures of the census deleted with the year (Phase 13, Q106). */
	classSheets: number;
	backup: string;
}

/** The backup of step 1, if it exists and is recent enough. */
export function freshBackup(name: string, now = new Date()): boolean {
	const b = listBackups().find((x) => x.name === name);
	return (
		b !== undefined &&
		now.getTime() - new Date(b.createdAt).getTime() <= BACKUP_MAX_AGE_MINUTES * 60_000
	);
}

export function applyRollover(
	{ db, config, dataDir }: Pick<ServerContext, "db" | "config" | "dataDir">,
	input: { decisions: RolloverDecisions; backup: string; confirmRecent: boolean },
	actor: AuditActor,
	now = new Date(),
): RolloverResult {
	if (!freshBackup(input.backup, now)) {
		throw new RolloverError("no_backup");
	}
	const school = schoolOf(config);
	return db.transaction((tx) => {
		const preview = rolloverPreview(tx, config, now);
		if (preview.recentRun && !input.confirmRecent) {
			throw new RolloverError("recent", preview.lastRunAt);
		}
		const groups = groupsById(tx, school);
		const occupied = occupiedGroups(tx);
		const plan = planRollover(preview, input.decisions);
		if (plan.blocked.length > 0) {
			throw new RolloverError(
				"blocked",
				plan.blocked.map((s) => s.id),
			);
		}
		if (plan.unplaced.length > 0) {
			throw new RolloverError(
				"unplaced",
				plan.unplaced.map((s) => s.id),
			);
		}
		const stamp = now.toISOString();
		for (const id of plan.remove) {
			anonymizePatron(tx, dataDir, id, actor, now);
		}
		// the classes first: advancing ones take their next level, emptied ones are archived
		let advanced = 0;
		let archived = 0;
		for (const g of groups.values()) {
			if (g.kind !== "students" || g.archived) {
				continue;
			}
			const next = nextOfGroup(school, g, occupied);
			if (next.fate === "advances") {
				tx.delete(classGroupLevel).where(eq(classGroupLevel.groupId, g.id)).run();
				for (const levelCode of next.levels) {
					tx.insert(classGroupLevel).values({ groupId: g.id, levelCode }).run();
				}
				tx.update(classGroup)
					.set({ updatedAt: stamp })
					.where(eq(classGroup.id, g.id))
					.run();
				advanced++;
			}
		}
		for (const m of [...plan.promote, ...plan.repeat]) {
			tx.update(patron)
				.set({ levelCode: m.levelCode, classGroupId: m.groupId, updatedAt: stamp })
				.where(eq(patron.id, m.id))
				.run();
		}
		const stillUsed = new Set(
			tx
				.selectDistinct({ id: patron.classGroupId })
				.from(patron)
				.where(eq(patron.status, "active"))
				.all()
				.map((r) => r.id),
		);
		const toArchive = [...groups.values()]
			.filter(
				(g) =>
					g.kind === "students" &&
					!g.archived &&
					nextOfGroup(school, g, occupied).fate === "archived" &&
					!stillUsed.has(g.id),
			)
			.map((g) => g.id);
		if (toArchive.length > 0) {
			tx.update(classGroup)
				.set({ archivedAt: stamp, updatedAt: stamp })
				.where(inArray(classGroup.id, toArchive))
				.run();
			archived = toArchive.length;
		}
		// the class pictures of the year go (Phase 13, Q106)
		const classSheets = deleteAllSheets(tx, dataDir);
		const result = {
			classSheets,
			promoted: plan.promote.length,
			repeated: plan.repeat.length,
			removed: plan.remove.length,
			groupChanges: plan.groupChanges,
			advanced,
			archived,
			backup: input.backup,
		};
		audit(tx, actor, "rollover.apply", "patron", null, result, now);
		return result;
	});
}
