// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** Administrator exports (step 7.3): `admin`. */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "admin");
	return {};
};
