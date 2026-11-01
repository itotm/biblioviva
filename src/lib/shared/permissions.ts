// SPDX-License-Identifier: GPL-3.0-or-later
// The fixed list of permissions known to the code (PLAN.md §3.5). Roles are configuration.
export const PERMISSIONS = [
	"loans",
	"patrons",
	"patrons.import",
	"catalog",
	"catalog.import",
	"reports",
	"anonymize",
	"admin",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * The accounts that see the catalogue (owner): the desk, cataloguing and reports; an account that
 * only makes cards and enrols patrons (`patrons`) has nothing to do there.
 */
export const CATALOG_READERS: readonly Permission[] = [
	"catalog",
	"catalog.import",
	"loans",
	"reports",
];

/** A role grants a list of permissions, or everything with `*`. */
export type RoleGrant = Permission | "*";

export function isPermission(value: unknown): value is Permission {
	return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

/** Client-side check on the permission list sent by the layout (`data.user.permissions`). */
export function hasPermission(
	user: { permissions: readonly string[] } | null | undefined,
	permission: Permission,
): boolean {
	return Boolean(user?.permissions.includes(permission));
}
