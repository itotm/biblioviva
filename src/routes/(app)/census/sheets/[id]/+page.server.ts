// SPDX-License-Identifier: GPL-3.0-or-later
import { error } from "@sveltejs/kit";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { requireFeature } from "#lib/server/features.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, params }) => {
	requirePermission(locals, "patrons");
	requireFeature("photos");
	if (!/^\d{1,9}$/.test(params.id)) {
		error(404, "not found");
	}
	return { id: Number(params.id) };
};
