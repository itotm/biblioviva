// SPDX-License-Identifier: GPL-3.0-or-later
// Guards for `load` functions and endpoints (remote functions use `requireUser` from guard.ts).
import { error } from "@sveltejs/kit";
import type { Permission } from "#lib/shared/permissions.js";
import { AuthError, authorize, authorizeAny } from "./rbac.js";
import type { AuthUser } from "./types.js";

/** Runs an authorization check, a refusal rendered as the 401/403 error page. */
function authorizedOrHttp(check: () => AuthUser): AuthUser {
	try {
		return check();
	} catch (e) {
		if (e instanceof AuthError) {
			error(e.status, e.message);
		}
		throw e;
	}
}

/** Returns the user or renders the 401/403 error page. */
export function requirePermission(locals: App.Locals, permission?: Permission): AuthUser {
	return authorizedOrHttp(() => authorize(locals.user, permission));
}

/** One of several permissions (the print lists: `patrons` for cards or `catalog` for labels). */
export function requireAnyPermission(
	locals: App.Locals,
	permissions: readonly Permission[],
): AuthUser {
	return authorizedOrHttp(() => authorizeAny(locals.user, permissions));
}
