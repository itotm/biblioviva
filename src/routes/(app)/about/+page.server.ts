// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import inventory from "#lib/generated/dependencies.json";
import { getConfig } from "#lib/server/config/index.js";
import { shownVersion } from "#lib/server/demo/public.js";
import type { PageServerLoad } from "./$types";

/** About page (step 1.12): every logged-in account. */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals);
	return { inventory, version: shownVersion(getConfig().library.timezone) };
};
