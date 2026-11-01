<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Student import (steps 2.6, 9.19): the wizard of `PatronImportWizard`. -->
<script lang="ts">
	import PatronImportWizard from "#lib/components/imports/PatronImportWizard.svelte";

	const { data } = $props();
</script>

<PatronImportWizard audience="students" canRemove={data.canRemove} />
