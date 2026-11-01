<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- About (step 1.12): application data and the generated inventory of the libraries in use. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import logoMark from "#lib/assets/logo-mark.webp";
	import Card from "#lib/ui/Card.svelte";
	import Link from "#lib/ui/Link.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Table from "#lib/ui/Table.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const npm = (name: string, version: string): string =>
		`https://www.npmjs.com/package/${name}/v/${version}`;
</script>

{#snippet table(
	rows: { name: string; version: string; license: string; homepage: string }[],
	testid: string,
	onNpm: boolean,
)}
	<div class="overflow-x-auto">
		<Table data-testid={testid}>
			<thead>
				<tr>
					<th>{i18n.t("about.deps.columns.name")}</th>
					<th>{i18n.t("about.deps.columns.version")}</th>
					<th>{i18n.t("about.deps.columns.license")}</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as d (d.name)}
					<tr class="border-t border-surface-200">
						<td class="p-2">
							<a
								href={d.homepage}
								target="_blank"
								rel="external noopener"
								class="font-semibold text-primary-700 hover:underline">{d.name}</a
							>
						</td>
						<td class="p-2 font-mono">
							{#if onNpm}
								<a
									href={npm(d.name, d.version)}
									target="_blank"
									rel="external noopener"
									class="hover:underline">{d.version}</a
								>
							{:else}
								{d.version}
							{/if}
						</td>
						<td class="p-2">{d.license}</td>
					</tr>
				{/each}
			</tbody>
		</Table>
	</div>
{/snippet}

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
						rel="external noopener">{data.inventory.app.license}</Link
					>
				</dd>
				<dt class="font-semibold">{i18n.t("about.app.repository")}</dt>
				<dd>
					<a
						href={data.inventory.app.repository}
						target="_blank"
						rel="external noopener"
						class="text-primary-700 hover:underline">{data.inventory.app.repository}</a
					>
				</dd>
			</dl>
		</div>
	</section>

	<Card padding="none" gap="4" as="section" class="p-6">
		<h2 class="text-xl font-bold">{i18n.t("about.deps.title")}</h2>
		<h3 class="font-semibold">
			{i18n.t("about.deps.runtime", { count: data.inventory.runtime.length })}
		</h3>
		{@render table(data.inventory.runtime, "deps-runtime", true)}
		<h3 class="font-semibold">{i18n.t("about.deps.system")}</h3>
		{@render table(data.inventory.system, "deps-system", false)}
		<details>
			<summary class="cursor-pointer font-semibold"
				>{i18n.t("about.deps.development", {
					count: data.inventory.development.length,
				})}</summary
			>
			<div class="mt-2">
				{@render table(data.inventory.development, "deps-development", true)}
			</div>
		</details>
	</Card>
</Page>
