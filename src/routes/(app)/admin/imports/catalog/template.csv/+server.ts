// SPDX-License-Identifier: GPL-3.0-or-later
// The template of the catalogue import (one row per copy) with the columns chosen on the page
// (steps 3.9, 9.19, Q115).
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { templateResponse } from "#lib/server/imports/template.js";
import { CATALOG_IMPORT } from "#lib/shared/import-columns.js";

export const GET: RequestHandler = ({ locals, url }) => {
	requirePermission(locals, "catalog.import");
	return templateResponse(CATALOG_IMPORT, url, "catalog-template.csv", "catalog");
};
