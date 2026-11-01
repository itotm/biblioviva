<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Esporta" menu of every grid (§3.19): CSV and ODS links to /export/<table> with the current filters. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { Menu } from "@skeletonlabs/skeleton-svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import MenuItem from "#lib/ui/MenuItem.svelte";
	import MenuPanel from "#lib/ui/MenuPanel.svelte";

	interface Props {
		/** Registered export table name. */
		table: string;
		/** Current grid filters (empty values are dropped). */
		params?: Record<string, string | number | undefined | null>;
		class?: string;
	}

	const { table, params = {}, class: className = "" }: Props = $props();
	const i18n = useI18n();
	const ExportIcon = icons.export;
	const MoreIcon = icons.more;

	const href = $derived((format: "csv" | "ods") => {
		const pairs = [`format=${format}`];
		for (const [k, value] of Object.entries(params)) {
			if (value !== undefined && value !== null && value !== "") {
				pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(value))}`);
			}
		}
		return resolve(`export/${encodeURIComponent(table)}?${pairs.join("&")}`);
	});
</script>

<Menu>
	<Menu.Trigger class="btn preset-tonal {className}" data-testid="export-menu">
		<ExportIcon size={ICON_SIZE.md} aria-hidden="true" />
		<span>{i18n.t("common.actions.export")}</span>
		<MoreIcon size={ICON_SIZE.sm} aria-hidden="true" />
	</Menu.Trigger>
	<MenuPanel minWidth="44">
		<MenuItem value="csv" href={href("csv")} download>{i18n.t("common.export.csv")}</MenuItem>
		<MenuItem value="ods" href={href("ods")} download>{i18n.t("common.export.ods")}</MenuItem>
	</MenuPanel>
</Menu>
