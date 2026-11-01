// SPDX-License-Identifier: GPL-3.0-or-later
// The classes of the school (PLAN.md Phase 12, Q94, Q99, Q100, Q102): groups of the database, each
// a students class hosting one level or several (a pluriclasse) or a teachers group. Only `admin`
// creates, renames, re-levels and archives them (the remote functions check it); whoever manages
// patrons picks one. A group is never deleted: it is archived once nobody is in it.
import { ServiceError } from "#lib/server/errors.js";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { classGroup, classGroupLevel, patron } from "#lib/server/db/schema.js";
import {
	compareGroups,
	type ClassGroupInfo,
	type GroupKind,
	type SchoolStructure,
} from "#lib/shared/school.js";
import { demoGroupName, demoText } from "#lib/server/demo/content.js";
import { audit, type AuditActor } from "./audit.js";

export type GroupProblem =
	| "nameRequired"
	| "nameLong"
	| "levelsRequired"
	| "levelUnknown"
	| "levelsNotForTeachers"
	| "nameTaken"
	| "levelInUse"
	| "notEmpty"
	| "notFound";

export class GroupError extends ServiceError {
	constructor(override readonly code: GroupProblem) {
		super(code, `class group: ${code}`);
		this.name = "GroupError";
	}
}

export interface GroupInput {
	kind: GroupKind;
	name: string;
	/** Level codes (students only), in any order: stored as given, shown in the scale's order. */
	levels: string[];
	/** Teachers groups only: the stage they belong to (optional). */
	stage?: string | null;
	notes?: string | null;
}

export interface GroupRow extends ClassGroupInfo {
	notes: string | null;
	/** Active patrons in the group. */
	patrons: number;
}

/** Every group with its levels (in the order of the scale), archived ones included. */
export function groupsById(
	db: DbOrTx,
	school: Pick<SchoolStructure, "levels">,
): Map<number, ClassGroupInfo> {
	const order = new Map(school.levels.map((l, i) => [l.code, i]));
	const levels = new Map<number, string[]>();
	for (const r of db.select().from(classGroupLevel).all()) {
		const list = levels.get(r.groupId) ?? [];
		list.push(r.levelCode);
		levels.set(r.groupId, list);
	}
	const out = new Map<number, ClassGroupInfo>();
	for (const g of db.select().from(classGroup).all()) {
		out.set(g.id, {
			id: g.id,
			kind: g.kind as GroupKind,
			name: g.name,
			levels: (levels.get(g.id) ?? []).sort(
				(a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999),
			),
			stage: g.stage,
			archived: g.archivedAt !== null,
		});
	}
	return out;
}

/** The active groups (or every group), in the order of the classes, with how many patrons each has. */
export function listGroups(
	db: DbOrTx,
	school: Pick<SchoolStructure, "levels">,
	options: { archived?: boolean } = {},
): GroupRow[] {
	const counts = new Map(
		db
			.select({ id: patron.classGroupId, n: sql<number>`count(*)` })
			.from(patron)
			.where(ne(patron.status, "anonymized"))
			.groupBy(patron.classGroupId)
			.all()
			.map((r) => [r.id, r.n]),
	);
	const notes = new Map(
		db
			.select({ id: classGroup.id, notes: classGroup.notes })
			.from(classGroup)
			.all()
			.map((r) => [r.id, r.notes]),
	);
	return [...groupsById(db, school).values()]
		.filter((g) => options.archived === true || !g.archived)
		.sort((a, b) => Number(a.archived) - Number(b.archived) || compareGroups(school, a, b))
		.map((g) => ({ ...g, notes: notes.get(g.id) ?? null, patrons: counts.get(g.id) ?? 0 }));
}

function checkInput(
	db: DbOrTx,
	school: Pick<SchoolStructure, "levels">,
	input: GroupInput,
	exceptId: number | null,
): GroupInput {
	const name = input.name.trim().replace(/\s+/g, " ");
	if (name === "") {
		throw new GroupError("nameRequired");
	}
	if (name.length > 40) {
		throw new GroupError("nameLong");
	}
	const levels = [...new Set(input.levels)];
	if (input.kind === "teachers") {
		if (levels.length > 0) {
			throw new GroupError("levelsNotForTeachers");
		}
	} else {
		if (levels.length === 0) {
			throw new GroupError("levelsRequired");
		}
		if (levels.some((code) => !school.levels.some((l) => l.code === code))) {
			throw new GroupError("levelUnknown");
		}
	}
	// two active groups of a kind may share a name only when they host different levels
	for (const other of groupsById(db, school).values()) {
		if (other.archived || other.id === exceptId || other.kind !== input.kind) {
			continue;
		}
		if (other.name.toLowerCase() !== name.toLowerCase()) {
			continue;
		}
		if (input.kind === "teachers" || other.levels.some((l) => levels.includes(l))) {
			throw new GroupError("nameTaken");
		}
	}
	return { ...input, name, levels };
}

function writeLevels(tx: DbOrTx, groupId: number, levels: readonly string[]): void {
	tx.delete(classGroupLevel).where(eq(classGroupLevel.groupId, groupId)).run();
	for (const levelCode of levels) {
		tx.insert(classGroupLevel).values({ groupId, levelCode }).run();
	}
}

