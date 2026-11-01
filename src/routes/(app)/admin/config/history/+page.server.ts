// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { schemaSections } from "#lib/server/config/introspect.js";
import type { PageServerLoad } from "./$types";

/** The history of configuration changes (step 11.2); requires the `admin` permission. */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "admin");
	return { timezone: getConfig().library.timezone, sections: schemaSections() };
};
