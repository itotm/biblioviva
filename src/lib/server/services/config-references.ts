// SPDX-License-Identifier: GPL-3.0-or-later
// What a configuration change must not take away while the catalogue or the patrons use it
// (Phase 11, Phase 12): a genre or class with books, an item type with books, a level of the school
// with pupils or classes, a reading level with books. Only what the change removes counts, so a
// problem that was already there never blocks an unrelated change. Every configuration change runs
// the check (`commitConfigChange`): a problem puts the files back.
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { biblio, classGroup, classGroupLevel, item, patron } from "#lib/server/db/schema.js";
import { orphanCodes, taxonomyOf, taxonomyUsage } from "./taxonomy.js";

export interface ReferenceProblem {
	kind: "classification" | "itemType" | "level" | "readingLevel";
	code: string;
	/** Records (classification and item types), pupils (levels) or books (reading levels). */
	count: number;
}

export class ConfigInUseError extends Error {
	constructor(readonly problems: ReferenceProblem[]) {
		super(
			`the change removes what is still in use: ${problems.map((p) => `${p.kind} ${p.code} (${p.count})`).join(", ")}`,
		);
		this.name = "ConfigInUseError";
	}
}

/** What `after` takes away that the database still uses (and `before` had). */
export function referenceProblems(
	db: DbOrTx,
	before: AppConfig,
	after: AppConfig,
): ReferenceProblem[] {
	const problems: ReferenceProblem[] = [];

	const usage = taxonomyUsage(db);
	const known = new Set(orphanCodes(usage, taxonomyOf(before)).map((o) => `${o.kind}:${o.code}`));
	for (const o of orphanCodes(usage, taxonomyOf(after))) {
		if (!known.has(`${o.kind}:${o.code}`)) {
			problems.push({ kind: "classification", code: o.code, count: o.records });
		}
	}

	const typesAfter = new Set(after.library.itemTypes.map((t) => t.code));
	const typesBefore = new Set(before.library.itemTypes.map((t) => t.code));
	for (const t of db
		.select({ code: biblio.itemType, n: count() })
		.from(biblio)
		.groupBy(biblio.itemType)
		.all()) {
		if (typesBefore.has(t.code) && !typesAfter.has(t.code)) {
			problems.push({ kind: "itemType", code: t.code, count: t.n });
		}
	}

	// a level of the school that active pupils have or active classes host (Phase 12)
	const levelsAfter = new Set(after.school.levels.map((l) => l.code));
	const levelsBefore = new Set(before.school.levels.map((l) => l.code));
	const usedLevels = new Map<string, number>();
	for (const l of db
		.select({ code: patron.levelCode, n: count() })
		.from(patron)
		.where(and(eq(patron.status, "active"), isNotNull(patron.levelCode)))
		.groupBy(patron.levelCode)
		.all()) {
		if (l.code !== null) {
			usedLevels.set(l.code, l.n);
		}
	}
	for (const g of db
		.select({ code: classGroupLevel.levelCode })
		.from(classGroupLevel)
		.innerJoin(classGroup, eq(classGroup.id, classGroupLevel.groupId))
		.where(isNull(classGroup.archivedAt))
		.all()) {
		usedLevels.set(g.code, usedLevels.get(g.code) ?? 0);
	}
	for (const [code, n] of usedLevels) {
		if (levelsBefore.has(code) && !levelsAfter.has(code)) {
			problems.push({ kind: "level", code, count: n });
		}
	}

	// a reading level that books carry (Phase 12.6)
	const readingAfter = new Set(after.classification.readingLevels.map((l) => l.code));
	const readingBefore = new Set(before.classification.readingLevels.map((l) => l.code));
	const books = new Map<string, number>();
	for (const table of [biblio, item] as const) {
		for (const r of db
			.select({ code: table.readingLevel, n: count() })
			.from(table)
			.where(isNotNull(table.readingLevel))
			.groupBy(table.readingLevel)
			.all()) {
			if (r.code !== null) {
				books.set(r.code, (books.get(r.code) ?? 0) + r.n);
			}
		}
	}
	for (const [code, n] of books) {
		if (readingBefore.has(code) && !readingAfter.has(code)) {
			problems.push({ kind: "readingLevel", code, count: n });
		}
	}
	return problems;
}
