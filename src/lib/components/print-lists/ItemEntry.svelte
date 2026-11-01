<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A copy in a print list of copies (step 3.8): barcode, title linking to its record, author,
     segnatura and how far its labels are printed. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { labelStatus } from "#lib/shared/copy-status.js";
	import Hint from "#lib/ui/Hint.svelte";
	import Link from "#lib/ui/Link.svelte";
	import PrintedBadge from "./PrintedBadge.svelte";

	interface Props {
		row: {
			biblioId: number;
			barcode: string;
			title: string;
			author: string;
			callNumber: string | null;
			barcodeLabelPrintedAt: string | null;
			spineLabelPrintedAt: string | null;
		};
	}

	const { row }: Props = $props();
	const i18n = useI18n();
	const status = $derived(labelStatus(row));
</script>

<span class="font-mono text-sm">{row.barcode}</span>
<Link href="/catalog/{row.biblioId}" class="font-semibold">{row.title}</Link>
<span class="text-sm opacity-70">{row.author}</span>
<Hint as="span" mono>{row.callNumber ?? ""}</Hint>
<PrintedBadge {status} data-testid="entry-labels">
	{i18n.t(`printing.labels.status.${status}`)}
</PrintedBadge>
