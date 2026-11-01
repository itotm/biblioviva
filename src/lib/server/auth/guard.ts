// SPDX-License-Identifier: GPL-3.0-or-later
// `requireUser('<permission>')` (or `requireAnyUser([...])` where one of several permissions
// opens a function): the first line of every remote function (PLAN.md §3.4).
import { getRequestEvent } from "$app/server";
import type { Permission } from "#lib/shared/permissions.js";
import { requireAnyPermission, requirePermission } from "./load-guard.js";
import type { AuthUser } from "./types.js";

export function requireUser(permission?: Permission): AuthUser {
	return requirePermission(getRequestEvent().locals, permission);
}

/** One of several permissions (the wishlist: `loans` or `catalog`). */
export function requireAnyUser(permissions: readonly Permission[]): AuthUser {
	return requireAnyPermission(getRequestEvent().locals, permissions);
}
