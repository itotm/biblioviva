// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { can } from "#lib/server/auth/rbac.js";
import type { PageServerLoad } from "./$types";

/** The staff notes (step 9.18): every account; the administrator's actions only with `admin`. */
export const load: PageServerLoad = ({ locals }) => {
	const user = requirePermission(locals);
	return { isAdmin: can(user, "admin") };
};
