// SPDX-License-Identifier: GPL-3.0-or-later
// Dashboard (step 4.9): the quick actions, the tiles of the areas the account may act on, the loans
// due this week; SSR only. The installation chooses which sections it shows (step 11.15). An account whose only area is circulation opens straight on
// the checkout desk (step 4.3). The pinned staff notes come first (step 9.18); the next dates of the
// calendar have their section (9.25). An administrator is reminded of the installation check (8.7)
// while one of its items is red.
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { can, opensOnDesk } from "#lib/server/auth/rbac.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { serverContext } from "#lib/server/context.js";
import { isDemoPublic } from "#lib/server/demo/public.js";
import { env } from "#lib/server/env.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import { installCheck } from "#lib/server/services/install-check.js";
import { dashboardStats } from "#lib/server/services/dashboard.js";
import { countOpenNotes, pinnedNotes } from "#lib/server/services/notes.js";
import { upcomingCalendarEvents } from "#lib/server/services/calendar-events.js";

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requirePermission(locals);
	if (opensOnDesk(user)) {
		redirect(303, "/circulation/checkout");
	}
	const config = getConfig();
	const sections = config.ui.dashboard;
	const db = getDb();
	// the light check: the schema alone, no walk through the templates and the reports
	// (not in the public demo: its accounts have the published password on purpose)
	const setup =
		can(user, "admin") && !isDemoPublic()
			? await installCheck(serverContext(), {
					request: { protocol: url.protocol, hostname: url.hostname, host: url.host },
					lanFront: env().LAN_PORT !== undefined,
				})
			: null;
	return {
		sections,
		/** The items of the installation check that are red: the administrator's reminder. */
		setupErrors: setup ? setup.items.filter((i) => i.state === "error").length : 0,
		pinnedNotes: pinnedNotes(db),
		/** The next notable dates of the calendar (step 9.25), for every account. */
		upcoming: sections.upcomingDates ? upcomingCalendarEvents(db, libraryToday(config)) : null,
		/** "Segnalazioni aperte", the administrator's tile. */
		openNotes: can(user, "admin") ? countOpenNotes(db) : null,
		stats: dashboardStats(
			db,
			{
				loans: can(user, "loans"),
				patrons: can(user, "patrons"),
				catalog: can(user, "catalog"),
			},
			libraryToday(config),
			config.library.timezone,
			sections,
			8,
			config.library.weekStart,
		),
	};
};
