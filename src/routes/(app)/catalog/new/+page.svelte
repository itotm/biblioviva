<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { createBiblio } from "#lib/remote/catalog.remote.js";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import BiblioForm from "#lib/components/catalog/BiblioForm.svelte";
	import Page from "#lib/ui/Page.svelte";

	const { data } = $props();
	const i18n = useI18n();
</script>

<Page width="md">
	<PageHeader
		title={i18n.t("catalog.form.createTitle")}
		icon="book"
		backHref="/catalog"
		backLabel={i18n.t("common.actions.back")}
	/>
	<BiblioForm
		form={createBiblio}
		options={data.options}
		submitLabel={i18n.t("catalog.form.create")}
		cancelHref="/catalog"
	/>
</Page>
