// SPDX-License-Identifier: GPL-3.0-or-later
import { error } from "@sveltejs/kit";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { TEMPLATE_NAME } from "#lib/server/services/template-folders.js";
import type { PageServerLoad } from "./$types";

/** The template editor (step 11.10); requires the `admin` permission. */
export const load: PageServerLoad = ({ locals, params }) => {
	requirePermission(locals, "admin");
	const kind = (["cards", "labels", "slips"] as const).find((k) => k === params.kind);
	if (!kind || !TEMPLATE_NAME.test(params.name)) {
		error(404, "not found");
	}
	return { kind, name: params.name };
};
