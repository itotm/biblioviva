// SPDX-License-Identifier: GPL-3.0-or-later
import { requireAnyPermission } from "#lib/server/auth/load-guard.js";
import { can, canSeePatrons } from "#lib/server/auth/rbac.js";
import type { PageServerLoad } from "./$types";

/** The wishlist (step 9.15): `loans` or `catalog`; who asked only for the accounts that see patrons. */
export const load: PageServerLoad = ({ locals }) => {
	const user = requireAnyPermission(locals, ["loans", "catalog"]);
	return {
		/** The desk's tabs; a cataloguer without the desk gets the catalogue's. */
		hasLoans: can(user, "loans"),
		canCatalog: can(user, "catalog"),
		seesRequester: canSeePatrons(user),
		/** The requester is picked with the desk's patron search. */
		canSetRequester: can(user, "loans"),
	};
};
