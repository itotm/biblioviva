// SPDX-License-Identifier: GPL-3.0-or-later
import { error } from "@sveltejs/kit";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, params }) => {
	requirePermission(locals, "patrons");
	if (!/^\d+$/.test(params.id)) {
		error(404, "patron not found");
	}
	return { id: Number(params.id) };
};
