// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** Stocktaking campaigns (step 9.8); requires the `catalog` permission. */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "catalog");
	return {};
};
