// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { schoolOf } from "#lib/server/school/structure.js";
import { classOptions } from "#lib/server/services/patron-census.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "patrons");
	const config = getConfig();
	const { photos } = config;
	return {
		photoRequired: photos.required,
		photoWidth: photos.width,
		photoHeight: photos.height,
		rules: classOptions(getDb(), schoolOf(config)),
	};
};
