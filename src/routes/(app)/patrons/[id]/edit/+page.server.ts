// SPDX-License-Identifier: GPL-3.0-or-later
import { error } from "@sveltejs/kit";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { orNotFound } from "#lib/server/http/errors.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import { getPatron } from "#lib/server/services/patrons.js";
import { classOptions } from "#lib/server/services/patron-census.js";
import { patronSortName } from "#lib/shared/patron-name.js";
import { schoolOf } from "#lib/server/school/structure.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, params }) => {
	requirePermission(locals, "patrons");
	if (!/^\d+$/.test(params.id)) {
		error(404, "patron not found");
	}
	const config = getConfig();
	const p = orNotFound(() => getPatron(getDb(), Number(params.id), libraryToday(config)));
	return {
		id: p.id,
		rules: classOptions(getDb(), schoolOf(config)),
		initial: {
			patronType: p.patronType,
			firstName: p.firstName,
			lastName: p.lastName,
			levelCode: p.levelCode ?? "",
			groupId: p.groupId === null ? "" : String(p.groupId),
			groupName: "",
			cardNumber: p.cardNumber ?? "",
			externalId: p.externalId ?? "",
			email: p.email ?? "",
			circulationNote: p.circulationNote ?? "",
			notes: p.notes ?? "",
		},
		name: patronSortName(p),
	};
};
