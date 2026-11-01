// SPDX-License-Identifier: GPL-3.0-or-later
import { error } from "@sveltejs/kit";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** One book of the classification flow (step 9.21); requires the `catalog` permission. */
export const load: PageServerLoad = ({ locals, params }) => {
	requirePermission(locals, "catalog");
	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) {
		error(404, "biblio not found");
	}
	return { id };
};
