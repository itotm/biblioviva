// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** Administration home (filled in by later steps); requires the `admin` permission. */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "admin");
	return {};
};
