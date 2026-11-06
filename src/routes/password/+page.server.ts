// SPDX-License-Identifier: GPL-3.0-or-later
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { MIN_PASSWORD_LENGTH } from "#lib/server/auth/password.js";
import { isDemoPublic } from "#lib/server/demo/public.js";
import type { PageServerLoad } from "./$types";

/** One's own password (9.51): any account, the one whose change is due included. */
export const load: PageServerLoad = ({ locals }) => {
	const user = requirePermission(locals);
	return {
		forced: user.mustChangePassword === true,
		displayName: user.displayName,
		minPassword: MIN_PASSWORD_LENGTH,
		demoPublic: isDemoPublic(),
	};
};