/** Creates groups (one or many: "da 1 A a 5 D"); all or none. No actor: the first-run wizard. */
export function createGroups(
	db: Db,
	school: Pick<SchoolStructure, "levels">,
	inputs: readonly GroupInput[],
	actor: AuditActor | null,
	now = new Date(),
): number[] {
	return db.transaction((tx) => {
		const ids: number[] = [];
		for (const [i, sent] of inputs.entries()) {
			// the public demo stores its example names and notes (Q121); not the wizard's (no actor)
			const raw =
				actor === null
					? sent
					: {
							...sent,
							name: demoGroupName(
								sent.name,
								null,
								now,
								inputs.length > 1 ? i + 1 : undefined,
							),
							notes: sent.notes
								? demoText("comment", sent.notes, null, now)
								: sent.notes,
						};
			const input = checkInput(tx, school, raw, null);
			const row = tx
				.insert(classGroup)
				.values({
					kind: input.kind,
					name: input.name,
					stage: input.kind === "teachers" ? (input.stage ?? null) : null,
					notes: input.notes ?? null,
					createdAt: now.toISOString(),
					updatedAt: now.toISOString(),
				})
				.returning({ id: classGroup.id })
				.get();
			writeLevels(tx, row.id, input.levels);
			ids.push(row.id);
		}
		audit(tx, actor, "group.create", "class_group", null, { ids }, now);
		return ids;
	});
}

/**
 * Renames a group, changes its levels (a pluriclasse) or its notes. A level its pupils still
 * have cannot leave the group (they would have no class).
 */
export function updateGroup(
	db: Db,
	school: Pick<SchoolStructure, "levels">,
	id: number,
	raw: GroupInput,
	actor: AuditActor,
	now = new Date(),
): void {
	db.transaction((tx) => {
		const existing = tx.select().from(classGroup).where(eq(classGroup.id, id)).get();
		if (!existing) {
			throw new GroupError("notFound");
		}
		const sent = {
			...raw,
			kind: existing.kind as GroupKind,
			name: demoGroupName(raw.name, existing.name, now),
			notes: raw.notes ? demoText("comment", raw.notes, existing.notes, now) : raw.notes,
		};
		const input = checkInput(tx, school, sent, id);
		const used = tx
			.selectDistinct({ level: patron.levelCode })
			.from(patron)
			.where(and(eq(patron.classGroupId, id), ne(patron.status, "anonymized")))
			.all()
			.map((r) => r.level)
			.filter((l): l is string => l !== null);
		if (used.some((l) => !input.levels.includes(l))) {
			throw new GroupError("levelInUse");
		}
		tx.update(classGroup)
			.set({
				name: input.name,
				stage: input.kind === "teachers" ? (input.stage ?? null) : null,
				notes: input.notes ?? null,
				updatedAt: now.toISOString(),
			})
			.where(eq(classGroup.id, id))
			.run();
		if (input.kind === "students") {
			writeLevels(tx, id, input.levels);
		}
		audit(tx, actor, "group.update", "class_group", id, { levels: input.levels }, now);
	});
}

/** Archives an empty group (no active patron in it); anonymized patrons keep pointing at it. */
export function archiveGroup(db: Db, id: number, actor: AuditActor, now = new Date()): void {
	db.transaction((tx) => {
		const existing = tx.select().from(classGroup).where(eq(classGroup.id, id)).get();
		if (!existing) {
			throw new GroupError("notFound");
		}
		const inside =
			tx
				.select({ n: sql<number>`count(*)` })
				.from(patron)
				.where(and(eq(patron.classGroupId, id), ne(patron.status, "anonymized")))
				.get()?.n ?? 0;
		if (inside > 0) {
			throw new GroupError("notEmpty");
		}
		tx.update(classGroup)
			.set({ archivedAt: now.toISOString(), updatedAt: now.toISOString() })
			.where(eq(classGroup.id, id))
			.run();
		audit(tx, actor, "group.archive", "class_group", id, undefined, now);
	});
}

/** Brings an archived group back (its name must not clash with an active one). */
export function restoreGroup(
	db: Db,
	school: Pick<SchoolStructure, "levels">,
	id: number,
	actor: AuditActor,
	now = new Date(),
): void {
	db.transaction((tx) => {
		const group = groupsById(tx, school).get(id);
		if (!group) {
			throw new GroupError("notFound");
		}
		checkInput(tx, school, { kind: group.kind, name: group.name, levels: group.levels }, id);
		tx.update(classGroup)
			.set({ archivedAt: null, updatedAt: now.toISOString() })
			.where(eq(classGroup.id, id))
			.run();
		audit(tx, actor, "group.restore", "class_group", id, undefined, now);
	});
}

/**
 * The teachers group a new teacher joins when none is chosen (Q102): the first active one, made
 * with `school.teacherGroupName` when there is none yet.
 */
export function defaultTeacherGroup(tx: DbOrTx, name: string, now = new Date()): number {
	const existing = tx
		.select({ id: classGroup.id })
		.from(classGroup)
		.where(and(eq(classGroup.kind, "teachers"), isNull(classGroup.archivedAt)))
		.orderBy(asc(classGroup.id))
		.get();
	if (existing) {
		return existing.id;
	}
	return tx
		.insert(classGroup)
		.values({
			kind: "teachers",
			name,
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
		})
		.returning({ id: classGroup.id })
		.get().id;
}
