// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** A new report (step 9.20), blank or a copy of `?from=<id>`; requires the `admin` permission. */
export const load: PageServerLoad = ({ locals, url }) => {
	requirePermission(locals, "admin");
	const from = url.searchParams.get("from");
	return { from: from && /^[a-z0-9][a-z0-9-]{0,63}$/.test(from) ? from : null };
};
