// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** One report (step 6.2): `reports`; restricted reports are refused by the remote functions. */
export const load: PageServerLoad = ({ locals, params }) => {
	requirePermission(locals, "reports");
	return { id: params.id };
};
