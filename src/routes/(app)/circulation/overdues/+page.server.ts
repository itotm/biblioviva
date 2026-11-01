// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import type { PageServerLoad } from "./$types";

/** Overdue notices (step 4.6): `loans`; the defaults come from `circulation.overdueNotice`. */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "loans");
	const notice = getConfig().circulation.overdueNotice;
	return { minDays: notice.minDays, pageBreak: notice.pageBreakPerGroup };
};
