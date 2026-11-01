// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** The report editor (step 9.20); requires the `admin` permission. */
export const load: PageServerLoad = ({ locals, params }) => {
	requirePermission(locals, "admin");
	return { id: params.id };
};
