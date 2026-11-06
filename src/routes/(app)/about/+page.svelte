<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- About (step 1.12): application data, and the way to the libraries in use, listed on a technical
     page of the documentation (step 9.53). -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import logoMark from "#lib/assets/logo-mark.webp";
	import Card from "#lib/ui/Card.svelte";
	import Link from "#lib/ui/Link.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Hint from "#lib/ui/Hint.svelte";

	const { data } = $props();
	const i18n = useI18n();
</script>

<Page>
	<PageHeader title={i18n.t("about.title")} icon="info" />

	<section
		class="flex flex-col gap-4 card p-6 md:flex-row md:items-start"
		data-testid="about-app"
	>
		<img src={logoMark} alt="" width="96" height="96" class="size-24 shrink-0" />
		<div class="space-y-2">
			<h2 class="text-2xl font-extrabold text-primary-700">{i18n.t("common.app.name")}</h2>
			<dl class="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
				<dt class="font-semibold">{i18n.t("about.app.version")}</dt>
				<dd class="font-mono" data-testid="about-version">{data.version}</dd>
				<dt class="font-semibold">{i18n.t("about.app.license")}</dt>
				<dd>
					<Link
						href="https://www.gnu.org/licenses/gpl-3.0.html"
						target="_blank"
						rel="external noopener">{data.app.license}</Link
					>
				</dd>
				<dt class="font-semibold">{i18n.t("about.app.repository")}</dt>
				<dd>
					<a
						href={data.app.repository}
						target="_blank"
						rel="external noopener"
						class="text-primary-700 hover:underline">{data.app.repository}</a
					>
				</dd>
			</dl>
		</div>
	</section>

	<Card padding="none" gap="2" as="section" class="p-6" data-testid="about-libraries">
		<h2 class="text-xl font-bold">{i18n.t("about.deps.title")}</h2>
		<Hint>{i18n.t("about.deps.hint")}</Hint>
		<Link href={data.librariesHref} target="_blank" rel="external noopener"
			>{i18n.t("about.deps.link")}</Link
		>
	</Card>
</Page>
