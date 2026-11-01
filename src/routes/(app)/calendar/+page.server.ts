// SPDX-License-Identifier: GPL-3.0-or-later
// The library calendar (steps 4.1, 9.25): the twelve months of a school year with the closed days
// and their reason, and the notable dates the staff mark for everyone. Every account reads it; the
// accounts with `loans` add, edit and delete the dates; the administrator edits the closures on
// the "Calendario" settings page (11.5).
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { can } from "#lib/server/auth/rbac.js";
import { getConfig } from "#lib/server/config/index.js";
import {
	currentSchoolYearStart,
	libraryToday,
	schoolYearMonths,
} from "#lib/server/services/calendar.js";
import { schoolYearLabel } from "#lib/shared/school-year.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requirePermission(locals);
	const config = getConfig();
	const current = currentSchoolYearStart(config);
	const asked = Number(url.searchParams.get("year"));
	const year = Number.isInteger(asked) && asked > 1990 && asked < 2200 ? asked : current;
	const months = schoolYearMonths(config, year);
	// `2026/2027`, or `2026` where the school year is named by its start (9.41)
	const named = (y: number): string =>
		schoolYearLabel(`${y}/${y + 1}`, config.library.schoolYearLabel);
	return {
		year,
		current,
		label: named(year),
		prev: { year: year - 1, label: named(year - 1) },
		next: { year: year + 1, label: named(year + 1) },
		today: libraryToday(config),
		weekStart: config.library.weekStart,
		months,
		/** The days of the year shown, for the dates of the calendar. */
		range: {
			from: months[0]?.days[0]?.date ?? `${year}-09-01`,
			to: months.at(-1)?.days.at(-1)?.date ?? `${year + 1}-08-31`,
		},
		canWrite: can(user, "loans"),
		settings: {
			weeklyClosedDays: config.calendar.weeklyClosedDays,
			autoItalianHolidays: config.calendar.autoItalianHolidays,
			dueDateMode: config.circulation.dueDateMode,
			hardDueDate: config.circulation.hardDueDate,
		},
	};
};
