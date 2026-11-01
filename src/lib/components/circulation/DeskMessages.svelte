<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The messages of a desk (Appendix I), one under the other, announced politely: the checkout and
     check-in desks, the open loans and the patron's loans (renewals). -->
<script lang="ts">
	import DeskMessage from "./DeskMessage.svelte";
	import type { DeskMessageData } from "./desk-message.js";

	interface Props {
		messages: readonly DeskMessageData[];
	}

	const { messages }: Props = $props();
</script>

<div class="space-y-3" aria-live="polite" data-testid="desk-messages">
	<!-- by position: two copies of one title refused alike give two identical messages -->
	{#each messages as m, i (i)}
		<DeskMessage message={m} />
	{/each}
</div>
