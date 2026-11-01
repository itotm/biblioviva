<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Administrator exports (steps 7.3, 9.19): each file with what it holds and where it goes back in. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import TitleHint from "#lib/ui/TitleHint.svelte";

	const i18n = useI18n();
	const DownloadIcon = icons.download;
	const KINDS = [
		"students",
		"teachers",
		"catalog",
		"open-loans",
		"loans-history",
		"dump",
	] as const;
</script>

<Page>
	<PageHeader
		title={i18n.t("admin.exports.title")}
		subtitle={i18n.t("admin.exports.subtitle")}
		icon="export"
		backHref="/admin"
		backLabel={i18n.t("common.actions.back")}
	/>
	{#each KINDS as kind (kind)}
		<Card as="section" gap="3" data-testid="export-{kind}">
			<Row justify="between" align="center" wrap={false} gap="4">
				<TitleHint title={i18n.t(`admin.exports.items.${kind}.title`)} class="min-w-0"
					>{i18n.t(`admin.exports.items.${kind}.description`)}</TitleHint
				>
				<Button
					icon={DownloadIcon}
					href="/admin/exports/{kind}"
					download
					data-testid="download-{kind}">{i18n.t("admin.exports.download")}</Button
				>
			</Row>
		</Card>
	{/each}
	<Hint>{i18n.t("admin.exports.patronNote")}</Hint>
</Page>
