<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The print basket of the app bar (step 2.8): the number of lists still to print and a menu
     with those lists, then the lists index. -->
<script lang="ts">
	import { Menu } from "@skeletonlabs/skeleton-svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { getPrintBasket } from "#lib/remote/print-lists.remote.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Hint from "#lib/ui/Hint.svelte";
	import MenuItem from "#lib/ui/MenuItem.svelte";
	import MenuPanel from "#lib/ui/MenuPanel.svelte";

	const i18n = useI18n();
	const basket = getPrintBasket();
	const BasketIcon = icons.lists;
	const KIND_ICON = { patrons: icons.card, items: icons.label } as const;
	const lists = $derived(basket.current?.lists ?? []);
	const toPrint = $derived(lists.length);
</script>

<Menu>
	<Menu.Trigger
		class="relative btn hover:preset-tonal"
		aria-label={toPrint > 0
			? i18n.t("printing.basket.labelToPrint", { count: toPrint })
			: i18n.t("printing.basket.label")}
		data-testid="print-basket"
	>
		<BasketIcon size={ICON_SIZE.md} aria-hidden="true" />
		{#if toPrint > 0}
			<span
				class="absolute -top-1 -right-1 min-w-5 rounded-full bg-primary-500 px-1 text-center text-xs font-bold text-primary-contrast-500"
				data-testid="print-basket-count">{toPrint}</span
			>
		{/if}
	</Menu.Trigger>
	<MenuPanel minWidth="56">
		<div class="max-h-80 overflow-y-auto">
			{#each lists as l (l.id)}
				<MenuItem
					value="list-{l.id}"
					href="/print-lists/{l.id}"
					icon={KIND_ICON[l.kind]}
					data-testid="print-basket-list"
				>
					{i18n.t("printing.basket.entry", { name: l.name, count: l.count })}
				</MenuItem>
			{:else}
				<Hint class="px-3 py-2">{i18n.t("printing.basket.none")}</Hint>
			{/each}
		</div>
		<MenuItem value="all" href="/print-lists" strong>{i18n.t("printing.basket.all")}</MenuItem>
	</MenuPanel>
</Menu>
