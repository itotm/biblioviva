<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { updatePatron } from "#lib/remote/patrons.remote.js";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import PatronForm from "#lib/components/patrons/PatronForm.svelte";
	import Page from "#lib/ui/Page.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const form = $derived(updatePatron.for(String(data.id)));
</script>

<Page width="md">
	<PageHeader
		title={i18n.t("patrons.form.editTitle")}
		subtitle={data.name}
		icon="patron"
		backHref="/patrons/{data.id}"
		backLabel={data.name}
	/>
	<PatronForm
		{form}
		rules={data.rules}
		submitLabel={i18n.t("patrons.form.save")}
		cancelHref="/patrons/{data.id}"
		initial={data.initial}
		id={data.id}
	/>
</Page>
