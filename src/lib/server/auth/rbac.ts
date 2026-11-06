// SPDX-License-Identifier: GPL-3.0-or-later
// Permissions, not roles, in code (PLAN.md §3.5). Pure functions; `requireUser` lives in guard.ts.
import { isPermission, PERMISSIONS, type Permission } from "#lib/shared/permissions.js";
import type { AuthUser } from "./types.js";

/** Expands role names into the flat permission list; `*` grants everything; unknown roles grant nothing. */
export function permissionsOf(
	roles: readonly string[],
	rolesConfig: Record<string, readonly string[]>,
): Permission[] {
	const set = new Set<Permission>();
	for (const role of roles) {
		for (const grant of rolesConfig[role] ?? []) {
			if (grant === "*") {
				PERMISSIONS.forEach((p) => set.add(p));
			} else if (isPermission(grant)) {
				set.add(grant);
			}
		}
	}
	return PERMISSIONS.filter((p) => set.has(p));
}

/**
 * The usernames of the active accounts that hold `admin` with these roles: there must always be
 * one (the configuration check, the staff accounts editor).
 */
export function activeAdmins(
	users: readonly { username: string; roles: readonly string[]; active: boolean }[],
	rolesConfig: Record<string, readonly string[]>,
): string[] {
	return users
		.filter((u) => u.active && permissionsOf(u.roles, rolesConfig).includes("admin"))
		.map((u) => u.username);
}

export function can(
	user: Pick<AuthUser, "permissions"> | null | undefined,
	permission: Permission,
): boolean {
	return Boolean(user?.permissions.includes(permission));
}

/** Any one of the permissions. */
export function canAny(
	user: Pick<AuthUser, "permissions"> | null | undefined,
	permissions: readonly Permission[],
): boolean {
	return permissions.some((p) => can(user, p));
}

/**
 * Who sees the patrons behind a loan or a wish: their names are personal data of (mostly minor)
 * patrons, so only the accounts of the desk and of the patron list read them.
 */
export function canSeePatrons(user: Pick<AuthUser, "permissions"> | null | undefined): boolean {
	return canAny(user, ["loans", "patrons"]);
}

/**
 * An account whose only area is circulation opens on the checkout desk instead of the dashboard
 * (step 4.3), so the desk shows what the dashboard would (the pinned notes, 9.18).
 */
export function opensOnDesk(user: Pick<AuthUser, "permissions">): boolean {
	return can(user, "loans") && user.permissions.every((p) => p === "loans");
}

export class AuthError extends Error {
	constructor(
		readonly status: 401 | 403,
		message: string,
	) {
		super(message);
		this.name = "AuthError";
	}
}

/** Throws 401 without a user, 403 without any of the permissions; returns the user otherwise. */
export function authorizeAny(
	user: AuthUser | null | undefined,
	permissions: readonly Permission[],
): AuthUser {
	const known = authorize(user);
	refuseUntilPasswordChanged(known);
	if (!canAny(known, permissions)) {
		throw new AuthError(403, `forbidden: ${permissions.join(" or ")}`);
	}
	return known;
}

/** Throws 401 without a user, 403 without the permission; returns the user otherwise. */
export function authorize(user: AuthUser | null | undefined, permission?: Permission): AuthUser {
	if (!user) {
		throw new AuthError(401, "unauthorized");
	}
	if (permission) {
		refuseUntilPasswordChanged(user);
	}
	if (permission && !can(user, permission)) {
		throw new AuthError(403, `forbidden: ${permission}`);
	}
	return user;
}

/**
 * An account whose password was given by an administrator opens nothing but the change of its
 * own password (9.51): every check of a permission is refused until then.
 */
function refuseUntilPasswordChanged(user: AuthUser): void {
	if (user.mustChangePassword) {
		throw new AuthError(403, "password change required");
	}
}
