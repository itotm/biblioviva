<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- One list opened from Stampe: print cards or labels and mark them as printed (step 2.8). -->
<script lang="ts">
	import ListDetail from "#lib/components/print-lists/ListDetail.svelte";

	const { data } = $props();
</script>

<ListDetail id={data.id} photosRequired={Boolean(data.photosRequired)} />
