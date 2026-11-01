// SPDX-License-Identifier: GPL-3.0-or-later
// The stages and years of the school edited from the "Scuola" settings page (PLAN.md Phase 12,
// step 12.9): a year that pupils or classes still use can go only with somewhere for them to go —
// the plan counts what each removed year holds, the save moves the pupils to the chosen year and
// lets the classes host it instead, in the same configuration change. The loans keep their photo
// of the class (Q95): nothing in them moves.
import { count, eq, sql } from "drizzle-orm";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { ServerContext } from "#lib/server/context.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { classGroupLevel, patron } from "#lib/server/db/schema.js";
import { groupLabel, type SchoolLevel, type SchoolStage } from "#lib/shared/school.js";
import { schoolOf } from "#lib/server/school/structure.js";
import { listGroups } from "./class-groups.js";
import { saveConfigKeysMoving } from "./config-sections.js";
import type { AuditActor } from "./audit.js";

export interface SchoolDraft {
	preset: string;
	stages: SchoolStage[];
	levels: SchoolLevel[];
}

export interface RemovedLevel {
	code: string;
	name: string;
	/** Patrons with this year (anonymized ones too: their year moves with the others). */
	pupils: number;
	/** Active classes hosting it, with their label. */
	classes: string[];
	/** The year chosen for them, when given and valid. */
	replacement: string | null;
}

export interface SchoolPlan {
	removed: RemovedLevel[];
	/** Every removed year in use has a valid replacement: the save can go ahead. */
	ready: boolean;
}

export class SchoolNotReadyError extends Error {
	constructor(readonly plan: SchoolPlan) {
		super("school structure: removed years still in use need a replacement");
		this.name = "SchoolNotReadyError";
	}
}

/** The years the draft takes away while pupils or active classes still use them. */
export function planSchoolStructure(
	db: DbOrTx,
	config: AppConfig,
	draft: SchoolDraft,
	moves: Readonly<Record<string, string>> = {},
): SchoolPlan {
	const school = schoolOf(config);
	const kept = new Set(draft.levels.map((l) => l.code));
	const groups = listGroups(db, school);
	const removed: RemovedLevel[] = [];
	for (const level of school.levels) {
		if (kept.has(level.code)) {
			continue;
		}
		const pupils =
			db.select({ n: count() }).from(patron).where(eq(patron.levelCode, level.code)).get()
				?.n ?? 0;
		const classes = groups
			.filter((g) => g.levels.includes(level.code))
			.map((g) => groupLabel(school, g));
		if (pupils === 0 && classes.length === 0) {
			continue;
		}
		const to = moves[level.code];
		removed.push({
			code: level.code,
			name: level.name,
			pupils,
			classes,
			replacement: to !== undefined && kept.has(to) ? to : null,
		});
	}
	return { removed, ready: removed.every((r) => r.replacement !== null) };
}

/** Moves one year's pupils and classes to another (inside the change's transaction). */
function moveLevel(
	tx: DbOrTx,
	from: string,
	to: string,
	at: string,
): { pupils: number; classes: number } {
	const pupils = tx
		.update(patron)
		.set({ levelCode: to, updatedAt: at })
		.where(eq(patron.levelCode, from))
		.run().changes;
	// a class already hosting the new year just drops the old one
	tx.run(
		sql`DELETE FROM class_group_level WHERE level_code = ${from}
			AND group_id IN (SELECT group_id FROM class_group_level WHERE level_code = ${to})`,
	);
	const classes = tx
		.update(classGroupLevel)
		.set({ levelCode: to })
		.where(eq(classGroupLevel.levelCode, from))
		.run().changes;
	return { pupils, classes };
}

/**
 * Saves the stages and years; the removed years in use move to their replacement first. Throws
 * `SchoolNotReadyError` (nothing written) when one has none.
 */
export function saveSchoolStructure(
	{ db, config, configDir }: Pick<ServerContext, "db" | "config" | "configDir">,
	draft: SchoolDraft,
	moves: Readonly<Record<string, string>>,
	actor: AuditActor,
	now = new Date(),
): { change: string; pupils: number; classes: number } {
	const plan = planSchoolStructure(db, config, draft, moves);
	if (!plan.ready) {
		throw new SchoolNotReadyError(plan);
	}
	const at = now.toISOString();
	const moved = { pupils: 0, classes: 0 };
	const change = saveConfigKeysMoving(
		db,
		configDir,
		"school",
		{
			"school.preset": draft.preset,
			"school.stages": draft.stages,
			"school.levels": draft.levels,
		},
		(tx) => {
			for (const r of plan.removed) {
				if (r.replacement !== null) {
					const m = moveLevel(tx, r.code, r.replacement, at);
					moved.pupils += m.pupils;
					moved.classes += m.classes;
				}
			}
			return { movedLevels: plan.removed.map((r) => `${r.code}>${r.replacement ?? ""}`) };
		},
		actor,
		now,
	);
	return { change: change.id, ...moved };
}
