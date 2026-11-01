// SPDX-License-Identifier: GPL-3.0-or-later
// Blocks of the circulation and calendar pages of the Configurazione area (step 11.5): the loan
// rules per item type and the calendar of closures. Permission `admin`.
import { command, query } from "$app/server";
import * as v from "valibot";
import { draftCode, isoDay } from "#lib/shared/input-schemas.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { changing } from "#lib/server/http/config-changes.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { calendarSources, saveCalendar } from "#lib/server/services/calendar-edit.js";
import { currentSchoolYearStart, libraryToday } from "#lib/server/services/calendar.js";
import { saveConfigKeys } from "#lib/server/services/config-sections.js";

const count = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10_000));

/** The loan rules per item type on top of the rules of students and teachers. */
export const getItemTypeRules = query(() => {
	requireUser("admin");
	const config = getConfig();
	return {
		itemTypes: config.library.itemTypes,
		rules: config.circulation.rules,
		overrides: config.circulation.itemTypeOverrides,
	};
});

export const saveItemTypeRules = command(
	v.object({
		overrides: v.record(
			draftCode,
			v.object({
				loanDays: v.optional(count),
				maxLoans: v.optional(count),
				maxRenewals: v.optional(count),
				renewalDays: v.optional(count),
			}),
		),
	}),
	({ overrides }) => {
		const user = requireUser("admin");
		return changing(() => {
			const change = saveConfigKeys(
				getDb(),
				env().CONFIG_DIR,
				"circulation",
				{ "circulation.itemTypeOverrides": overrides },
				user,
			);
			void getItemTypeRules().refresh();
			return { ok: true as const, change: change.id };
		});
	},
);

/** The calendar as the editor holds it, with the file each holiday and range comes from. */
export const getCalendarEditor = query(() => {
	requireUser("admin");
	const config = getConfig();
	return {
		draft: {
			weeklyClosedDays: [...config.calendar.weeklyClosedDays],
			holidays: [...config.calendar.holidays],
			closedRanges: config.calendar.closedRanges.map((r) => ({
				from: r.from,
				to: r.to,
				reason: r.reason,
			})),
		},
		sources: calendarSources(env().CONFIG_DIR),
		schoolYearStart: config.library.schoolYearStart,
		weekStart: config.library.weekStart,
		currentYear: currentSchoolYearStart(config),
		today: libraryToday(config),
	};
});

export const saveCalendarChange = command(
	v.object({
		weeklyClosedDays: v.pipe(
			v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(6))),
			v.maxLength(7),
		),
		holidays: v.pipe(v.array(isoDay), v.maxLength(5000)),
		closedRanges: v.pipe(
			v.array(
				v.object({
					from: isoDay,
					to: isoDay,
					reason: v.pipe(v.string(), v.maxLength(200)),
				}),
			),
			v.maxLength(1000),
		),
	}),
	(draft) => {
		const user = requireUser("admin");
		return changing(() => {
			const change = saveCalendar(getDb(), env().CONFIG_DIR, draft, user);
			void getCalendarEditor().refresh();
			return { ok: true as const, change: change.id };
		});
	},
);
