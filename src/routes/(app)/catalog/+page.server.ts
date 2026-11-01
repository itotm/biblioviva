// SPDX-License-Identifier: GPL-3.0-or-later
import { requireAnyPermission } from "#lib/server/auth/load-guard.js";
import { CATALOG_READERS } from "#lib/shared/permissions.js";
import type { PageServerLoad } from "./$types";

/** The catalogue is readable by the accounts of `CATALOG_READERS`; editing needs `catalog`. */
export const load: PageServerLoad = ({ locals }) => {
	requireAnyPermission(locals, CATALOG_READERS);
	return {};
};
