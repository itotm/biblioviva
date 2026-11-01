<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
	The first load of OpenCV.js (step 3.7, Phase 13): a turning icon, how much is downloaded and a
	progress bar (indeterminate when the total is unknown). Shared by the cover capture and the
	frames of a class picture.
-->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import Row from "#lib/ui/Row.svelte";
	import Spinner from "#lib/ui/Spinner.svelte";
	import { megabytes, type LoadProgress } from "#lib/vision/loader.js";

	interface Props {
		progress: LoadProgress;
		testid?: string;
	}

	const { progress, testid }: Props = $props();
	const i18n = useI18n();
</script>

<div class="space-y-2" aria-live="polite" data-testid={testid}>
	<Row wrap={false} align="center" as="p">
		<Spinner />
		<span
			>{progress.total
				? i18n.t("catalog.cover.loading", {
						loaded: megabytes(progress.loaded),
						total: megabytes(progress.total),
					})
				: i18n.t("catalog.cover.loadingShort", {
						loaded: megabytes(progress.loaded),
					})}</span
		>
	</Row>
	<progress
		class="progress w-full max-w-md"
		max={progress.total ?? 1}
		value={progress.total ? progress.loaded : undefined}
	></progress>
</div>
