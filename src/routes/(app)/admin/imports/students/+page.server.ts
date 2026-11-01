// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { can } from "#lib/server/auth/rbac.js";
import type { PageServerLoad } from "./$types";

/** Student import (steps 2.6, 9.19): `patrons.import`; the removal question also needs `anonymize`. */
export const load: PageServerLoad = ({ locals }) => {
	const user = requirePermission(locals, "patrons.import");
	return { canRemove: can(user, "anonymize") };
};
