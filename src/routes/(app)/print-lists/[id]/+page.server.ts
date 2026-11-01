// SPDX-License-Identifier: GPL-3.0-or-later
import { error } from "@sveltejs/kit";
import { requireAnyPermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** The kind's permission is checked by the remote functions (patrons / catalog). */
export const load: PageServerLoad = ({ locals, params }) => {
	// cards (patrons) or labels (catalog): nothing to do here without either (9.13, round 16)
	requireAnyPermission(locals, ["patrons", "catalog"]);
	if (!/^\d+$/.test(params.id)) {
		error(404, "print list not found");
	}
	return { id: Number(params.id) };
};
