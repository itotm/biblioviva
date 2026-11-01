// SPDX-License-Identifier: GPL-3.0-or-later
import { requireAnyPermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
	// cards (patrons) or labels (catalog): nothing to do here without either (9.13, round 16)
	requireAnyPermission(locals, ["patrons", "catalog"]);
	return {};
};
