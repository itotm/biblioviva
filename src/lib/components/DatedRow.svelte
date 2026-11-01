<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A row of a dashboard list (steps 4.9, 9.25): a title with its muted line on the left, a date on
     the right that never wraps (the loans due this week, the next dates of the calendar). -->
<script lang="ts">
	import Row from "#lib/ui/Row.svelte";
	import TitleHint from "#lib/ui/TitleHint.svelte";

	interface Props {
		title: string;
		/** The muted line under the title. */
		hint: string;
		/** The date, already formatted. */
		when: string;
	}

	const { title, hint, when }: Props = $props();
</script>

<Row as="li" wrap={false} align="center" justify="between" gap="3" class="py-1.5">
	<TitleHint {title} truncate class="min-w-0">{hint}</TitleHint>
	<span class="shrink-0 text-sm font-semibold">{when}</span>
</Row>
