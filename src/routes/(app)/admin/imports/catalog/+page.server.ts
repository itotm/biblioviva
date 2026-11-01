// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import type { PageServerLoad } from "./$types";

/** Catalogue import wizard (step 3.9): `catalog.import`. */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "catalog.import");
	const { catalog } = getConfig();
	return {
		specialAuthor: catalog.specialAuthors[0] ?? "Anonimo",
		unknownPublisher: catalog.unknownPublisher,
	};
};
