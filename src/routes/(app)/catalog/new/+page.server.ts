// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { catalogRules, classificationOptions } from "#lib/server/services/catalog.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "catalog");
	return { options: classificationOptions(catalogRules(getConfig())) };
};
