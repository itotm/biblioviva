// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/**
 * Template previews (step 2.5b): with the templates' editor they form one area of the
 * configuration, so whoever sees them can also change them — `admin` (owner decision).
 */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "admin");
	return {};
};
