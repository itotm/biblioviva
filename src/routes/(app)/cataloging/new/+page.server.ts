// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { enabledProviders } from "#lib/server/metadata/index.js";
import { catalogRules, classificationOptions } from "#lib/server/services/catalog.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "catalog");
	const config = getConfig();
	return {
		options: classificationOptions(catalogRules(config)),
		providers: enabledProviders(config).map((p) => ({ id: p.id, name: p.name })),
		coverWidth: config.covers.width,
		// the cover is looked up while the form is shown (9.13, round 11), never with covers off (9.38)
		autoFetchCover: config.covers.enabled && config.covers.autoFetch,
	};
};
