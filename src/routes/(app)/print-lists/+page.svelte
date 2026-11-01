<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Stampe (step 2.8): the lists of patrons and of copies, to print cards and labels. -->
<script lang="ts">
	import ListIndex from "#lib/components/print-lists/ListIndex.svelte";

	const { data } = $props();
</script>

<ListIndex permissions={data.user?.permissions ?? []} />
