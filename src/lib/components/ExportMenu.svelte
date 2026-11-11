<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Esporta" menu of every grid (§3.19): CSV and ODS links to /export/<table> with the current
     filters; a list of books or copies adds the four MARC formats (step 9.65). -->
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
		/** The list's rows are books or copies: the MARC formats too (9.65). */
		marc?: boolean;
		class?: string;
	}

	const { table, params = {}, marc = false, class: className = "" }: Props = $props();
	const MARC = ["marc21", "marc21-xml", "unimarc", "unimarc-xml"] as const;
	const i18n = useI18n();
	const ExportIcon = icons.export;
	const MoreIcon = icons.more;

	const href = $derived((format: "csv" | "ods" | (typeof MARC)[number]) => {
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
		{#if marc}
			{#each MARC as f (f)}
				<MenuItem value={f} href={href(f)} download data-testid="export-{f}"
					>{i18n.t(`common.export.${f}`)}</MenuItem
				>
			{/each}
		{/if}
	</MenuPanel>
</Menu>
