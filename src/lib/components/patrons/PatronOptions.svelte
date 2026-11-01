<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The list of patrons under a name search (steps 4.3, 5.2): photo thumbnail, name, class, the
     mark of an approximate match; the field that owns it moves `active` with the arrow keys. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import type { QuickPatron } from "#lib/server/services/patron-search.js";
	import ClassBadge from "#lib/components/ClassBadge.svelte";
	import SimilarBadge from "#lib/components/SimilarBadge.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import { photosOn } from "#lib/ui/features.js";

	interface Props {
		/** The id of the listbox (the field's `aria-controls`); options are `<id>-opt-<patron>`. */
		id: string;
		rows: readonly QuickPatron[];
		active: number;
		onpick: (patron: QuickPatron) => void;
		testid: string;
	}

	const { id, rows, active, onpick, testid }: Props = $props();
	const i18n = useI18n();
</script>

<ul
	{id}
	role="listbox"
	class="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto card preset-filled-surface-50-950 p-1 shadow-xl"
	data-testid={testid}
>
	{#each rows as r, i (r.id)}
		<li
			id="{id}-opt-{r.id}"
			role="option"
			aria-selected={i === active}
			class="flex cursor-pointer items-center gap-3 rounded-base px-2 py-1.5 hover:preset-tonal {i ===
			active
				? 'preset-tonal-primary'
				: ''}"
			onmousedown={(e) => {
				e.preventDefault();
				onpick(r);
			}}
		>
			{#if photosOn()}
				<img
					src="/media/patrons/{r.id}/thumb"
					alt=""
					class="h-10 w-8 rounded object-cover"
				/>
			{/if}
			<span class="grow font-semibold">{patronSortName(r)}</span>
			{#if r.similar}<SimilarBadge />{/if}
			<ClassBadge label={r.classLabel} fallback={i18n.t("circulation.checkout.teacher")} />
		</li>
	{:else}
		<li class="px-2 py-1.5">
			<Hint as="span">{i18n.t("circulation.checkout.noResults")}</Hint>
		</li>
	{/each}
</ul>
