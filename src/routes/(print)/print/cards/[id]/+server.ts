// SPDX-License-Identifier: GPL-3.0-or-later
// `/print/cards/<id>`: one unit (front + back) for reprints and card printers.
import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";

export const GET: RequestHandler = ({ locals, params, url }) => {
	requirePermission(locals, "patrons");
	if (!/^\d+$/.test(params.id)) {
		error(404, "patron not found");
	}
	const target = new URL("/print/cards", url);
	target.searchParams.set("ids", params.id);
	const template = url.searchParams.get("template");
	if (template) {
		target.searchParams.set("template", template);
	}
	redirect(302, target.pathname + target.search);
};
