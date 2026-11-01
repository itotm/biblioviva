// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { requireFeature } from "#lib/server/features.js";
import type { PageServerLoad } from "./$types";

/** Patron photos from Koha (step 3.9b): `admin` only. */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "admin");
	requireFeature("photos");
	return {};
};
