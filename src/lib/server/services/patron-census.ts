// SPDX-License-Identifier: GPL-3.0-or-later
// The census (step 2.4, Phase 12): the choices of the class filters and forms, every class with
// its photo progress. Plain functions `(db, …)`.
import { ne, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { patron } from "#lib/server/db/schema.js";
import {
	compareGroups,
	groupLabel,
	levelOf,
	type GroupKind,
	type SchoolStructure,
} from "#lib/shared/school.js";
import { groupsById, listGroups } from "./class-groups.js";

/** Filter and form options: the levels of the school and the active classes (Phase 12). */
export interface ClassOptions {
	levels: { code: string; label: string; name: string; stage: string }[];
	stages: { code: string; name: string }[];
	/** Active groups in class order, with their label (`3 B`; `1-2 A` for a pluriclasse). */
	groups: {
		id: number;
		kind: GroupKind;
		name: string;
		label: string;
		levels: string[];
		/** The stage of a teachers group (optional). */
		stage: string | null;
	}[];
	groupWord: string;
}

export function classOptions(db: DbOrTx, school: SchoolStructure): ClassOptions {
	return {
		levels: school.levels.map((l) => ({
			code: l.code,
			label: l.label,
			name: l.name,
			stage: l.stage,
		})),
		stages: school.stages,
		groups: listGroups(db, school).map((g) => ({
			id: g.id,
			kind: g.kind,
			name: g.name,
			label: groupLabel(school, g),
			levels: g.levels,
			stage: g.stage,
		})),
		groupWord: school.groupWord,
	};
}

/** Census (step 2.4): one row per class (and teachers group), with the photo progress. */
export interface CensusGroup {
	/** Null: the patrons without a class (left without one by the rollover). */
	groupId: number | null;
	kind: GroupKind | null;
	label: string;
	/** The levels the group hosts: a new pupil of a pluriclasse needs one picked. */
	levels: string[];
	/** Its stage (a class: of its first level; a teachers group: its own), for a comprensivo. */
	stage: string | null;
	total: number;
	withPhoto: number;
}

/** Every active group (empty ones too: a new class fills up in the census), then the patrons without one. */
export function censusGroups(db: Db, school: SchoolStructure): CensusGroup[] {
	const counts = new Map(
		db
			.select({
				groupId: patron.classGroupId,
				total: sql<number>`count(*)`,
				withPhoto: sql<number>`sum(case when ${patron.photoPath} is not null then 1 else 0 end)`,
			})
			.from(patron)
			.where(ne(patron.status, "anonymized"))
			.groupBy(patron.classGroupId)
			.all()
			.map((r) => [r.groupId, r]),
	);
	const out: CensusGroup[] = [...groupsById(db, school).values()]
		.filter((g) => !g.archived)
		.sort((a, b) => compareGroups(school, a, b))
		.map((g) => ({
			groupId: g.id,
			kind: g.kind,
			label: groupLabel(school, g),
			levels: g.levels,
			stage:
				g.kind === "teachers"
					? g.stage
					: (levelOf(school, g.levels[0] ?? null)?.stage ?? null),
			total: counts.get(g.id)?.total ?? 0,
			withPhoto: counts.get(g.id)?.withPhoto ?? 0,
		}));
	const without = counts.get(null);
	if (without) {
		out.push({
			groupId: null,
			kind: null,
			label: "",
			levels: [],
			stage: null,
			total: without.total,
			withPhoto: without.withPhoto,
		});
	}
	return out;
}
