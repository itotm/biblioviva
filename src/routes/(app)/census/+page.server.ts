// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { requireFeature } from "#lib/server/features.js";
import { getConfig } from "#lib/server/config/index.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "patrons");
	requireFeature("photos");
	// the browser scales a class picture to this before sending it (Phase 13)
	return { sheetMaxPixels: getConfig().photos.sheet.maxPixels };
};
