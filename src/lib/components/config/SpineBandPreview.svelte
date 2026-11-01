<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The spine band of a made-up book filed under the node being edited (step 11.1), rendered by
     the server with the draft (unsaved pictograms included) and the default label template, at
     real size. Refreshed a moment after each change. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { previewTaxonomyBandOf } from "#lib/remote/taxonomy.remote.js";
	import type { TaxonomyDraft, TaxonomyKind } from "#lib/shared/taxonomy.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import PreviewFrame from "#lib/ui/PreviewFrame.svelte";
	import Loading from "#lib/ui/Loading.svelte";

	interface Props {
		draft: TaxonomyDraft;
		kind: TaxonomyKind;
		code: string;
	}

	const { draft, kind, code }: Props = $props();
	const i18n = useI18n();

	type Preview = Awaited<ReturnType<typeof previewTaxonomyBandOf>>;
	let preview = $state<Preview | null>(null);
	let failed = $state(false);
	let sequence = 0;

	$effect(() => {
		const input = { draft, kind, code, zoom: 1 as const };
		const mine = ++sequence;
		const timer = setTimeout(() => {
			previewTaxonomyBandOf(input)
				.then((result) => {
					if (mine === sequence) {
						preview = result;
						failed = false;
					}
				})
				.catch(() => {
					if (mine === sequence) {
						failed = true;
					}
				});
		}, 300);
		return () => clearTimeout(timer);
	});
</script>

<section class="space-y-2" data-testid="band-preview">
	<h3 class="font-semibold">{i18n.t("config.taxonomy.preview.title")}</h3>
	{#if failed}
		<Alert>{i18n.t("common.status.error")}</Alert>
	{:else if preview && !preview.ok}
		<Alert data-testid="band-preview-error">{preview.problems.join("; ")}</Alert>
	{:else if preview?.ok}
		<PreviewFrame
			title={i18n.t("config.taxonomy.preview.title")}
			html={preview.html}
			widthMm={preview.widthMm}
			heightMm={preview.heightMm}
			data-testid="band-preview-frame"
		/>
	{:else}
		<Loading size="md" />
	{/if}
	<Hint tone="faint">{i18n.t("config.taxonomy.preview.hint")}</Hint>
</section>
