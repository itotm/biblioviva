// SPDX-License-Identifier: GPL-3.0-or-later
// The areas of the app (PLAN.md §3.18): each item is shown only with its permission. The dashboard
// has no item: the logo at the top-left links to it (owner review, step 2.3b).
import type { ResolvedPathname } from "$app/types";
import { CATALOG_READERS, type Permission } from "#lib/shared/permissions.js";
import type { AreaKey } from "#lib/shared/theme-palette.js";
import type { IconName } from "./icons.js";

export interface NavItem {
	/** i18n key under `nav` */
	key: AreaKey;
	href: ResolvedPathname;
	icon: IconName;
	/** Permissions of which one is needed to see the item (undefined = everyone logged in). */
	permission?: Permission | readonly Permission[];
	/** Shown in the mobile bottom bar (at most four; the rest go under "Altro"). */
	mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
	{ key: "circulation", href: "/circulation", icon: "loan", permission: "loans", mobile: true },
	{
		key: "catalog",
		href: "/catalog",
		icon: "catalog",
		permission: CATALOG_READERS,
		mobile: true,
	},
	{ key: "patrons", href: "/patrons", icon: "patrons", permission: "patrons", mobile: true },
	// print lists hold patrons (cards) or copies (labels): nothing to do there without either
	{ key: "printing", href: "/print-lists", icon: "print", permission: ["patrons", "catalog"] },
	// the staff notes are for every account (9.18)
	{ key: "notes", href: "/notes", icon: "notes" },
	{ key: "reports", href: "/reports", icon: "reports", permission: "reports" },
	{ key: "admin", href: "/admin", icon: "admin", permission: "admin" },
];

export function visibleNavItems(
	user: { permissions: readonly string[] } | null | undefined,
): NavItem[] {
	return NAV_ITEMS.filter((item) => hasAny(user, item.permission));
}

/** True without a requirement, or when the account holds one of the permissions. */
export function hasAny(
	user: { permissions: readonly string[] } | null | undefined,
	permission: Permission | readonly Permission[] | undefined,
): boolean {
	if (permission === undefined) {
		return true;
	}
	const list: readonly Permission[] = typeof permission === "string" ? [permission] : permission;
	return list.some((p) => user?.permissions.includes(p) ?? false);
}

/**
 * The area of the navigation a page belongs to (step 9.16): the top bar takes its colour and the
 * menu highlights it. Pages reached from an area's tabs count as that area (`/census` is Utenti,
 * `/inventory` Catalogo, `/wishlist` the desk's); the dashboard and the pages outside the areas
 * have none.
 */
export function areaOf(pathname: string): AreaKey | null {
	const prefixes: [string, AreaKey][] = [
		["/circulation", "circulation"],
		["/wishlist", "circulation"],
		["/calendar", "circulation"],
		["/catalog", "catalog"],
		["/cataloging", "catalog"],
		["/inventory", "catalog"],
		["/patrons", "patrons"],
		["/census", "patrons"],
		["/print-lists", "printing"],
		["/notes", "notes"],
		["/reports", "reports"],
		["/admin", "admin"],
	];
	return prefixes.find(([p]) => isCurrent(pathname, p))?.[1] ?? null;
}

export function isCurrent(pathname: string, href: string): boolean {
	return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
