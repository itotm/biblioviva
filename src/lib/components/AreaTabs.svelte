<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	The pages of an area (9.13, rounds 13 and 24), a switch between views (`ChoiceButtons`): the
	layout rule of the app puts them in the first row of the page's toolbar (`PageHeader views`),
	the page's actions (create, edit, print; one primary at most) in the row under them. A page the
	account may not open is left out.
-->
<script module lang="ts">
	import type { Permission } from "#lib/shared/permissions.js";
	import type { IconName } from "#lib/ui/icons.js";

	interface AreaPage {
		key: string;
		href: ResolvedPathname;
		icon: IconName;
		/** Needed to open the page (none: every account that sees the area). */
		permission?: Permission;
		/** Left out for accounts holding this one (they have the page in another area). */
		unless?: Permission;
		/** Left out while patron photos are switched off (9.38). */
		photos?: true;
	}

	export const AREAS = {
		circulation: [
			{ key: "checkout", href: "/circulation/checkout", icon: "loan" },
			{ key: "checkin", href: "/circulation/checkin", icon: "return" },
			{ key: "loans", href: "/circulation/loans", icon: "lists" },
			{ key: "overdues", href: "/circulation/overdues", icon: "overdue" },
			{ key: "wishlist", href: "/wishlist", icon: "wishlist" },
			{ key: "calendar", href: "/calendar", icon: "calendar" },
		],
		catalog: [
			{ key: "catalog", href: "/catalog", icon: "catalog" },
			{ key: "inventory", href: "/inventory", icon: "inventory", permission: "catalog" },
			{
				key: "toClassify",
				href: "/catalog/to-classify",
				icon: "toClassify",
				permission: "catalog",
			},
			// the wishlist is a desk page; a cataloguer without the desk finds it here (9.15)
			{
				key: "wishlist",
				href: "/wishlist",
				icon: "wishlist",
				permission: "catalog",
				unless: "loans",
			},
		],
		patrons: [
			{ key: "patrons", href: "/patrons", icon: "patrons" },
			{ key: "census", href: "/census", icon: "camera", permission: "patrons", photos: true },
		],
		notes: [
			{ key: "open", href: "/notes", icon: "notes" },
			{ key: "archived", href: "/notes/archive", icon: "archive" },
		],
		config: [
			{ key: "overview", href: "/admin/config", icon: "config" },
			{ key: "history", href: "/admin/config/history", icon: "history" },
		],
		templates: [
			{ key: "edit", href: "/admin/config/templates", icon: "edit" },
			{ key: "previews", href: "/admin/cards/templates", icon: "view" },
		],
		imports: [
			{
				key: "catalog",
				href: "/admin/imports/catalog",
				icon: "catalog",
				permission: "catalog.import",
			},
			{
				key: "students",
				href: "/admin/imports/students",
				icon: "patrons",
				permission: "patrons.import",
			},
			{
				key: "teachers",
				href: "/admin/imports/teachers",
				icon: "teacher",
				permission: "patrons.import",
			},
			{ key: "loans", href: "/admin/imports/loans", icon: "loan", permission: "admin" },
			{
				key: "photos",
				href: "/admin/imports/photos",
				icon: "camera",
				permission: "admin",
				photos: true,
			},
		],
	} as const satisfies Record<string, readonly AreaPage[]>;

	export type Area = keyof typeof AREAS;
	export type AreaKey<A extends Area> = (typeof AREAS)[A][number]["key"];
</script>

<script lang="ts" generics="A extends Area">
	import type { ResolvedPathname } from "$app/types";
	import { page } from "$app/state";
	import { useI18n } from "#lib/i18n/context.js";
	import { hasPermission } from "#lib/shared/permissions.js";
	import { icons } from "#lib/ui/icons.js";
	import ChoiceButtons from "#lib/ui/ChoiceButtons.svelte";
	import { photosOn } from "#lib/ui/features.js";

	interface Props {
		area: A;
		current: AreaKey<A>;
	}

	const { area, current }: Props = $props();
	const i18n = useI18n();
	// the circulation desk kept its test ids from before the rule (4.3–4.6)
	const prefix = $derived(area === "circulation" ? "desk" : `area-${area}`);
	const user = $derived(page.data.user as { permissions: readonly string[] } | null);
	const choices = $derived(
		(AREAS[area] as readonly AreaPage[])
			.filter(
				(p) =>
					(!p.permission || hasPermission(user, p.permission)) &&
					!(p.unless && hasPermission(user, p.unless)) &&
					!(p.photos && !photosOn()),
			)
			.map((p) => ({
				key: p.key as AreaKey<A>,
				href: p.href,
				icon: icons[p.icon],
				label: i18n.t(`nav.areas.${area}.${p.key}`),
			})),
	);
</script>

<!-- a single page is no choice: the row appears from two pages on (9.13, round 16) -->
{#if choices.length > 1}
	<ChoiceButtons
		{choices}
		{current}
		label={i18n.t(`nav.areas.${area}.label`)}
		testid="{prefix}-tabs"
		itemTestid="{prefix}-tab-"
		framed={false}
	/>
{/if}
