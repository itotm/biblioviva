// SPDX-License-Identifier: GPL-3.0-or-later
import { error } from "@sveltejs/kit";
import { can } from "#lib/server/auth/rbac.js";
import type { PageServerLoad } from "./$types";

/**
 * The imports of the administration (9.13, rounds 13 and 16): catalogue, patrons, open loans,
 * photos. Open to administrators and to the accounts allowed to import the catalogue or the
 * patrons, who see only their own imports.
 */
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		error(401, "unauthorized");
	}
	if (
		!can(locals.user, "admin") &&
		!can(locals.user, "catalog.import") &&
		!can(locals.user, "patrons.import")
	) {
		error(403, "forbidden: catalog.import or patrons.import");
	}
	return {};
};
