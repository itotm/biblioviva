// SPDX-License-Identifier: GPL-3.0-or-later
import { redirect } from "@sveltejs/kit";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import type { PageServerLoad } from "./$types";

/** The circulation area opens on the checkout desk. */
export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "loans");
	redirect(303, "/circulation/checkout");
};
