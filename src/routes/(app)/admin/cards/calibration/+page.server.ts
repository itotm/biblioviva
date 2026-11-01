// SPDX-License-Identifier: GPL-3.0-or-later
// "Calibra la stampa fronte-retro" (step 9.27, Q127): administrators only.
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, "admin");
	const { duplex } = getConfig().cards;
	return { flip: duplex.flip, offset: duplex.backOffsetMm };
};
