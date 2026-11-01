<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A patron in a print list of cards (step 2.8): name linking to the patron, class, card number
     and whether the card has been printed. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import Hint from "#lib/ui/Hint.svelte";
	import ClassBadge from "../ClassBadge.svelte";
	import PrintedBadge from "./PrintedBadge.svelte";

	interface Props {
		row: {
			entityId: number;
			firstName: string;
			lastName: string;
			classLabel: string;
			patronType: string;
			cardNumber: string | null;
			cardPrintedAt: string | null;
		};
	}

	const { row }: Props = $props();
	const i18n = useI18n();
</script>

<a href={resolve(`patrons/${row.entityId}`)} class="font-semibold hover:underline"
	>{patronSortName(row)}</a
>
<ClassBadge
	label={row.classLabel}
	fallback={row.patronType === "teacher" ? i18n.t("patrons.types.teacher") : ""}
/>
<Hint as="span" mono>{row.cardNumber ?? ""}</Hint>
<PrintedBadge status={row.cardPrintedAt ? "printed" : "pending"} data-testid="entry-printed">
	{i18n.t("printing.list.columns.printed")}: {i18n.t(
		row.cardPrintedAt ? "printing.list.printedYes" : "printing.list.printedNo",
	)}
</PrintedBadge>
