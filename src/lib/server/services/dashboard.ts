// SPDX-License-Identifier: GPL-3.0-or-later
// Dashboard (PLAN.md step 4.9): the counts of the tiles, each only for the accounts that may act
// on it, and the loans due this week. A handful of indexed counts, no charts (they live in the
// reports), so the page renders in a few milliseconds on the Raspberry Pi. Sections switched off in
// `ui.dashboard` (step 11.15) are not computed.
import { patronFullName } from "#lib/shared/patron-name.js";
import { currentInventory, inventoryCounts } from "./inventory.js";
import { and, asc, eq, gte, isNull, lte, lt, sql } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { biblio, item, loan, patron } from "#lib/server/db/schema.js";
import { endOfWeek, type WeekStart } from "#lib/shared/calendar-core.js";
import { dayRangeToUtc } from "#lib/shared/dates.js";
import { ALL_SECTIONS, type DashboardSections } from "#lib/shared/dashboard-sections.js";
import { unclassifiedCount } from "./catalog-classify.js";
import { pendingLabelCounts } from "./label-items.js";

export interface DueSoonLoan {
	loanId: number;
	patronId: number;
	name: string;
	title: string;
	dueDate: string;
}

export interface DashboardStats {
	loans?: {
		open: number;
		overdue: number;
		issuedToday: number;
		returnedToday: number;
	};
	/** Open loans due from today to Sunday, soonest first, and how many there are. */
	dueThisWeek?: { loans: DueSoonLoan[]; total: number; weekEnd: string };
	patrons?: { withoutCard: number; withoutPhoto: number };
	catalog?: {
		pendingBarcode: number;
		pendingSpine: number;
		pendingPair: number;
		/** Records still to classify (step 9.21). */
		toClassify: number;
	};
	/** The stocktaking campaign in progress (step 9.8). */
	inventory?: { id: number; name: string; expected: number; seen: number };
}

const count = (
	db: DbOrTx,
	table: typeof loan | typeof patron,
	where: ReturnType<typeof and>,
): number =>
	db
		.select({ n: sql<number>`count(*)` })
		.from(table)
		.where(where)
		.get()?.n ?? 0;

export function dashboardStats(
	db: DbOrTx,
	areas: { loans: boolean; patrons: boolean; catalog: boolean },
	today: string,
	timezone: string,
	sections: DashboardSections = ALL_SECTIONS,
	dueLimit = 8,
	/** "This week" ends on the day before `library.weekStart` (9.13, round 17). */
	weekStart: WeekStart = "monday",
): DashboardStats {
	const stats: DashboardStats = {};
	if (areas.loans && sections.tiles) {
		const { fromIso = "", toIso = "" } = dayRangeToUtc(today, today, timezone);
		stats.loans = {
			open: count(db, loan, isNull(loan.returnedAt)),
			overdue: count(db, loan, and(isNull(loan.returnedAt), lt(loan.dueDate, today))),
			issuedToday: count(
				db,
				loan,
				and(gte(loan.issuedAt, fromIso), lte(loan.issuedAt, toIso)),
			),
			returnedToday: count(
				db,
				loan,
				and(gte(loan.returnedAt, fromIso), lte(loan.returnedAt, toIso)),
			),
		};
	}
	if (areas.loans && sections.dueThisWeek) {
		const dueWhere = and(
			isNull(loan.returnedAt),
			gte(loan.dueDate, today),
			lte(loan.dueDate, endOfWeek(today, weekStart)),
		);
		stats.dueThisWeek = {
			loans: db
				.select({
					loanId: loan.id,
					patronId: patron.id,
					firstName: patron.firstName,
					lastName: patron.lastName,
					title: biblio.title,
					dueDate: loan.dueDate,
				})
				.from(loan)
				.innerJoin(patron, eq(patron.id, loan.patronId))
				.innerJoin(item, eq(item.id, loan.itemId))
				.innerJoin(biblio, eq(biblio.id, item.biblioId))
				.where(dueWhere)
				.orderBy(asc(loan.dueDate), asc(patron.searchName))
				.limit(dueLimit)
				.all()
				.map(({ firstName, lastName, ...r }) => ({
					...r,
					name: patronFullName({ firstName, lastName }),
				})),
			total: count(db, loan, dueWhere),
			weekEnd: endOfWeek(today, weekStart),
		};
	}
	if (areas.patrons && sections.tiles) {
		const active = eq(patron.status, "active");
		stats.patrons = {
			withoutCard: count(db, patron, and(active, isNull(patron.cardPrintedAt))),
			withoutPhoto: count(db, patron, and(active, isNull(patron.photoPath))),
		};
	}
	if (areas.catalog && sections.tiles) {
		const pending = pendingLabelCounts(db);
		stats.catalog = {
			pendingBarcode: pending.barcode,
			pendingSpine: pending.spine,
			pendingPair: pending.pair,
			toClassify: unclassifiedCount(db),
		};
	}
	if (areas.catalog && sections.inventory) {
		const campaign = currentInventory(db);
		if (campaign) {
			const progress = inventoryCounts(db, campaign.id);
			stats.inventory = {
				id: campaign.id,
				name: campaign.name,
				expected: progress.expected,
				seen: progress.seen,
			};
		}
	}
	return stats;
}
