// SPDX-License-Identifier: GPL-3.0-or-later
// The class of a patron now (Phase 12): its label for the screens and the snapshot a loan keeps
// (Q95: a photo of the class at the time, never rewritten afterwards).
import { eq } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { patronClass } from "#lib/server/db/schema.js";

export interface ClassSnapshot {
	levelSnapshot: string | null;
	levelPositionSnapshot: number | null;
	stageSnapshot: string | null;
	groupIdSnapshot: number | null;
	groupSnapshot: string | null;
	classLabelSnapshot: string | null;
}

export function classSnapshot(db: DbOrTx, patronId: number): ClassSnapshot {
	const c = db.select().from(patronClass).where(eq(patronClass.patronId, patronId)).get();
	return {
		levelSnapshot: c?.levelCode ?? null,
		levelPositionSnapshot: c?.levelPosition ?? null,
		stageSnapshot: c?.stage ?? null,
		groupIdSnapshot: c?.groupId ?? null,
		groupSnapshot: c?.groupName ?? null,
		classLabelSnapshot: c?.classLabel ?? null,
	};
}

/** The class label of a patron now (`3 B`, a teachers group's name, or ""). */
export function classLabelOf(db: DbOrTx, patronId: number): string {
	return (
		db
			.select({ label: patronClass.classLabel })
			.from(patronClass)
			.where(eq(patronClass.patronId, patronId))
			.get()?.label ?? ""
	);
}
