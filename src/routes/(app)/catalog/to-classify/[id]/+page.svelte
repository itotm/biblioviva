<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The classification flow (step 9.21): one book at a time, a fresh flow for every book. -->
<script lang="ts">
	import ClassifyFlow from "#lib/components/catalog/ClassifyFlow.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";

	const { data } = $props();
	const i18n = useI18n();
</script>

<Page width="lg">
	<PageHeader
		title={i18n.t("catalog.toClassify.flow.title")}
		icon="toClassify"
		backHref="/catalog/to-classify"
		backLabel={i18n.t("catalog.toClassify.title")}
	/>
	{#key data.id}
		<ClassifyFlow id={data.id} />
	{/key}
</Page>
