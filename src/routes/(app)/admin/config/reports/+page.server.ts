// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** The reports library (step 11.9); requires the `admin` permission. */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "admin");
	return {};
};
