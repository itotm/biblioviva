// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** Open loans grid (step 4.6): `loans`. */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "loans");
	return {};
};
