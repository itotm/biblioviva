<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The back button of a page (9.13, round 1): it returns to the page the operator came from inside
     the app (the browser's Back, so scroll position and filters come back too) and says which one;
     opened directly, it goes to the parent page instead. An arrow with a 44 px target; its name and
     tooltip say where it goes (9.13, round 24: the label beside the arrow is gone). -->
<script lang="ts">
	import type { ResolvedPathname } from "$app/types";
	import { useI18n } from "#lib/i18n/context.js";
	import { backStack } from "./back-stack.svelte.js";
	import { icons } from "./icons.js";
	import { NAV_ITEMS } from "./nav.js";
	import IconButton from "./IconButton.svelte";

	interface Props {
		/** The parent page, used when the page was opened directly. */
		href: ResolvedPathname;
		/** The parent page's name. */
		label: string;
	}

	const { href, label }: Props = $props();
	const i18n = useI18n();
	const previous = $derived(backStack.previous);
	// the parent's name: the one given by the page, or the area's own name for the dashboard and
	// the sections of the sidebar (pages still passing the generic "Indietro")
	const parent = $derived.by(() => {
		if (label && label !== i18n.t("common.actions.back")) {
			return label;
		}
		if (href === "/") {
			return i18n.t("nav.dashboard");
		}
		const item = NAV_ITEMS.find((i) => i.href === href);
		return item ? i18n.t(`nav.${item.key}`) : label;
	});
	const target = $derived(previous?.title || parent);
</script>

<IconButton
	variant="tonal"
	icon={icons.back}
	href={previous ? undefined : href}
	onclick={previous ? () => history.back() : undefined}
	class="bv-page-back size-11 shrink-0"
	label={i18n.t("common.actions.backTo", { page: target })}
	data-testid="page-back"
	data-back={previous ? "history" : "parent"}
/>
