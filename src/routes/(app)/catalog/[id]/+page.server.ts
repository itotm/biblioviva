// SPDX-License-Identifier: GPL-3.0-or-later
import { error } from "@sveltejs/kit";
import { requireAnyPermission } from "#lib/server/auth/load-guard.js";
import { CATALOG_READERS } from "#lib/shared/permissions.js";
import { getConfig } from "#lib/server/config/index.js";
import { catalogRules, classificationOptions } from "#lib/server/services/catalog.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, params }) => {
	requireAnyPermission(locals, CATALOG_READERS);
	if (!/^\d+$/.test(params.id)) {
		error(404, "biblio not found");
	}
	const config = getConfig();
	return {
		id: Number(params.id),
		options: classificationOptions(catalogRules(config)),
		coverWidth: config.covers.width,
	};
};
