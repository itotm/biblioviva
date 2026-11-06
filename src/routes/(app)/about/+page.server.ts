// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import inventory from "#lib/generated/dependencies.json";
import { getConfig } from "#lib/server/config/index.js";
import { shownVersion } from "#lib/server/demo/public.js";
import { docsBase } from "#lib/ui/help-links.js";
import type { ExternalHref } from "#lib/ui/href.js";
import type { PageServerLoad } from "./$types";

/** About page (step 1.12): every logged-in account; the libraries are a page of the documentation (9.53). */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals);
	return {
		app: inventory.app,
		version: shownVersion(getConfig().library.timezone),
		librariesHref: `${docsBase(locals.locale)}tech/libraries/` as ExternalHref,
	};
};
