<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The pages of a grid paged on the server (step 9.65): Precedenti, the range shown, Successivi.
     Loaded only when the list has more rows than a page, so the page stays within its budget. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import Button from "./Button.svelte";
	import Row from "./Row.svelte";
	import { icons } from "./icons.js";

	interface Props {
		/** The page shown, from 0. */
		index: number;
		size: number;
		total: number;
		onpage: (index: number) => void;
	}

	const { index, size, total, onpage }: Props = $props();
	const i18n = useI18n();
	const PreviousIcon = icons.back;
	const NextIcon = icons.forward;
</script>

<Row align="center" gap="2" data-testid="catalog-pages">
	<Button
		size="sm"
		icon={PreviousIcon}
		disabled={index === 0}
		onclick={() => onpage(index - 1)}
		data-testid="page-previous">{i18n.t("catalog.list.pagePrevious")}</Button
	>
	<span data-testid="page-range"
		>{i18n.t("catalog.list.pageRange", {
			from: index * size + 1,
			to: Math.min(total, (index + 1) * size),
			total,
		})}</span
	>
	<Button
		size="sm"
		icon={NextIcon}
		disabled={(index + 1) * size >= total}
		onclick={() => onpage(index + 1)}
		data-testid="page-next">{i18n.t("catalog.list.pageNext")}</Button
	>
</Row>
