<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The one wait of the app (owner request): the large turning icon with "Caricamento…" under it,
     centred in the room the content will take, announced politely. `page` (the default) is a page
     or a whole part of it waiting: centred across and down a good part of the window; `md` a box
     or a dialog; `sm` a single line beside other content (a camera starting). The wait overlay
     shows the same, centred in the page's part of the window. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import Spinner from "./Spinner.svelte";

	interface Props {
		size?: "sm" | "md" | "page";
		/** Off inside a live region of its own (the wait overlay). */
		announce?: boolean;
		class?: string;
	}

	const { size = "page", announce = true, class: className = "" }: Props = $props();
	const i18n = useI18n();
	const BOX = {
		sm: "gap-2 py-1",
		md: "flex-col gap-3 py-8",
		page: "flex-col gap-3 py-8 min-h-[50svh]",
	} as const;
</script>

<div
	class="flex items-center justify-center text-surface-800 {BOX[size]} {className}"
	role={announce ? "status" : undefined}
	aria-live={announce ? "polite" : undefined}
	data-testid="loading"
>
	<Spinner size={size === "sm" ? "md" : "wait"} />
	<span class="font-semibold {size === 'sm' ? '' : 'text-lg'}"
		>{i18n.t("common.status.loading")}</span
	>
</div>
