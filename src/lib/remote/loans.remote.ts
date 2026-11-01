// SPDX-License-Identifier: GPL-3.0-or-later
// Loans lists (steps 4.6–4.7): the grid of open loans, the overdue notices grouped by class,
// "Segna solleciti stampati", the loan history of a record and today's activity. Permission `loans`.
import { command, query } from "$app/server";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import {
	markNoticesPrinted,
	openLoanCount,
	openLoanFilterOptions,
	openLoanRows,
	recordLoanHistory,
	todayActivity,
} from "#lib/server/services/loan-lists.js";
import { overdueGroupLabels } from "#lib/server/i18n/overdue-labels.js";
import { groupOverdues } from "#lib/server/services/overdues.js";
import { loanFiltersSchema, toLoanFilters } from "#lib/shared/loan-filters.js";
import { dbId, dbIds } from "#lib/shared/input-schemas.js";

export const getOpenLoans = query(loanFiltersSchema, (filters) => {
	requireUser("loans");
	const db = getDb();
	const today = libraryToday(getConfig());
	return {
		today,
		rows: openLoanRows(db, today, toLoanFilters(filters)),
		options: openLoanFilterOptions(db),
	};
});

/**
 * The filter choices of the open-loans page and how many loans are open, without the rows: the
 * grid loads only once a filter is set or the search has 3 characters (9.13, round 15, as Q83).
 */
export const getOpenLoanOptions = query(() => {
	requireUser("loans");
	const db = getDb();
	return {
		options: openLoanFilterOptions(db),
		open: openLoanCount(db),
	};
});

export const getOverdues = query(
	v.object({ minDays: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(365)) }),
	async ({ minDays }) => {
		requireUser("loans");
		const config = getConfig();
		const today = libraryToday(config);
		const rows = openLoanRows(getDb(), today, { overdueOnly: true });
		return {
			today,
			groups: groupOverdues(rows, {
				today,
				minDays,
				labels: await overdueGroupLabels(),
				locale: getConfig().ui.locale,
			}),
		};
	},
);

export const markNotices = command(
	v.object({
		loanIds: dbIds(10_000),
	}),
	({ loanIds }) => {
		const user = requireUser("loans");
		return { marked: markNoticesPrinted(getDb(), loanIds, user) };
	},
);

export const getRecordLoanHistory = query(dbId, (biblioId) => {
	requireUser("loans");
	return recordLoanHistory(getDb(), biblioId, libraryToday(getConfig()));
});

export const getTodayActivity = query(() => {
	requireUser("loans");
	const config = getConfig();
	return todayActivity(getDb(), libraryToday(config), config.library.timezone);
});
