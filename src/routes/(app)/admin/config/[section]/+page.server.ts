// SPDX-License-Identifier: GPL-3.0-or-later
import { error } from "@sveltejs/kit";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { schemaSections } from "#lib/server/config/introspect.js";
import type { PageServerLoad } from "./$types";

/** One section of the configuration (step 11.2); requires the `admin` permission. */
export const load: PageServerLoad = ({ locals, params }) => {
	requirePermission(locals, "admin");
	if (!schemaSections().includes(params.section)) {
		error(404, "not found");
	}
	return { section: params.section, timezone: getConfig().library.timezone };
};
